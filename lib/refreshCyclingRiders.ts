/**
 * Daglig refresh af cycling_riders master-data fra PCS.
 *
 * Den manuelle Python-sync (scripts/cycling/sync_all.py) kører kun 1-2x
 * pr. sæson og fanger ikke hold-skift, foto-opdateringer eller andre
 * gradvise ændringer i PCS' rider-data. Det giver et hul: brugere ser
 * forældet team_name når en rytter er gået til et andet hold.
 *
 * Denne refresh går igennem et batch af eksisterende ryttere pr. cron-
 * run, henter deres aktuelle PCS rider-page og opdaterer hvis noget har
 * ændret sig. Batch-størrelsen er valgt så hele DB'en (~930 ryttere)
 * gennemgås over ~10 dage — det er fint, fordi hold-skift er sjældne og
 * ikke kritiske at fange indenfor minutter.
 *
 * Strategi:
 * - LRU på last_synced_at: hent de N ældste først
 * - Filter til is_active=true så vi ikke spilder requests på pensionerede
 * - Skip ryttere uden pcs_slug (umulige at slå op)
 * - Auto-opdater team_name, team_logo_url, photo_url hvis ændret
 * - Hold last_synced_at frisk så samme rytter ikke ramler i næste batch
 */

import { supabaseAdmin } from '@/lib/supabase'
import { enrichRiderFromPcs } from '@/lib/cyclingRiderEnrichment'

const BATCH_SIZE = 100
const REQUEST_DELAY_MS = 800 // ~75 calls/min — PCS klagede ved ~10/sek tidligere

export type RefreshResult = {
  ok: boolean
  scanned: number
  changed: number
  teamChanges: number
  errors: string[]
}

export async function refreshCyclingRiders(): Promise<RefreshResult> {
  const result: RefreshResult = { ok: true, scanned: 0, changed: 0, teamChanges: 0, errors: [] }

  // Hent batch — ældste last_synced_at først. nulls først (ryttere der aldrig
  // har været enriched siden de blev auto-insertet via startlist-sync).
  const { data: riders, error } = await supabaseAdmin
    .from('cycling_riders')
    .select('id, pcs_slug, team_name, team_logo_url, photo_url, last_synced_at')
    .eq('is_active', true)
    .not('pcs_slug', 'is', null)
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE)

  if (error) {
    result.ok = false
    result.errors.push(`fetch riders: ${error.message}`)
    return result
  }
  if (!riders?.length) return result

  for (const r of riders) {
    result.scanned++
    const enrich = await enrichRiderFromPcs(r.pcs_slug as string)
    await new Promise((res) => setTimeout(res, REQUEST_DELAY_MS))
    const nowIso = new Date().toISOString()

    // Hvis vi ikke kunne hente noget, marker stadig som scannet så vi ikke
    // bliver hængende på den samme dårlige rytter i hvert run.
    if (!enrich) {
      await supabaseAdmin
        .from('cycling_riders').update({ last_synced_at: nowIso }).eq('id', r.id)
      continue
    }

    const patch: { team_name?: string; team_logo_url?: string; photo_url?: string; last_synced_at: string; updated_at: string } = {
      last_synced_at: nowIso,
      updated_at: nowIso,
    }
    let teamChanged = false
    let anyChange = false

    if (enrich.team_name && enrich.team_name !== r.team_name) {
      patch.team_name = enrich.team_name
      teamChanged = true
      anyChange = true
      console.log(`[refreshRiders] ${r.pcs_slug}: hold-skift "${r.team_name}" → "${enrich.team_name}"`)
    }
    if (enrich.team_logo_url && enrich.team_logo_url !== r.team_logo_url) {
      patch.team_logo_url = enrich.team_logo_url
      anyChange = true
    }
    if (enrich.photo_url && enrich.photo_url !== r.photo_url) {
      patch.photo_url = enrich.photo_url
      anyChange = true
    }

    const { error: updErr } = await supabaseAdmin
      .from('cycling_riders').update(patch).eq('id', r.id)
    if (updErr) {
      result.errors.push(`${r.pcs_slug}: update ${updErr.message}`)
      continue
    }
    if (anyChange) result.changed++
    if (teamChanged) result.teamChanges++
  }

  return result
}
