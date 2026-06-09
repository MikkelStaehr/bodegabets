'use client'

/**
 * SVG-silhuet af en etape-profil.
 *
 * To rendering-modes:
 *
 * 1) **Rigtige klatringer** (når climbs er scrapet fra PCS): vi placerer
 *    spikes på relative positioner gennem etapen og skalerer højden efter
 *    klatringens (length_km × gradient_pct) = approx højdemeter. Hvis vi har
 *    km_from_start, bruges det; ellers fordeles klatringerne jævnt.
 *    Navne på de største klatringer skrives over deres top.
 *
 * 2) **Stiliseret silhuet** (fallback): procedurel formfunktion pr. profil-
 *    kategori, scaled efter vertical_meters. Bruges når PCS-scrape ikke har
 *    fundet klatringer (ny etape, parse fejl, eller flad etape uden klatringer).
 */

import type { CyclingStageClimb } from '@/types/cycling'

type Props = {
  profile: string | null
  verticalMeters: number | null
  distanceKm: number | null
  profileScore: number | null
  stageNumber: number
  climbs?: CyclingStageClimb[]
}

const WIDTH = 800
const HEIGHT = 110
const PADDING_X = 4
const PADDING_Y_TOP = 14 // ekstra plads til navne over toppe
const PADDING_Y_BOT = 6

// ── Rigtige klatringer som spikes ─────────────────────────────────────────

// Højde pr. klatrings-kategori (1 = hårdest/højest). HC = 0. Ukendt = medium.
function categoryHeight(cat: number | undefined): number {
  switch (cat) {
    case 0: return 1.0   // HC / hors catégorie
    case 1: return 0.92
    case 2: return 0.72
    case 3: return 0.52
    case 4: return 0.38
    default: return 0.58 // ukendt (navne-kun fra kommende etape)
  }
}

function buildPathFromClimbs(climbs: CyclingStageClimb[], distanceKm: number | null): {
  path: string
  peaks: { x: number; y: number; name: string; gradient: number }[]
} {
  const totalKm = distanceKm && distanceKm > 0 ? distanceKm : 200
  const inner = WIDTH - 2 * PADDING_X
  const usable = HEIGHT - PADDING_Y_TOP - PADDING_Y_BOT

  // Sortér klatringer efter position (km_from_start hvis vi har, ellers bevar
  // den rækkefølge PCS gav dem — det er rute-rækkefølgen).
  const hasKm = climbs.some((c) => c.km_from_start != null && c.km_from_start > 0)
  const sorted = hasKm
    ? [...climbs].sort((a, b) => (a.km_from_start ?? 0) - (b.km_from_start ?? 0))
    : climbs

  // Højde pr. klatring: kategori hvis kendt; ellers length×gradient hvis kendt;
  // ellers medium (navne-kun). Normalisér ikke når vi bruger kategori — den er
  // allerede en absolut skala.
  const positions: { x: number; peakHeight: number; name: string; gradient: number }[] = []
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i]
    let xFrac: number
    if (c.km_from_start != null && c.km_from_start > 0) {
      xFrac = Math.min(0.98, c.km_from_start / totalKm)
    } else {
      // Jævnt fordelt på [0.12, 0.88] i rute-rækkefølge
      xFrac = sorted.length > 1
        ? 0.12 + 0.76 * (i / (sorted.length - 1))
        : 0.5
    }
    let peakHeight: number
    if (c.category != null) {
      peakHeight = categoryHeight(c.category)
    } else if (c.length_km != null && c.gradient_pct != null) {
      peakHeight = Math.min(1, 0.25 + 0.7 * (c.length_km * c.gradient_pct) / 200)
    } else {
      peakHeight = categoryHeight(undefined)
    }
    positions.push({
      x: xFrac * inner + PADDING_X,
      peakHeight,
      name: c.name,
      gradient: c.gradient_pct ?? 0,
    })
  }

  // Byg silhuet: ved hver klatring en gauss-spike, mellem klatringer en lav
  // baseline med små bumps. Sample N punkter.
  const N = 240
  const baseY = 0.08

  function yAtT(t: number): number {
    const x = t * inner + PADDING_X
    let y = baseY + 0.05 * Math.sin(t * 8 * Math.PI) // baseline med små bumps
    for (const p of positions) {
      // Bredden af spike skaleres med peakHeight — store klatringer er bredere
      const spikeWidth = (60 + p.peakHeight * 40) // pixels
      const dx = x - p.x
      const gauss = Math.exp(-Math.pow(dx / spikeWidth, 2))
      y += p.peakHeight * gauss
    }
    return Math.max(0, Math.min(1, y))
  }

  const points: string[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const x = t * inner + PADDING_X
    const yNorm = yAtT(t)
    const y = HEIGHT - PADDING_Y_BOT - yNorm * usable
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  const path = `M ${PADDING_X},${HEIGHT - PADDING_Y_BOT} L ${points.join(' L ')} L ${WIDTH - PADDING_X},${HEIGHT - PADDING_Y_BOT} Z`

  // Beregn y for hvert peak til label-placering (kun de 3 højeste)
  const peaksWithYRaw = positions.map((p) => ({
    ...p,
    y: HEIGHT - PADDING_Y_BOT - yAtT((p.x - PADDING_X) / inner) * usable,
    sortKey: p.peakHeight,
  }))
  const peaks = peaksWithYRaw
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 3)

  return { path, peaks }
}

