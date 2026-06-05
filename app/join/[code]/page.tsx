import { redirect } from 'next/navigation'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import JoinClient from './JoinClient'

type Props = { params: Promise<{ code: string }> }

/**
 * Auto-join via invite-link: /join/ABC123
 *
 * - Ikke logget ind: redirect til /login?next=/join/ABC123
 *   (efter login bringes brugeren tilbage hertil og auto-joiner)
 * - Logget ind + ikke medlem: kalder POST /api/games/join + redirecter
 *   til gameroom
 * - Logget ind + allerede medlem: redirecter direkte til gameroom
 * - Ugyldig kode: viser fejl-side med link til dashboard
 */
export default async function JoinPage({ params }: Props) {
  const { code: rawCode } = await params
  const code = rawCode.toUpperCase().trim()

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Ikke logget ind → send til login med next-param tilbage hertil
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join/${code}`)}`)
  }

  // Slå spillet op via invite-koden
  const { data: game } = await supabaseAdmin
    .from('games')
    .select('id, name, status')
    .eq('invite_code', code)
    .maybeSingle()

  if (!game) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-warm-border rounded-sm p-8 text-center">
          <p className="font-condensed text-[11px] uppercase tracking-[0.14em] text-warm-gray mb-2">Ugyldig invitation</p>
          <h1 className="font-display text-2xl text-forest font-bold mb-3">Spilrum ikke fundet</h1>
          <p className="font-body text-sm text-warm-gray mb-6">
            Koden &quot;{code}&quot; matcher ikke noget spilrum. Tjek linket og prøv igen, eller bed værten om at sende en ny invitation.
          </p>
          <a
            href="/dashboard"
            className="inline-block px-5 py-3 bg-forest text-cream font-condensed font-bold text-sm uppercase tracking-[0.08em] rounded-sm"
          >
            Til dashboard
          </a>
        </div>
      </div>
    )
  }

  // Tjek om brugeren allerede er medlem
  const { data: existingMember } = await supabaseAdmin
    .from('game_members')
    .select('id')
    .eq('game_id', game.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingMember) {
    redirect(`/games/${game.id}`)
  }

  // Ny tilmelding — overlader til klient-component der kalder POST /api/games/join
  // (samme rate-limiter + validering som JoinGameCard)
  return <JoinClient code={code} gameName={game.name as string} />
}
