import React from 'react'
import { Activity, Users, User, Compass, Database, Zap } from 'lucide-react'
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
  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(8, 12, 22, 0.85)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(56, 189, 248, 0.4)'
          }}>
            <Activity size={20} color="#031120" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: '1.125rem', letterSpacing: '-0.02em' }}>
                TMS Intelligence
              </span>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4,
                background: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--accent-cyan)',
                border: '1px solid rgba(56, 189, 248, 0.3)'
              }}>
                MVP v1.0
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Transaction & Effort Intelligence Platform
            </div>
          </div>
        </div>

        {/* View Switcher Navigation */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className={`btn-ghost ${currentView === 'associate' ? 'active' : ''}`}
            onClick={() => setCurrentView('associate')}
          >
            <User size={16} />
            <span>Associate Workspace</span>
          </button>

          <button
            className={`btn-ghost ${currentView === 'supervisor' ? 'active' : ''}`}
            onClick={() => setCurrentView('supervisor')}
          >
            <Users size={16} />
            <span>Supervisor Overview</span>
          </button>

          <button
            className={`btn-ghost ${currentView === 'claim' ? 'active' : ''}`}
            onClick={() => setCurrentView('claim')}
          >
            <Compass size={16} />
            <span>Claim Deep Dive</span>
          </button>
        </nav>

        {/* Status & Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Mock Mode Switcher */}
          <button
            onClick={() => {
              const next = !isMock
              CONFIG.USE_MOCK = next
              setIsMock(next)
            }}
            style={{
              background: isMock ? 'rgba(245, 158, 11, 0.12)' : 'rgba(52, 211, 153, 0.12)',
              border: `1px solid ${isMock ? 'rgba(245, 158, 11, 0.3)' : 'rgba(52, 211, 153, 0.3)'}`,
              color: isMock ? 'var(--accent-amber)' : 'var(--accent-emerald)',
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '6px 10px',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
            title="Toggle between mock fixtures and live FastAPI backend"
          >
            <Database size={13} />
            <span>{isMock ? 'Mock Fixtures' : 'Live Backend'}</span>
          </button>

          {/* Associate Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: 8,
            border: '1px solid var(--border-subtle)'
          }}>
            <span className="pulse-dot"></span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)' }}>
              {associateName}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
