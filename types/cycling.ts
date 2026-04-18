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
}

export type CyclingStage = {
  id: string
  race_id: string
  stage_number: number
  name: string
  profile: string | null
  profile_image_url: string | null
  start_date: string
  distance_km: number | null
  departure: string | null
  arrival: string | null
  profile_score: number | null
  vertical_meters: number | null
  race_name: string
  race_type: string
  race_profile_image_url: string | null
  cycling_block_id: string | null
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

export type CyclingRoleKey = 'leader' | 'lieutenant' | 'grimpeur' | 'sprinter' | 'domestique' | 'equipier_0' | 'equipier_1' | 'joker'
