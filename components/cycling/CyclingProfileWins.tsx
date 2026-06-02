import { supabaseAdmin } from '@/lib/supabase'
import { shortSubBlockName } from '@/lib/cyclingBlocks'

type Win = {
  block_id: string
  block_name: string
  game_id: number
  game_name: string
  points: number
  finalized_at: string | null
  is_sub_block: boolean
}

/**
 * Server-component: viser alle blok-sejre for en given bruger på tværs af spil.
 * Henter direkte fra cycling_blocks.winner_user_id (sat ved auto-finalize).
 *
 * Trofæerne pyntes med kontekst: hvilket spil, hvilken blok (Giro Uge 1, Tour
 * totalvinder, etc.), point og dato. Ingen klik-handlers — det er en CV-visning.
 */
export default async function CyclingProfileWins({ userId }: { userId: string }) {
  // Hent alle blokke vundet af brugeren — paginer ikke, vi forventer < 100 sejre
  const { data: wonBlocks } = await supabaseAdmin
    .from('cycling_blocks')
    .select('id, game_id, name, parent_block_id, winner_points, finalized_at')
    .eq('winner_user_id', userId)
    .order('finalized_at', { ascending: false })

  if (!wonBlocks || wonBlocks.length === 0) {
    return (
      <div className="bg-cream-dark border border-warm-border rounded-sm p-5 mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-condensed text-[14px] font-bold text-ink tracking-[0.04em]">Cykel-sejre</h2>
          <span className="font-condensed text-[10px] text-warm-gray uppercase tracking-[0.08em]">Endnu ingen</span>
        </div>
        <p className="font-body text-[12px] text-warm-gray leading-relaxed">
          Når du vinder en blok eller en uge i et Grand Tour, dukker den op her.
        </p>
      </div>
    )
  }

  // Hent game-navne for de spil hvor brugeren har sejre
  const gameIds = [...new Set(wonBlocks.map((b) => b.game_id as number))]
  const { data: games } = await supabaseAdmin
    .from('games')
    .select('id, name')
    .in('id', gameIds)
  const gameNameMap = new Map<number, string>()
  for (const g of games ?? []) gameNameMap.set(g.id as number, g.name as string)

  const wins: Win[] = wonBlocks.map((b) => ({
    block_id: b.id as string,
    block_name: shortSubBlockName((b.name as string) ?? ''),
    game_id: b.game_id as number,
    game_name: gameNameMap.get(b.game_id as number) ?? '—',
    points: Number(b.winner_points) || 0,
    finalized_at: (b.finalized_at as string | null) ?? null,
    is_sub_block: b.parent_block_id != null,
  }))

  return (
    <div className="bg-cream-dark border border-warm-border rounded-sm p-5 mb-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-condensed text-[14px] font-bold text-ink tracking-[0.04em]">Cykel-sejre</h2>
        <span className="font-condensed text-[11px] font-bold text-[#8B6F1F] uppercase tracking-[0.08em]">
          {wins.length} {wins.length === 1 ? 'sejr' : 'sejre'}
        </span>
      </div>

      <div className="space-y-2">
        {wins.map((win) => (
          <div
            key={win.block_id}
            className="border border-warm-border rounded-sm p-3 bg-cream flex items-start gap-3"
          >
            {/* Trofæ-ikon i SVG */}
            <svg
              width="20" height="20" viewBox="0 0 24 24" fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="flex-shrink-0 mt-0.5"
              style={{ color: '#B8963E' }}
            >
              <path
                d="M6 9a6 6 0 0012 0V3H6v6zM3 5h3v4a3 3 0 01-3-3V5zm15 0h3v1a3 3 0 01-3 3V5zM9 21h6m-3-6v6"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>

            <div className="min-w-0 flex-1">
              <p className="font-condensed text-[13px] font-bold text-ink leading-tight">
                {win.block_name}
              </p>
              <p className="font-body text-[11px] text-warm-gray mt-0.5">
                {win.game_name}
                {win.finalized_at && (
                  <span className="ml-2 text-warm-gray/70">
                    {new Date(win.finalized_at).toLocaleDateString('da-DK', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </span>
                )}
              </p>
            </div>

            <span className="font-condensed text-[13px] font-bold text-ink whitespace-nowrap">
              {Math.round(win.points * 10) / 10} pt
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
