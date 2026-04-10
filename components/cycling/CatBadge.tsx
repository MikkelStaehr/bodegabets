import { CAT_LABELS, CAT_COLORS } from '@/lib/cyclingUtils'

export default function CatBadge({ cat }: { cat: number }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '1px 6px', borderRadius: 2,
      background: `${CAT_COLORS[cat] ?? '#7A7060'}18`,
      color: CAT_COLORS[cat] ?? '#7A7060',
      fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10,
      fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1.4,
    }}>
      {CAT_LABELS[cat] ?? `K${cat}`}
    </span>
  )
}
