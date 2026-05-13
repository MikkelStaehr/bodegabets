import { getJerseyStyle, type JerseyKey } from '@/lib/cyclingJerseys'

/**
 * SVG cycling jersey icon med race-specifik farve. Bruges som visual cue
 * i picker, lineup-display og klassement-card i stedet for tekst-pills.
 *
 * Trøjedesign:
 *  - Trapezoid body med sleeve-flares for skulder/ærme
 *  - V-neck cutout
 *  - Subtil sponsor-stripe på tværs af midten (eller polka dots for bjerg)
 */
export default function JerseyIcon({
  jersey,
  raceName,
  size = 20,
  title,
}: {
  jersey: JerseyKey
  raceName: string | null | undefined
  size?: number
  title?: string
}) {
  const style = getJerseyStyle(raceName, jersey)
  const polka = style.polkaDots

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
      aria-label={title ?? `${jersey} trøje`}
    >
      {title && <title>{title}</title>}
      <defs>
        {polka && (
          <pattern id={`polka-${jersey}`} x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill={polka.base} />
            <circle cx="2" cy="2" r="0.9" fill={polka.dot} />
          </pattern>
        )}
      </defs>
      {/* Jersey silhouette: shoulders + sleeves + body */}
      <path
        d="M 6 5 L 9 3 Q 10 3.8 12 4 Q 14 3.8 15 3 L 18 5 L 21 7 L 19.5 9.5 L 17 8.5 L 17 21 L 7 21 L 7 8.5 L 4.5 9.5 L 3 7 Z"
        fill={polka ? `url(#polka-${jersey})` : style.bg}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      {/* Sponsor stripe (kun hvis ingen polka) */}
      {!polka && style.stripe && (
        <rect x="7" y="13" width="10" height="1.8" fill={style.stripe} opacity="0.85" />
      )}
      {/* V-neck accent */}
      <path
        d="M 10.5 3.5 L 12 5.5 L 13.5 3.5"
        fill="none"
        stroke="rgba(0,0,0,0.2)"
        strokeWidth="0.4"
      />
    </svg>
  )
}
