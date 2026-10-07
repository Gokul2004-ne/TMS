import React from 'react'
import { Activity, Users, User, Compass, Database } from 'lucide-react'
import { CONFIG } from '../config'

interface NavbarProps {
  currentView: 'associate' | 'supervisor' | 'claim'
  setCurrentView: (v: 'associate' | 'supervisor' | 'claim') => void
  isMock: boolean
  setIsMock: (m: boolean) => void
  associateName: string
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  isMock,
  setIsMock,
  associateName
}) => {
  const initials = associateName
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <header
      style={{
        background: '#ffffff',
        borderBottom: '2px solid #0f172a',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: 56,
        display: 'flex',
        alignItems: 'center',
        boxShadow: '0 1px 0 #e2e8f0, 0 2px 8px rgba(15,23,42,.06)'
      }}
    >
      <div
        style={{
          maxWidth: 1480,
          width: '100%',
          margin: '0 auto',
          padding: '0 28px',
          display: 'flex',
          alignItems: 'center',
          height: '100%'
        }}
      >
        {/* ── Brand ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div
            style={{
              width: 30,
              height: 30,
              background: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Activity size={16} color="#ffffff" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: '0.9375rem',
                  letterSpacing: '-0.025em',
                  color: '#0f172a'
                }}
              >
                NovaArc TMS
              </span>
              <span
                style={{
                  fontSize: '0.5625rem',
                  fontWeight: 700,
                  padding: '1px 5px',
                  background: '#f1f5f9',
                  color: '#0f172a',
                  border: '1px solid #e2e8f0',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}
              >
                v1.0
              </span>
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#475569', letterSpacing: '0.01em' }}>
              Transaction & Effort Intelligence
            </div>
          </div>
        </div>

        {/* ── Vertical Divider ── */}
        <div
          style={{
            width: 1,
            height: 22,
            background: '#e2e8f0',
            margin: '0 22px',
            flexShrink: 0
          }}
        />

        {/* ── Navigation tabs ── */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 0, height: '100%', flex: 1 }}>
          {(
            [
              { id: 'associate', label: 'Associate Workspace', icon: <User size={14} /> },
              { id: 'supervisor', label: 'Supervisor Overview', icon: <Users size={14} /> },
              { id: 'claim',     label: 'Claim Deep Dive',    icon: <Compass size={14} /> }
            ] as const
          ).map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setCurrentView(id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                height: '100%',
                padding: '0 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: currentView === id
                  ? '2px solid #0f172a'
                  : '2px solid transparent',
                color: currentView === id ? '#0f172a' : '#334155',
                fontSize: '0.8125rem',
                fontWeight: currentView === id ? 800 : 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'color 0.12s ease, border-color 0.12s ease',
                letterSpacing: '0.005em',
                flexShrink: 0
              }}
              onMouseEnter={e => {
                if (currentView !== id) {
                  (e.currentTarget as HTMLButtonElement).style.color = '#0f172a'
                }
              }}
              onMouseLeave={e => {
                if (currentView !== id) {
                  (e.currentTarget as HTMLButtonElement).style.color = '#334155'
                }
              }}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* ── Right-side controls ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {/* Live Status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: '#059669',
              letterSpacing: '0.06em',
              textTransform: 'uppercase'
            }}
            title="NovaArc RCM Platform connected"
          >
            <span
              style={{
                width: 6,
                height: 6,
                background: '#059669',
                display: 'inline-block',
                animation: 'pulseFade 2s infinite'
              }}
            />
            NovaArc Active
          </div>

          {/* Mock / Live Toggle */}
          <button
            onClick={() => {
              const next = !isMock
              CONFIG.USE_MOCK = next
              setIsMock(next)
            }}
            title="Toggle mock fixtures ↔ live FastAPI backend"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 11px',
              background: isMock ? '#fffbeb' : '#f0fdf4',
              border: `1px solid ${isMock ? '#fde68a' : '#bbf7d0'}`,
              color: isMock ? '#d97706' : '#059669',
              fontSize: '0.6875rem',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              transition: 'all 0.12s ease'
            }}
          >
            <Database size={12} />
            {isMock ? 'Mock' : 'Live'}
          </button>

          {/* Associate Avatar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 12px',
              border: '1px solid #0f172a',
              background: '#ffffff',
              cursor: 'default'
            }}
            title={associateName}
          >
            <div
              style={{
                width: 24,
                height: 24,
                background: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.625rem',
                fontWeight: 800,
                color: '#fff',
                letterSpacing: '0.04em',
                flexShrink: 0
              }}
            >
              {initials}
            </div>
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#0f172a',
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {associateName}
            </span>
            <span
              style={{
                width: 6,
                height: 6,
                background: '#059669',
                display: 'inline-block',
                animation: 'pulseFade 2s infinite',
                flexShrink: 0
              }}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
