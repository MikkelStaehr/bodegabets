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

export const MAX_TRANSFERS_PER_REST_DAY = 3

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
