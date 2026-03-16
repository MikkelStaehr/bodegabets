'use client'

import { useState } from 'react'
import OverblikTab from './tabs/OverblikTab'
import LigaerTab from './tabs/LigaerTab'
import SpilrumTab from './tabs/SpilrumTab'
import { AdminUsersTab } from './tabs/AdminUsersTab'
import LogsTab from './tabs/LogsTab'
const NAV = [
  { section: 'Oversigt', items: [
    { id: 'overblik',  label: 'Overblik',   dot: '#B8963E' },
    { id: 'logs',      label: 'Logs',        dot: null, badge: true },
  ]},
  { section: 'Konfiguration', items: [
    { id: 'ligaer',    label: 'Ligaer',      dot: null },
    { id: 'spilrum',   label: 'Spilrum',     dot: null },
    { id: 'brugere',   label: 'Brugere',     dot: null },
  ]},
] as const

type TabId = 'overblik' | 'logs' | 'ligaer' | 'spilrum' | 'brugere'

export default function AdminShell({ initialTab, adminSecret }: { initialTab: string, adminSecret?: string }) {
  const [active, setActive] = useState<TabId>((initialTab as TabId) || 'overblik')

  function go(id: TabId) {
    setActive(id)
    window.history.replaceState(null, '', `/admin?tab=${id}`)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2EDE4' }}>

      {/* Sidebar */}
      <div style={{
        width: '200px', flexShrink: 0, background: '#2C4A3E',
        display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(242,237,228,0.1)' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '17px', color: '#F2EDE4' }}>Bodega Bets</div>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(242,237,228,0.35)', marginTop: '3px' }}>Admin panel</div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {NAV.map(section => (
            <div key={section.section} style={{ padding: '12px 12px 4px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(242,237,228,0.3)', padding: '0 8px', marginBottom: '4px' }}>
                {section.section}
              </div>
              {section.items.map((item: { id: TabId; label: string; dot: string | null; badge?: boolean }) => (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '9px', width: '100%',
                    padding: '8px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                    background: active === item.id ? 'rgba(242,237,228,0.1)' : 'transparent',
                    color: active === item.id ? '#F2EDE4' : 'rgba(242,237,228,0.55)',
                    fontSize: '12px', fontWeight: 500, textAlign: 'left',
                    fontFamily: 'sans-serif',
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: item.dot ?? (active === item.id ? 'rgba(242,237,228,0.6)' : 'rgba(242,237,228,0.2)'), display: 'inline-block' }} />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(242,237,228,0.08)' }}>
          <a href="/dashboard" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(242,237,228,0.35)', textDecoration: 'none', display: 'block' }}>
            ← Tilbage til appen
          </a>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: '32px 36px', minWidth: 0 }}>
        {active === 'overblik'  && <OverblikTab />}
        {active === 'ligaer'    && <LigaerTab />}
        {active === 'spilrum'   && <SpilrumTab />}
        {active === 'brugere'   && <AdminUsersTab adminSecret={adminSecret ?? ''} />}
        {active === 'logs'      && <LogsTab />}
      </div>
    </div>
  )
}
