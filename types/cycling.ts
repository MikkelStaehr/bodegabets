// Shared cycling types used across components, pages, and API routes

export type CyclingRace = {
  id: string
  name: string
  start_date: string
  status: string
  race_type: string
  profile: string | null
  profile_image_url: string | null
  logo_url: string | null
  race_photo_url: string | null
  rest_days: string[] | null
  cycling_block_id: string | null
}

export type CyclingBlock = {
  id: string
  name: string
  block_order: number
  parent_block_id: string | null
  lock_deadline: string
  status?: string
  winner_username?: string | null
  winner_user_id?: string | null
}

export type CyclingStage = {
  id: string
  race_id: string
  stage_number: number
  name: string
  profile: string | null
  profile_image_url: string | null
  start_date: string
  /** Nøjagtigt PCS-starttidspunkt i UTC, hvis kendt. Bruges af deadline-
   *  beregningen til at lukke lineup-redigering 30 min før reel start. */
  start_time_utc: string | null
  distance_km: number | null
  departure: string | null
  arrival: string | null
  profile_score: number | null
  vertical_meters: number | null
  /** Scrapede klatringer fra PCS — bruges af StageProfileSilhouette til
   *  at rendere en mere præcis profil-silhuet. Tom array hvis ikke scrapet
   *  eller ingen klatringer. */
  climbs: CyclingStageClimb[]
  results_uploaded_at: string | null
  race_name: string
  race_type: string
  race_profile_image_url: string | null
  cycling_block_id: string | null
}

export type CyclingStageClimb = {
  name: string
  /** Kategori 1-4 (1 = hårdest) eller 0 for HC/utenfor-kategori. Kun kendt
   *  for afviklede etaper (fra PCS' KOM-resultattabel). */
  category?: number
  /** Km fra start hvor klatringen toppe. Kun kendt for afviklede etaper. */
  km_from_start?: number
  /** Længde/gradient er sjældent tilgængelige fra PCS-tekst (ligger i
   *  profil-grafikken) — bevares optional for fremtidig brug. */
  length_km?: number
  gradient_pct?: number
}

export type CyclingSquadRider = {
  id: string
  first_name: string
  last_name: string
  team_name: string
  category: number
  team_logo_url: string | null
  photo_url: string | null
}

export type CyclingRoleKey = 'leader' | 'lieutenant' | 'grimpeur' | 'sprinter' | 'domestique' | 'equipier_0' | 'equipier_1' | 'equipier_2' | 'joker'

/**
 * Gemt rolle-rytter template pr. squad. Brugeren har typisk 2-3 "playbooks"
 * (Sprint, Bjerg, Tempo) klar og anvender dem på matchende etaper for at
 * undgå 9 klik × 21 etaper. slots følger samme shape som UI'ets LineupState.
 */
export type CyclingLineupPreset = {
  id: string
  squad_id: string
  name: string
  slot_index: number
  slots: Partial<Record<CyclingRoleKey, string | null>>
  updated_at: string
}
