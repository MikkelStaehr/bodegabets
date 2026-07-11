/*
  Hviledag transfers — 2026-04-18

  SQL migration (kør manuelt i Supabase før deploy):

  -- Rest days per race (array af datoer)
  ALTER TABLE cycling_races ADD COLUMN IF NOT EXISTS rest_days date[] NOT NULL DEFAULT '{}';

  -- Transfer log
  CREATE TABLE IF NOT EXISTS cycling_squad_transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    squad_id uuid NOT NULL REFERENCES cycling_squads(id) ON DELETE CASCADE,
    race_id uuid NOT NULL REFERENCES cycling_races(id) ON DELETE CASCADE,
    rest_day_date date NOT NULL,
    rider_out_id uuid NOT NULL,
    rider_in_id uuid NOT NULL,
    rider_in_category int NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE (squad_id, rest_day_date, rider_out_id),
    UNIQUE (squad_id, rest_day_date, rider_in_id)
  );

  ALTER TABLE cycling_squad_transfers ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Public read" ON cycling_squad_transfers FOR SELECT USING (true);
*/

import { supabaseAdmin } from '@/lib/supabase'

export const MAX_TRANSFERS_PER_REST_DAY = 5

type SquadRider = {
  rider_id: string
  category_slot: number
}

/**
 * Beregn effektiv brutto-trup for en squad PÅ et givent tidspunkt i løbet.
 * Starter fra original squad og anvender alle transfers hvor rest_day_date < beforeDate.
 *
 * @param beforeDate — typisk stage.start_date. Transfers før denne dato tæller.
 */
export async function getEffectiveSquadRiders(
  squadId: string,
  raceId: string,
  beforeDate: string,
): Promise<SquadRider[]> {
  const [{ data: original }, { data: transfers }] = await Promise.all([
    supabaseAdmin
      .from('cycling_squad_riders')
      .select('rider_id, category_slot')
      .eq('squad_id', squadId),
    supabaseAdmin
      .from('cycling_squad_transfers')
      .select('rest_day_date, rider_out_id, rider_in_id, rider_in_category')
      .eq('squad_id', squadId)
      .eq('race_id', raceId),
  ])

  const base: SquadRider[] = (original ?? []).map((r) => ({
    rider_id: r.rider_id as string,
    category_slot: r.category_slot as number,
  }))

  const applicable = (transfers ?? []).filter(
    (t) => (t.rest_day_date as string) < beforeDate,
  )

  if (applicable.length === 0) return base

  const outIds = new Set(applicable.map((t) => t.rider_out_id as string))
  const result = base.filter((r) => !outIds.has(r.rider_id))
  for (const t of applicable) {
    result.push({
      rider_id: t.rider_in_id as string,
      category_slot: t.rider_in_category as number,
    })
  }
  return result
}

/**
 * Nuværende effektiv brutto-trup (efter alle transfers).
 */
export async function getCurrentEffectiveSquad(
  squadId: string,
  raceId: string,
): Promise<SquadRider[]> {
  return getEffectiveSquadRiders(squadId, raceId, '9999-12-31')
}

/**
 * Effektiv brutto-trup (ALLE transfers anvendt) for et sæt squads, merget og
 * dedupet på rider_id. Returnerer rider_id + category_slot, hvor transfer-ind-
 * ryttere får deres rider_in_category. Bruges til at VISE truppen inkl. de
 * indbyttede ryttere (display anvendte ikke transfers før — derfor manglede de).
 * Transfers anvendes per squad, så en out-rytter i én squad ikke fjernes fra en
 * anden.
 */
export async function getEffectiveSquadRidersForSquads(
  squadIds: string[],
): Promise<SquadRider[]> {
  if (squadIds.length === 0) return []
  const [{ data: base }, { data: transfers }] = await Promise.all([
    supabaseAdmin
      .from('cycling_squad_riders')
      .select('squad_id, rider_id, category_slot')
      .in('squad_id', squadIds),
    supabaseAdmin
      .from('cycling_squad_transfers')
      .select('squad_id, rider_out_id, rider_in_id, rider_in_category')
      .in('squad_id', squadIds),
  ])

  const outBySquad = new Map<string, Set<string>>()
  for (const t of transfers ?? []) {
    const sq = t.squad_id as string
    if (!outBySquad.has(sq)) outBySquad.set(sq, new Set())
    outBySquad.get(sq)!.add(t.rider_out_id as string)
  }

  const byRider = new Map<string, number>()
  for (const r of base ?? []) {
    if (outBySquad.get(r.squad_id as string)?.has(r.rider_id as string)) continue
    if (!byRider.has(r.rider_id as string)) byRider.set(r.rider_id as string, (r.category_slot as number) ?? 5)
  }
  for (const t of transfers ?? []) {
    byRider.set(t.rider_in_id as string, (t.rider_in_category as number) ?? 5)
  }

  return [...byRider.entries()].map(([rider_id, category_slot]) => ({ rider_id, category_slot }))
}

/**
 * Per-squad oversigt over effektive rider_ids (med transfers anvendt) — bruges
 * i lineup-pickeren til at filtrere brutto-truppen til den AKTIVE bloks squad,
 * så en Giro-rytter ikke dukker op i Dauphiné-pickeren.
 */
export async function getEffectiveRidersBySquad(
  squadIds: string[],
): Promise<Record<string, string[]>> {
  if (squadIds.length === 0) return {}
  const [{ data: base }, { data: transfers }] = await Promise.all([
    supabaseAdmin
      .from('cycling_squad_riders')
      .select('squad_id, rider_id')
      .in('squad_id', squadIds),
    supabaseAdmin
      .from('cycling_squad_transfers')
      .select('squad_id, rider_out_id, rider_in_id')
      .in('squad_id', squadIds),
  ])

  const out: Record<string, Set<string>> = {}
  for (const sq of squadIds) out[sq] = new Set()
  const removed: Record<string, Set<string>> = {}
  for (const sq of squadIds) removed[sq] = new Set()
  for (const t of transfers ?? []) removed[t.squad_id as string]?.add(t.rider_out_id as string)
  for (const r of base ?? []) {
    const sq = r.squad_id as string
    const rid = r.rider_id as string
    if (removed[sq]?.has(rid)) continue
    out[sq]?.add(rid)
  }
  for (const t of transfers ?? []) out[t.squad_id as string]?.add(t.rider_in_id as string)

  const result: Record<string, string[]> = {}
  for (const sq of squadIds) result[sq] = [...(out[sq] ?? [])]
  return result
}
