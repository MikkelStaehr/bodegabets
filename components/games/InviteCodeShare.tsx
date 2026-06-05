'use client'

import { useEffect, useState } from 'react'

export default function InviteCodeShare({ code }: { code: string }) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [origin, setOrigin] = useState('')

  // window.location.origin er kun tilgængelig på klienten
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const inviteUrl = origin ? `${origin}/join/${code}` : `/join/${code}`

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      return true
    }
  }

  async function handleCopyLink() {
    await copyToClipboard(inviteUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  async function handleCopyCode() {
    await copyToClipboard(code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const waText = encodeURIComponent(`Join mit Bodega Bets spilrum: ${inviteUrl}`)
  const waUrl = `https://wa.me/?text=${waText}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Kode + link display */}
      <div style={{ background: 'rgba(242,237,228,0.08)', border: '1px solid rgba(242,237,228,0.2)', borderRadius: 2, padding: '8px 14px', textAlign: 'center', flexShrink: 0 }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(242,237,228,0.5)', marginBottom: 4 }}>Invitationskode</p>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: '0.15em', color: '#F2EDE4' }}>{code}</p>
      </div>

      {/* Primær: kopiér link + WhatsApp */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={handleCopyLink}
          style={{
            flex: 1,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: 'rgba(242,237,228,0.08)',
            border: '1px solid rgba(242,237,228,0.2)',
            borderRadius: 2,
            color: copiedLink ? '#27ae60' : 'rgba(242,237,228,0.85)',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {copiedLink ? (
            '✓ Link kopieret!'
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
              Kopiér link
            </>
          )}
        </button>

        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="md:hidden"
          style={{
            minHeight: 44,
            minWidth: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: '#25D366',
            borderRadius: 2,
            color: '#fff',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            textDecoration: 'none',
            padding: '0 12px',
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Del
        </a>
      </div>

      {/* Sekundær: kopiér kun koden (for spillere der vil paste manuelt) */}
      <button
        type="button"
        onClick={handleCopyCode}
        style={{
          minHeight: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          background: 'transparent',
          border: 'none',
          color: copiedCode ? '#27ae60' : 'rgba(242,237,228,0.5)',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.08em',
          textTransform: 'uppercase' as const,
          cursor: 'pointer',
        }}
      >
        {copiedCode ? '✓ Kode kopieret' : 'Kopiér kun koden'}
      </button>
    </div>
  )
}
