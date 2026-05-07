'use client'

import Link from 'next/link'
import { BookOpen } from 'lucide-react'

const ROLES = [
  {
    role: 'Leader',
    color: '#FAC775',
    bg: '#633806',
    cat: 'Alle',
    score: 'Placering × kat-mul',
    bonus: '+5 hvis vinderhold',
  },
  {
    role: 'Lieutenant',
    color: '#B5D4F4',
    bg: '#0C447C',
    cat: 'Kat 2–3',
    score: 'Top 10 → ×1.8',
    bonus: '×2.8 hvis Leader DNF',
  },
  {
    role: 'Grimpeur',
    color: '#9FE1CB',
    bg: '#085041',
    cat: 'Kat 3–5',
    score: 'Mountain ×1.8 · Hilly ×1.2',
    bonus: 'Solo / sprint à deux bonus',
  },
  {
    role: 'Sprinter',
    color: '#F5C4B3',
    bg: '#712B13',
    cat: 'Kat 1–3',
    score: 'Flat ×1.8 · Hilly ×1.2',
    bonus: 'Bunch / small group bonus',
  },
  {
    role: 'Domestique',
    color: '#C0DD97',
    bg: '#27500A',
    cat: 'Kun Kat 4',
    score: 'Ingen multiplier',
    bonus: '+8 hvis top 40 + Leader top 10',
  },
  {
    role: 'Équipier (×2)',
    color: '#D3D1C7',
    bg: '#444441',
    cat: 'Alle',
    score: 'Ingen multiplier',
    bonus: '+7 hvis vinderhold',
  },
  {
    role: 'Joker',
    color: '#CECBF6',
    bg: '#3C3489',
    cat: 'Alle',
    score: 'Ingen multiplier',
    bonus: '+7 vinderhold · DNF-immun',
  },
]

export default function RolesGuide() {
  return (
    <div style={{ marginTop: 24 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 10,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#6b6b6b',
          }}
        >
          Roller & point
        </span>
        <Link
          href="/games/cycling-guide"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: '#1E3A5F',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <BookOpen size={12} />
          Se hele regelsættet →
        </Link>
      </div>

      {/* Table */}
      <div
        style={{
          background: '#FDFAF5',
          border: '1px solid #E8E0D3',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        {/* Column headers — desktop only */}
        <div
          className="roles-grid roles-header"
          style={{
            display: 'none',
            padding: '8px 12px',
            borderBottom: '1px solid #E8E0D3',
            background: '#F8F5ED',
            gap: 12,
            alignItems: 'center',
          }}
        >
          {['Rolle', 'Kategori', 'Point', 'Bonus'].map((h, i) => (
            <span
              key={i}
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#9E9486',
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {ROLES.map((r, idx) => (
          <div
            key={r.role}
            className="roles-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              padding: '10px 12px',
              borderBottom: idx < ROLES.length - 1 ? '1px solid #E8E0D3' : 'none',
              gap: 4,
              alignItems: 'flex-start',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 'fit-content',
                padding: '2px 8px',
                background: r.color,
                color: r.bg,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 2,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {r.role}
            </span>
            <span
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 11,
                color: '#6b6b6b',
                fontWeight: 600,
              }}
            >
              {r.cat}
            </span>
            <span
              style={{
                fontFamily: "'Barlow', sans-serif",
                fontSize: 12,
                color: '#1a1a1a',
                lineHeight: 1.3,
              }}
            >
              {r.score}
            </span>
            <span
              style={{
                fontFamily: "'Barlow', sans-serif",
                fontSize: 11,
                color: '#7a7060',
                lineHeight: 1.3,
              }}
            >
              {r.bonus}
            </span>
          </div>
        ))}
      </div>

      {/* Mini bullet med basispoint + kat-mul */}
      <div
        style={{
          marginTop: 8,
          padding: '8px 12px',
          background: '#F8F5ED',
          border: '1px solid #E8E0D3',
          borderRadius: 2,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11,
          color: '#6b6b6b',
          lineHeight: 1.5,
        }}
      >
        <strong>Basispoint:</strong> 1.→50 · 2-3.→30 · 4-5.→20 · 6-10.→10 · 11-20.→5
        <br />
        <strong>Kat-multiplier:</strong> Kat 1 ×1.0 · Kat 2 ×1.3 · Kat 3 ×1.7 · Kat 4 ×2.2 · Kat 5 ×3.5
      </div>

      {/* Desktop: 4-column layout */}
      <style>{`
        @media (min-width: 640px) {
          .roles-header { display: grid !important; grid-template-columns: 130px 90px 1fr 1fr !important; }
          .roles-grid:not(.roles-header) { grid-template-columns: 130px 90px 1fr 1fr !important; align-items: center !important; }
        }
      `}</style>
    </div>
  )
}
