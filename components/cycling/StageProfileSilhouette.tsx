'use client'

/**
 * Stiliseret SVG-silhuet af en etape-profil.
 *
 * Vi har IKKE km-for-km højdedata fra PCS — det kræver enten en separat
 * scrape eller en API-integration vi ikke har. I stedet genererer vi en
 * procedurel silhuet ud fra de data vi allerede har: profil-kategori
 * (flat/hilly/mountain/mixed/cobbled), distance_km, vertical_meters og
 * profile_score. Resultatet er en stilseret repræsentation der konvejer
 * karakteren af etapen — ikke en præcis profil.
 *
 * Hver profil-kategori har sin egen formfunktion:
 *   - flat:     næsten flad linje, små bølger
 *   - mixed:    bløde rullende bakker
 *   - hilly:    medium bakker hele vejen
 *   - cobbled:  flad med små jagged bumps (brosten-følelse)
 *   - mountain: stort spike sent i etapen + mindre opvarmnings-spike
 *
 * stage_number bruges som seed så samme etape altid får samme silhuet
 * (deterministisk) men forskellige etaper varierer en smule.
 */

type Props = {
  profile: string | null
  verticalMeters: number | null
  distanceKm: number | null
  profileScore: number | null
  stageNumber: number
}

const WIDTH = 800
const HEIGHT = 100
const PADDING_X = 4
const PADDING_Y = 6

function buildPath(
  profile: string | null,
  vm: number,
  ps: number,
  stageSeed: number,
): string {
  // Højde-normalisering: 0 m → minimal, 4500 m → fuld bjerg-skala
  const baseScale = Math.min(Math.max(vm / 4500, 0.18), 1.0)
  const psBoost = Math.min(ps / 800, 0.25)
  const heightScale = baseScale + psBoost

  // Fase-shift pr. etape — bumps ligger ikke samme sted hver gang
  const phase = (stageSeed * 0.617) * Math.PI * 2

  const N = 120
  const inner = WIDTH - 2 * PADDING_X
  const usable = HEIGHT - 2 * PADDING_Y
  const points: string[] = []

  for (let i = 0; i <= N; i++) {
    const t = i / N
    let yRaw: number

    switch (profile) {
      case 'flat':
        yRaw = 0.08 + 0.05 * Math.sin(t * 6 * Math.PI + phase) + 0.04 * Math.sin(t * 14 * Math.PI)
        break
      case 'mixed':
        yRaw = 0.18 + 0.18 * Math.sin(t * 4 * Math.PI + phase) + 0.07 * Math.sin(t * 9 * Math.PI + phase * 0.6)
        break
      case 'hilly': {
        const wave = Math.abs(Math.sin(t * 5 * Math.PI + phase))
        yRaw = 0.22 + 0.32 * wave + 0.08 * Math.sin(t * 11 * Math.PI + phase * 1.3)
        break
      }
      case 'cobbled':
        yRaw = 0.14 + 0.08 * Math.sin(t * 18 * Math.PI + phase) + 0.06 * Math.sin(t * 27 * Math.PI)
        break
      case 'mountain': {
        // Stort hovedspike sent i etapen
        const mainPeakPos = 0.72
        const mainPeak = Math.exp(-Math.pow((t - mainPeakPos) / 0.13, 2)) * (0.78 + psBoost)
        // Opvarmnings-bjerg tidligere
        const earlyPeak = Math.exp(-Math.pow((t - 0.35) / 0.12, 2)) * 0.28
        // Små rullende bumps
        const bumps = 0.06 * Math.sin(t * 7 * Math.PI + phase)
        yRaw = 0.12 + mainPeak + earlyPeak + bumps
        break
      }
      default:
        yRaw = 0.2 + 0.18 * Math.sin(t * 5 * Math.PI + phase)
    }

    const yScaled = Math.max(0, Math.min(1, yRaw * heightScale * 1.15))
    const x = (t * inner) + PADDING_X
    const y = HEIGHT - PADDING_Y - yScaled * usable
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }

  // Lukket polygon: start fra baseline, op gennem alle points, ned igen
  return `M ${PADDING_X},${HEIGHT - PADDING_Y} L ${points.join(' L ')} L ${WIDTH - PADDING_X},${HEIGHT - PADDING_Y} Z`
}

export default function StageProfileSilhouette({
  profile, verticalMeters, distanceKm, profileScore, stageNumber,
}: Props) {
  const vm = verticalMeters ?? 1200
  const ps = profileScore ?? 100
  const path = buildPath(profile, vm, ps, stageNumber)

  const stats: string[] = []
  if (distanceKm != null && distanceKm > 0) stats.push(`${distanceKm} km`)
  if (verticalMeters != null && verticalMeters > 0) stats.push(`↑ ${verticalMeters.toLocaleString()} m`)

  return (
    <div style={{
      position: 'relative',
      background: 'rgba(0,0,0,0.25)',
      borderRadius: 4,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: 84, display: 'block' }}
      >
        {/* Vandret midter-linje for skala */}
        <line
          x1={0} y1={HEIGHT * 0.55}
          x2={WIDTH} y2={HEIGHT * 0.55}
          stroke="rgba(255,255,255,0.07)" strokeWidth={0.8} strokeDasharray="3,5"
        />
        {/* Silhuet */}
        <path
          d={path}
          fill="rgba(143,171,196,0.32)"
          stroke="rgba(143,171,196,0.85)"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </svg>
      {/* Stats overlay */}
      {stats.length > 0 && (
        <div style={{
          position: 'absolute', top: 5, right: 7,
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10,
          color: 'rgba(255,255,255,0.7)', fontWeight: 600,
          letterSpacing: '0.04em',
        }}>
          {stats.join(' · ')}
        </div>
      )}
      {/* Honest disclaimer */}
      <div style={{
        position: 'absolute', bottom: 4, left: 7,
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 8,
        color: 'rgba(255,255,255,0.32)', fontWeight: 600,
        letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        Stiliseret silhuet
      </div>
    </div>
  )
}
