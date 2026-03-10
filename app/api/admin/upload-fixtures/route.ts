/**
 * POST /api/admin/upload-fixtures
 * Accepterer en CSV-fil fra fixturedownload.com og upsert'er kampe i league_matches.
 *
 * fixturedownload CSV format:
 *   Round Number,Date,Location,Home Team,Away Team,Result
 *   1,09/08/2025 12:30,Anfield,Liverpool,Bournemouth,4 - 2
 *
 * Multipart form fields:
 *   league_id: number
 *   file:      CSV-fil
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 30

interface ParsedRow {
  round_name: string
  home_team: string
  away_team: string
  kickoff_at: string
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'finished'
}

function parseFixtureCSV(csv: string): ParsedRow[] {
  const lines = csv.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''))
  const rows: ParsedRow[] = []

  const idx = {
    round:    headers.indexOf('Round Number'),
    date:     headers.indexOf('Date'),
    home:     headers.indexOf('Home Team'),
    away:     headers.indexOf('Away Team'),
    result:   headers.indexOf('Result'),
  }

  if (idx.round < 0 || idx.date < 0 || idx.home < 0 || idx.away < 0) {
    throw new Error('CSV mangler forventede kolonner: Round Number, Date, Home Team, Away Team')
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Håndter felter med komma inde i anførselstegn
    const cols = splitCSVLine(line)

    const roundNum  = cols[idx.round]?.replace(/"/g, '').trim()
    const dateStr   = cols[idx.date]?.replace(/"/g, '').trim()
    const homeTeam  = cols[idx.home]?.replace(/"/g, '').trim()
    const awayTeam  = cols[idx.away]?.replace(/"/g, '').trim()
    const result    = idx.result >= 0 ? (cols[idx.result]?.replace(/"/g, '').trim() ?? '') : ''

    if (!roundNum || !dateStr || !homeTeam || !awayTeam) continue

    // Parse "09/08/2025 12:30" → "2025-08-09T12:30:00Z"
    const [datePart, timePart] = dateStr.split(' ')
    const parts = datePart?.split('/')
    if (!parts || parts.length < 3) continue
    const [day, month, year] = parts
    const kickoff_at = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart ?? '00:00'}:00Z`

    // Parse "4 - 2" eller "4-2"
    let home_score: number | null = null
    let away_score: number | null = null
    let status: 'scheduled' | 'finished' = 'scheduled'

    if (result) {
      const m = result.match(/^(\d+)\s*-\s*(\d+)$/)
      if (m) {
        home_score = parseInt(m[1], 10)
        away_score = parseInt(m[2], 10)
        status = 'finished'
      }
    }

    rows.push({
      round_name: `${roundNum}. runde`,
      home_team:  homeTeam,
      away_team:  awayTeam,
      kickoff_at,
      home_score,
      away_score,
      status,
    })
  }

  return rows
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const formData = await req.formData()
  const leagueIdRaw = formData.get('league_id')
  const file = formData.get('file')

  if (!leagueIdRaw || !file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'league_id og fil er påkrævet' }, { status: 400 })
  }

  const leagueId = parseInt(leagueIdRaw.toString(), 10)
  if (isNaN(leagueId)) {
    return NextResponse.json({ error: 'Ugyldigt league_id' }, { status: 400 })
  }

  const csvText = await file.text()

  let rows: ParsedRow[]
  try {
    rows = parseFixtureCSV(csvText)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'CSV-parsing fejlede'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  if (!rows.length) {
    return NextResponse.json({ error: 'CSV indeholder ingen gyldige kampe' }, { status: 400 })
  }

  const upsertRows = rows.map((r) => ({
    league_id:  leagueId,
    round_name: r.round_name,
    home_team:  r.home_team,
    away_team:  r.away_team,
    kickoff_at: r.kickoff_at,
    home_score: r.home_score,
    away_score: r.away_score,
    status:     r.status,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabaseAdmin
    .from('league_matches')
    .upsert(upsertRows, { onConflict: 'league_id,home_team,away_team,kickoff_at' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Opdater leagues metadata
  await supabaseAdmin
    .from('leagues')
    .update({
      sync_status:    'ok',
      sync_error:     null,
      last_synced_at: new Date().toISOString(),
      total_matches:  rows.length,
    })
    .eq('id', leagueId)

  // Log synken
  await supabaseAdmin
    .from('league_sync_logs')
    .insert({
      league_id:        leagueId,
      matches_imported: rows.length,
      status:           'ok',
      message:          `${rows.length} kampe importeret via CSV-upload`,
    })

  // Byg runder for aktive spilrum
  const { data: games } = await supabaseAdmin
    .from('games')
    .select('id')
    .eq('league_id', leagueId)
    .eq('status', 'active')

  let rounds_created = 0, matches_created = 0
  if (games?.length) {
    const { buildGameRounds } = await import('@/lib/syncLeagueMatches')
    for (const g of games as { id: number }[]) {
      const res = await buildGameRounds(g.id, leagueId)
      rounds_created  += res.rounds_created
      matches_created += res.matches_created
    }
  }

  return NextResponse.json({ synced: rows.length, rounds_created, matches_created })
}
