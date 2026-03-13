'use client'

import { useEffect, useState } from 'react'

export default function SpilrumTab() {
  const [games, setGames] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)

  async function search(q = query) {
    setLoading(true)
    const d = await fetch(`/api/admin/games/search?q=${encodeURIComponent(q)}`).then(r => r.json())
    setGames(d.games || [])
    setLoading(false)
  }

  useEffect(() => { search('') }, [])

  return (
    <div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: '26px', color: '#2C4A3E', marginBottom: '24px', letterSpacing: '-0.01em' }}>Spilrum</div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Søg på navn eller invitationskode…"
          style={{ flex: 1, fontFamily: 'sans-serif', fontSize: '13px', padding: '10px 14px', border: '1px solid rgba(44,74,62,0.2)', borderRadius: '3px', background: '#fff', color: '#2C4A3E', outline: 'none' }}
        />
        <button
          onClick={() => search()}
          style={{ fontFamily: 'sans-serif', fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '10px 20px', background: '#2C4A3E', color: '#F2EDE4', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
        >
          Søg
        </button>
      </div>

      {/* Tabel header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 80px', gap: '12px', padding: '0 16px 8px', borderBottom: '1px solid rgba(44,74,62,0.1)' }}>
        {['Navn', 'Kode', 'Deltagere', 'Status', ''].map(h => (
          <span key={h} style={{ fontFamily: 'sans-serif', fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8C8C78' }}>{h}</span>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
        {loading && <div style={{ fontFamily: 'sans-serif', fontSize: '12px', color: '#8C8C78', padding: '16px 0' }}>Henter…</div>}
        {!loading && games.length === 0 && (
          <div style={{ fontFamily: 'sans-serif', fontSize: '12px', color: '#8C8C78', padding: '16px 0' }}>Ingen spilrum fundet</div>
        )}
        {games.map((game: any) => (
          <div key={game.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 80px', gap: '12px', alignItems: 'center', padding: '12px 16px', background: '#fff', border: '1px solid rgba(44,74,62,0.08)', borderRadius: '3px' }}>
            <div>
              <div style={{ fontFamily: 'sans-serif', fontSize: '13px', fontWeight: 700, color: '#2C4A3E' }}>{game.name}</div>
              <div style={{ fontFamily: 'sans-serif', fontSize: '10px', color: '#8C8C78', marginTop: '2px' }}>ID {game.id}</div>
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#5C5C4A', letterSpacing: '0.08em' }}>{game.invite_code}</span>
            <span style={{ fontFamily: 'sans-serif', fontSize: '12px', color: '#2C4A3E', textAlign: 'center' }}>{game.member_count ?? '—'}</span>
            <span style={{
              fontFamily: 'sans-serif', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              padding: '3px 8px', borderRadius: '2px', display: 'inline-block',
              background: game.status === 'active' ? 'rgba(44,74,62,0.08)' : 'rgba(139,139,120,0.1)',
              color: game.status === 'active' ? '#2C4A3E' : '#8C8C78',
            }}>{game.status ?? 'active'}</span>
            <a href={`/games/${game.id}`} target="_blank" style={{ fontFamily: 'sans-serif', fontSize: '11px', color: '#B8963E', textDecoration: 'none', textAlign: 'right' }}>
              Åbn →
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
