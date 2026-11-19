import React, { useState } from 'react'
import {
  Activity,
  Users,
  User,
  Compass,
  Database,
  PieChart,
  LogOut,
  ChevronDown
} from 'lucide-react'
import { CONFIG } from '../config'
import { useAuth, PRESET_USERS } from '../context/AuthContext'

interface NavbarProps {
  currentView: 'associate' | 'supervisor' | 'leader' | 'claim'
  setCurrentView: (v: 'associate' | 'supervisor' | 'leader' | 'claim') => void
  isMock: boolean
  setIsMock: (m: boolean) => void
  selectedAssociateId: string
  onSelectAssociate: (id: string) => void
  onOpenSimulation?: () => void
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  isMock,
  setIsMock,
  selectedAssociateId,
  onSelectAssociate,
  onOpenSimulation
}) => {
  const { user, logout } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showAssociatePicker, setShowAssociatePicker] = useState(false)

  const associates = [
    { id: 'EMP101', name: 'Priya Sharma' },
    { id: 'EMP102', name: 'Marcus Chen' },
    { id: 'EMP103', name: 'Aaliyah Patel' },
    { id: 'EMP104', name: 'David Kim' }
  ]

  const currentAssocName =
    associates.find(a => a.id === selectedAssociateId)?.name ||
    PRESET_USERS[selectedAssociateId]?.name ||
    selectedAssociateId

  const initials = (user?.name || 'User')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const navItems = [
    { id: 'associate' as const, label: 'Associate Desk', icon: <User size={14} /> },
    { id: 'supervisor' as const, label: 'Supervisor Team', icon: <Users size={14} /> },
    { id: 'leader' as const, label: 'Leader Executive', icon: <PieChart size={14} /> },
    { id: 'claim' as const, label: 'Claim Deep Dive', icon: <Compass size={14} /> }
  ]

  return (
    <header
      style={{
        background: 'var(--bg-card, rgba(255, 255, 255, 0.85))',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.9))',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: 60,
        display: 'flex',
        alignItems: 'center',
        boxShadow: 'var(--shadow-sm, 0 4px 18px rgba(0, 0, 0, 0.04))',
        padding: '0 24px'
      }}
    >
      <div
        style={{
          maxWidth: 1540,
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '100%'
        }}
      >
        {/* Left: Brand & Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #18171c 0%, #312e38 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
              }}
            >
              <Activity size={16} color="#ffffff" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: '0.9375rem',
                    letterSpacing: '-0.02em',
                    color: 'var(--text-main, #18171c)'
                  }}
                >
                  NovaArc TMS
                </span>
                <span
                  style={{
                    fontSize: '0.5625rem',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: 'rgba(124, 58, 237, 0.1)',
                    color: '#7c3aed',
                    border: '1px solid rgba(124, 58, 237, 0.25)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase'
                  }}
                >
                  v1.0
                </span>
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #716e7d)', marginTop: -1 }}>
                RCM Transaction &amp; Effort Intelligence
              </div>
            </div>
          </div>

          <div
            style={{
              width: 1,
              height: 22,
              background: 'var(--border-subtle, #e2e8f0)',
              margin: '0 8px'
            }}
          />

          {/* Nav Tabs */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 4, height: '100%' }}>
            {navItems.map(({ id, label, icon }) => {
              const isActive = currentView === id
              return (
                <button
                  key={id}
                  onClick={() => setCurrentView(id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: isActive ? '#18171c' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-secondary, #5b5866)',
                    fontSize: '0.8125rem',
                    fontWeight: isActive ? 700 : 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {icon}
                  <span>{label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Right: Controls & User Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Associate Workspace Switcher dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowAssociatePicker(!showAssociatePicker)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 10,
                border: '1px solid var(--border-subtle, #e2e8f0)',
                background: 'var(--bg-card, #ffffff)',
                color: 'var(--text-main, #18171c)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <User size={12} color="#7c3aed" />
              <span>Desk: {currentAssocName}</span>
              <ChevronDown size={12} />
            </button>

            {showAssociatePicker && (
              <div
                style={{
                  position: 'absolute',
                  top: '110%',
                  right: 0,
                  width: 200,
                  background: '#ffffff',
                  borderRadius: 12,
                  padding: 6,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                  border: '1px solid #e2e8f0',
                  zIndex: 200
                }}
              >
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', padding: '4px 8px' }}>
                  SWITCH ACTIVE DESK
                </div>
                {associates.map(a => (
                  <button
                    key={a.id}
                    onClick={() => {
                      onSelectAssociate(a.id)
                      setShowAssociatePicker(false)
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: 'none',
                      background: selectedAssociateId === a.id ? '#f1f5f9' : 'transparent',
                      color: selectedAssociateId === a.id ? '#18171c' : '#475569',
                      fontSize: '0.75rem',
                      fontWeight: selectedAssociateId === a.id ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>{a.name}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', color: '#94a3b8' }}>
                      {a.id}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Simulation Launcher */}
          {onOpenSimulation && (
            <button
              onClick={onOpenSimulation}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 10,
                border: '1px solid rgba(124, 58, 237, 0.3)',
                background: 'rgba(124, 58, 237, 0.08)',
                color: '#7c3aed',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Open real-time desktop event simulation"
            >
              <Activity size={12} />
              <span>Simulation</span>
            </button>
          )}

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
              padding: '6px 11px',
              borderRadius: 10,
              background: isMock ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
              border: `1px solid ${isMock ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
              color: isMock ? '#d97706' : '#059669',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Database size={12} />
            <span>{isMock ? 'Mock' : 'Live'}</span>
          </button>

          {/* User Profile Pill & Logout Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 10px',
                borderRadius: 9999,
                border: '1px solid var(--border-subtle, #e2e8f0)',
                background: 'var(--bg-card, #ffffff)',
                cursor: 'pointer'
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: '#18171c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  color: '#fff'
                }}
              >
                {initials}
              </div>
              <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main, #18171c)' }}>
                  {user?.name || 'Associate'}
                </div>
                <div style={{ fontSize: '0.625rem', color: '#7c3aed', fontWeight: 600, textTransform: 'uppercase' }}>
                  {user?.role || 'employee'}
                </div>
              </div>
              <ChevronDown size={12} color="#94a3b8" />
            </button>

            {showUserMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '115%',
                  right: 0,
                  width: 220,
                  background: '#ffffff',
                  borderRadius: 16,
                  padding: 10,
                  boxShadow: '0 12px 35px rgba(0,0,0,0.18)',
                  border: '1px solid #e2e8f0',
                  zIndex: 200
                }}
              >
                <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', marginBottom: 6 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.8125rem', color: '#18171c' }}>{user?.name}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>{user?.title || user?.team}</div>
                  <div style={{ fontSize: '0.6875rem', fontFamily: "'JetBrains Mono', monospace", color: '#7c3aed', marginTop: 2 }}>
                    ID: {user?.id}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    logout()
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <LogOut size={14} />
                  <span>Sign Out / Switch Role</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
