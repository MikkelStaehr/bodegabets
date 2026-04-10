'use client'

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{
      maxWidth: 480, margin: '80px auto', padding: 32,
      background: '#FDFAF5', border: '1px solid #E8E0D3', borderRadius: 2,
      textAlign: 'center',
    }}>
      <h2 style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700,
        color: '#1a1a1a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        Noget gik galt
      </h2>
      <p style={{
        fontFamily: "'Barlow', sans-serif", fontSize: 14, color: '#5C5C4A',
        marginBottom: 20, lineHeight: 1.5,
      }}>
        {error.message || 'En uventet fejl opstod. Prøv igen.'}
      </p>
      <button
        onClick={reset}
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          padding: '10px 24px', border: '1px solid #D4CFC4', borderRadius: 2,
          background: '#F5F0E8', color: '#1a1a1a', cursor: 'pointer',
        }}
      >
        Prøv igen
      </button>
    </div>
  )
}
