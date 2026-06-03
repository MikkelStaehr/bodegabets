'use client'

import { useEffect, useState } from 'react'
import type { PreviewResponse } from '@/app/api/cycling/preview-blocks/route'

type Props = {
  /** Aktuelt valgte race-ids fra wizard'en — komponenten fetcher når dette ændrer sig. */
  raceIds: string[]
}

/**
 * Viser forhåndsvisning af hvilke blokke der vil blive lavet for de valgte løb.
 * Læser fra /api/cycling/preview-blocks som bruger NØJAGTIGT samme logik som
 * generateCyclingBlocks (computeSubBlockRanges) — så det du ser her er det
 * du faktisk får.
 *
 * Bruges i:
 *   - NewCyclingGameForm (game creation wizard)
 *   - AddRacesForm (add-races flow)
 */
export default function CyclingBlocksPreview({ raceIds }: Props) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [loading, setLoading] = useState(false)

  // Deterministisk key for raceIds — fetch kun når selektion faktisk ændres
  const raceIdsKey = [...raceIds].sort().join(',')

  useEffect(() => {
    if (raceIds.length === 0) {
      setPreview({ bundles: [], blocks: [] })
      return
    }
    let cancelled = false
    setLoading(true)
    fetch('/api/cycling/preview-blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ race_ids: raceIds }),
    })
      .then((r) => r.json())
      .then((data: PreviewResponse) => { if (!cancelled) setPreview(data) })
      .catch(() => { if (!cancelled) setPreview({ bundles: [], blocks: [] }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceIdsKey])

  if (raceIds.length === 0) return null

  const hasContent = preview && (preview.bundles.length > 0 || preview.blocks.length > 0)
  const hasWarning = preview?.blocks.some((b) => b.is_grand_tour && b.fallback_used)

  return (
    <div className="bg-cream-dark border border-warm-border rounded-sm p-5 mb-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="font-condensed text-[11px] font-bold tracking-[0.08em] uppercase text-warm-gray">
          Forhåndsvisning af blokke
        </p>
        {loading && (
          <span className="font-condensed text-[10px] text-warm-gray uppercase tracking-[0.08em]">Beregner …</span>
        )}
      </div>

      {!loading && !hasContent && (
        <p className="font-body text-[12px] text-warm-gray">Ingen blokke at vise.</p>
      )}

      {hasWarning && (
        <div
          className="rounded-sm p-3 mb-3 border"
          style={{ background: 'rgba(184,150,62,0.12)', borderColor: 'rgba(184,150,62,0.35)' }}
        >
          <p className="font-condensed text-[11px] font-bold text-[#8B6F1F] uppercase tracking-[0.08em] mb-1">
            Mangler hviledage
          </p>
          <p className="font-body text-[12px] text-ink/80 leading-relaxed">
            En eller flere Grand Tours mangler hviledage i databasen. Sub-blokke
            opdeles automatisk i 3 lige uger som fallback — ret hviledagene
            i databasen for korrekt opdeling pr. uge.
          </p>
        </div>
      )}

      {/* Bundles (klassiker-pakker) */}
      {preview?.bundles.map((bundle) => (
        <div key={bundle.key} className="border border-warm-border rounded-sm bg-cream p-3 mb-2">
          <p className="font-condensed text-[13px] font-bold text-ink">
            {bundle.label}
          </p>
          <p className="font-body text-[11px] text-warm-gray mt-0.5">
            {bundle.races.length} løb: {bundle.races.join(', ')}
          </p>
        </div>
      ))}

      {/* Stage races + one-day races */}
      {preview?.blocks.map((block) => (
        <div key={block.race_id ?? block.race_name} className="border border-warm-border rounded-sm bg-cream p-3 mb-2">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <p className="font-condensed text-[13px] font-bold text-ink">
              {block.race_name}
            </p>
            {block.is_grand_tour && (
              <span className="font-condensed text-[9px] font-bold uppercase tracking-[0.08em] text-[#1E3A5F] bg-[#1E3A5F]/10 px-2 py-0.5 rounded-full">
                Grand Tour
              </span>
            )}
          </div>
          <p className="font-body text-[11px] text-warm-gray mt-0.5">
            {block.race_type === 'stage_race'
              ? `${block.stage_count} etaper`
              : 'Endags-løb'}
            {block.sub_blocks.length > 0 && ` · ${block.sub_blocks.length} sub-blokke`}
          </p>

          {block.sub_blocks.length > 0 && (
            <div className="mt-2 pt-2 border-t border-warm-border/60 space-y-1">
              {block.sub_blocks.map((sb, idx) => (
                <div key={idx} className="flex items-baseline justify-between gap-3">
                  <span className="font-condensed text-[12px] font-semibold text-ink">
                    {sb.label}
                  </span>
                  <span className="font-condensed text-[11px] text-warm-gray">
                    Etape {sb.range[0]}–{sb.range[1]} · {sb.stage_count} etaper
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
