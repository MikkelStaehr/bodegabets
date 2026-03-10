// Kanoniske navne-mappings: Bold navn → vores db navn
// Tilføj løbende når der opdages mismatches
export const TEAM_NAME_MAP: Record<string, string> = {
  // Danmark
  'FC København': 'FC Copenhagen',
  'Brøndby IF': 'Brondby IF',
  'FC Midtjylland': 'FC Midtjylland',
  AGF: 'AGF',
  'Randers FC': 'Randers FC',
  OB: 'OB Odense',
  AaB: 'Aalborg BK',
  'Silkeborg IF': 'Silkeborg IF',
  'Viborg FF': 'Viborg FF',
  'Vejle BK': 'Vejle BK',
  'FC Nordsjælland': 'FC Nordsjaelland',
  'Lyngby BK': 'Lyngby BK',
  // England
  Tottenham: 'Tottenham Hotspur',
  'Man City': 'Manchester City',
  'Man Utd': 'Manchester United',
  Wolves: 'Wolverhampton',
  Newcastle: 'Newcastle United',
  Brighton: 'Brighton & Hove Albion',
  'Nottm Forest': 'Nottingham Forest',
  Spurs: 'Tottenham Hotspur',
  // Tilføj flere efter behov
}

// Normaliser et holdnavn til lowercase uden diakritika
export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // fjern diakritika
    .replace(/[^a-z0-9\s]/g, '') // fjern specialtegn
    .replace(/\s+/g, ' ') // normaliser mellemrum
    .trim()
}

// Slå Bold-navn op i mapping, eller normaliser direkte
export function resolveTeamName(boldName: string): string {
  // Direkte mapping
  if (TEAM_NAME_MAP[boldName]) return TEAM_NAME_MAP[boldName]
  // Normaliser
  return normalizeTeamName(boldName)
}

/** For DB-query: brug mapping hvis den findes, ellers original Bold-navn */
export function toDbTeamName(boldName: string): string {
  return TEAM_NAME_MAP[boldName] ?? boldName
}

// Find bedste match i en liste af db-holdnavne
export function findBestTeamMatch(
  boldName: string,
  dbNames: string[]
): string | null {
  const resolved = resolveTeamName(boldName)

  // Forsøg 1: direkte mapping match
  const mapped = TEAM_NAME_MAP[boldName]
  if (mapped && dbNames.includes(mapped)) return mapped

  // Forsøg 2: normaliseret match
  const normalMatch = dbNames.find(
    (db) => normalizeTeamName(db) === resolved
  )
  if (normalMatch) return normalMatch

  // Forsøg 3: partial match (Bold-navn indeholdt i db-navn eller omvendt)
  const partialMatch = dbNames.find((db) => {
    const normDb = normalizeTeamName(db)
    return normDb.includes(resolved) || resolved.includes(normDb)
  })
  if (partialMatch) return partialMatch

  return null
}
