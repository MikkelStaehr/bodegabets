'use client'

type Props = { gameId: number; isHost: boolean }

export default function LeaveGameButton({ gameId, isHost }: Props) {
  if (isHost) return null

  async function handleLeave() {
    // Tjek om brugeren er sidst tilbage
    const countRes = await fetch(`/api/games/${gameId}/members/count`)
    const { memberCount } = await countRes.json()

    const isLast = memberCount <= 1
    const message = isLast
      ? 'Du er den sidste deltager. Spilrummet slettes permanent — alle bets og resultater forsvinder. Er du sikker?'
      : 'Er du sikker på du vil forlade spilrummet? Dine bets i dette spilrum slettes.'

    if (!window.confirm(message)) return

    const res = await fetch(`/api/games/${gameId}/leave`, { method: 'DELETE' })
    const data = await res.json()

    if (!res.ok) {
      alert(data.error)
      return
    }

    window.location.href = '/dashboard'
  }

  return (
    <button
      type="button"
      onClick={handleLeave}
      className="text-xs uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity mt-4"
      style={{ color: '#F2EDE4' }}
    >
      Forlad spilrum
    </button>
  )
}