// ── Procedural fallback ────────────────────────────────────────────────────

function buildProceduralPath(
  profile: string | null, vm: number, ps: number, stageSeed: number,
): string {
  const baseScale = Math.min(Math.max(vm / 4500, 0.18), 1.0)
  const psBoost = Math.min(ps / 800, 0.25)
  const heightScale = baseScale + psBoost
  const phase = (stageSeed * 0.617) * Math.PI * 2

  const N = 120
  const inner = WIDTH - 2 * PADDING_X
  const usable = HEIGHT - PADDING_Y_TOP - PADDING_Y_BOT
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
        const mainPeak = Math.exp(-Math.pow((t - 0.72) / 0.13, 2)) * (0.78 + psBoost)
        const earlyPeak = Math.exp(-Math.pow((t - 0.35) / 0.12, 2)) * 0.28
        const bumps = 0.06 * Math.sin(t * 7 * Math.PI + phase)
        yRaw = 0.12 + mainPeak + earlyPeak + bumps
        break
      }
      default:
        yRaw = 0.2 + 0.18 * Math.sin(t * 5 * Math.PI + phase)
    }
    const yScaled = Math.max(0, Math.min(1, yRaw * heightScale * 1.15))
    const x = t * inner + PADDING_X
    const y = HEIGHT - PADDING_Y_BOT - yScaled * usable
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return `M ${PADDING_X},${HEIGHT - PADDING_Y_BOT} L ${points.join(' L ')} L ${WIDTH - PADDING_X},${HEIGHT - PADDING_Y_BOT} Z`
}

// ── Hovedkomponent ─────────────────────────────────────────────────────────

export default function StageProfileSilhouette({
  profile, verticalMeters, distanceKm, profileScore, stageNumber, climbs,
}: Props) {
  const vm = verticalMeters ?? 1200
  const ps = profileScore ?? 100

  const useRealClimbs = climbs && climbs.length > 0
  // Har vi præcise positioner (afviklede etaper via KOM-data)? Hvis ja kan vi
  // tegne en realistisk silhuet. Hvis kun navne (kommende etaper), tegner vi
  // den procedurale silhuet og lister i stedet de RIGTIGE klatrings-navne
  // nedenunder — så brugeren ser etapens faktiske bjerge uden falsk præcision.
  const hasPositions = useRealClimbs && climbs!.some((c) => c.km_from_start != null && c.km_from_start > 0)

  let path: string
  let peaks: { x: number; y: number; name: string; gradient: number }[] = []
  if (hasPositions) {
    const built = buildPathFromClimbs(climbs!, distanceKm)
    path = built.path
    peaks = built.peaks
  } else {
    path = buildProceduralPath(profile, vm, ps, stageNumber)
  }

  const stats: string[] = []
  if (distanceKm != null && distanceKm > 0) stats.push(`${distanceKm} km`)
  if (verticalMeters != null && verticalMeters > 0) stats.push(`↑ ${verticalMeters.toLocaleString()} m`)

  const climbNames = useRealClimbs ? climbs!.map((c) => c.name) : []

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
        style={{ width: '100%', height: 96, display: 'block' }}
      >
        <line
          x1={0} y1={HEIGHT * 0.6}
          x2={WIDTH} y2={HEIGHT * 0.6}
          stroke="rgba(255,255,255,0.07)" strokeWidth={0.8} strokeDasharray="3,5"
        />
        <path
          d={path}
          fill="rgba(143,171,196,0.32)"
          stroke="rgba(143,171,196,0.85)"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        {/* Peak labels for de 3 største klatringer */}
        {peaks.map((p, i) => (
          <g key={i}>
            <text
              x={p.x}
              y={Math.max(p.y - 4, 9)}
              fontSize={8}
              fontFamily="'Barlow Condensed', sans-serif"
              fontWeight={700}
              fill="rgba(255,255,255,0.75)"
              textAnchor="middle"
            >
              {p.name.length > 18 ? `${p.name.slice(0, 16)}…` : p.name}
            </text>
          </g>
        ))}
      </svg>
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
      <div style={{
        position: 'absolute', bottom: 4, left: 7,
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 8,
        color: 'rgba(255,255,255,0.32)', fontWeight: 600,
        letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        {hasPositions ? 'PCS profil-data' : 'Stiliseret silhuet'}
      </div>

      {/* Rigtige klatrings-navne fra PCS — vist når vi har dem (også når
          silhuetten kun er stiliseret, så brugeren ser etapens faktiske
          bjerge). */}
      {climbNames.length > 0 && (
        <div style={{
          padding: '7px 9px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center',
        }}>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9,
            color: 'rgba(255,255,255,0.4)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Stigninger
          </span>
          {climbNames.map((name, i) => (
            <span key={i} style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
              fontWeight: 600, color: 'rgba(255,255,255,0.8)',
              padding: '1px 7px', borderRadius: 2,
              background: 'rgba(143,171,196,0.14)',
              border: '1px solid rgba(143,171,196,0.22)',
            }}>
              {climbs![i].category != null ? `${climbs![i].category}· ` : ''}{name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
