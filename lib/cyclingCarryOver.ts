/**
 * Auto-carry-over af cykel-lineups.
 *
 * House-rule: hvis en spiller ikke har sat opstilling til en etape (stage race)
 * når deadline rammer, kopieres deres FORRIGE etapes lineup automatisk —
 * remappet til den nye etapes profil (fx flad→bakket flytter en overskuds-
 * equipier til klatrer-slot). Så man ikke straffes med en 0-etape ved at glemme
 * at sætte hold.
 *
 * Kører fra lock-cronen — dvs. FØRST når deadline er passeret, aldrig med facit
 * i hånden (kopien er spillerens egen sidste opstilling, ikke hindsight-valg).
 * Idempotent: rører kun squads der IKKE allerede har et lineup på etapen.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { remapSlotsToProfile } from '@/lib/cyclingRoles'
import { isStageDeadlinePassed } from '@/lib/cyclingDeadline'
import type { CyclingRoleKey } from '@/types/cycling'

export async function carryOverMissingLineups(): Promise<{ created: number; details: string[] }> {
  const now = new Date()
  const details: string[] = []
  let created = 0

  // Kandidat-etaper: stage race, ikke finaliseret, start indenfor sidste 2 dage.
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10)
  const { data: stages } = await supabaseAdmin
    .from('cycling_stages')
    .select('id, race_id, stage_number, profile, start_date, start_time_utc, cycling_races!inner(race_type)')
    .is('results_uploaded_at', null)
    .eq('cycling_races.race_type', 'stage_race')
    .gte('start_date', `${twoDaysAgo}T00:00:00Z`)
    .lte('start_date', now.toISOString())
    .order('stage_number', { ascending: true })

  for (const stage of (stages ?? []) as unknown as Array<{
    id: string; race_id: string; stage_number: number; profile: string | null
    start_date: string; start_time_utc: string | null
  }>) {
    // Kun EFTER deadline — carry-over må aldrig ske mens man kan se løbet.
    if (!isStageDeadlinePassed(stage.start_date, now, stage.start_time_utc)) continue

    // Tidligere etaper i samme løb (til at finde forrige lineup).
    const { data: earlierStages } = await supabaseAdmin
      .from('cycling_stages')
      .select('id, stage_number')
      .eq('race_id', stage.race_id)
      .lt('stage_number', stage.stage_number)
    const earlierIds = (earlierStages ?? []).map((s) => s.id)
    if (earlierIds.length === 0) continue

    const { data: earlierLineups } = await supabaseAdmin
      .from('cycling_lineups')
      .select('id, squad_id, stage_id')
      .in('stage_id', earlierIds)
    if (!earlierLineups?.length) continue

    // Squads der allerede har sat hold på DENNE etape.
    const { data: existing } = await supabaseAdmin
      .from('cycling_lineups')
      .select('squad_id')
      .eq('stage_id', stage.id)
    const hasLineup = new Set((existing ?? []).map((l) => l.squad_id))

    // Pr. squad: find deres SENESTE tidligere etape med et lineup.
    const stageNumById = new Map((earlierStages ?? []).map((s) => [s.id, s.stage_number]))
    const latestBySquad = new Map<string, { stageNum: number; lineupId: string }>()
    for (const lu of earlierLineups) {
      const sn = stageNumById.get(lu.stage_id) ?? -1
      const cur = latestBySquad.get(lu.squad_id)
      if (!cur || sn > cur.stageNum) latestBySquad.set(lu.squad_id, { stageNum: sn, lineupId: lu.id })
    }

    for (const [squadId, { lineupId }] of latestBySquad) {
      if (hasLineup.has(squadId)) continue // har allerede sat hold — rør ikke

      const { data: prevRiders } = await supabaseAdmin
        .from('cycling_lineup_riders')
        .select('rider_id, role, slot_index')
        .eq('lineup_id', lineupId)
      if (!prevRiders?.length) continue

      const slots: Partial<Record<CyclingRoleKey, string | null>> = {}
      for (const r of prevRiders) {
        const key = (r.role === 'equipier' ? `equipier_${r.slot_index}` : r.role) as CyclingRoleKey
        slots[key] = r.rider_id
      }
      const remapped = remapSlotsToProfile(slots, stage.profile)

      const { data: newLu, error: e1 } = await supabaseAdmin
        .from('cycling_lineups')
        .insert({ squad_id: squadId, race_id: stage.race_id, stage_id: stage.id, is_locked: true })
        .select('id')
        .single()
      if (e1 || !newLu) { details.push(`etape ${stage.stage_number} squad ${squadId.slice(0, 8)}: lineup-fejl ${e1?.message}`); continue }

      const rows = Object.entries(remapped)
        .filter(([, rider]) => !!rider)
        .map(([key, rider]) => ({
          lineup_id: newLu.id,
          rider_id: rider as string,
          role: key.startsWith('equipier_') ? 'equipier' : key,
          slot_index: key.startsWith('equipier_') ? parseInt(key.split('_')[1], 10) : 0,
        }))
      const { error: e2 } = await supabaseAdmin.from('cycling_lineup_riders').insert(rows)
      if (e2) {
        await supabaseAdmin.from('cycling_lineups').delete().eq('id', newLu.id)
        details.push(`etape ${stage.stage_number} squad ${squadId.slice(0, 8)}: riders-fejl ${e2.message}`)
        continue
      }

      created++
      details.push(`etape ${stage.stage_number}: carry-over for squad ${squadId.slice(0, 8)} (${rows.length} ryttere)`)
    }
  }

  return { created, details }
}
