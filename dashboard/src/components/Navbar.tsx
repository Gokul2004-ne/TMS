<<<<<<< HEAD
import React, { useState, useRef, useEffect } from 'react'
import { Activity, Users, User, Compass, Database, ChevronDown, Check, UserCheck, ArrowRight } from 'lucide-react'
=======
import React, { useState } from 'react'
import {
  Activity,
  Users,
  User,
  Compass,
  Database,
  PieChart,
  LogOut,
  ChevronDown,
  Layers,
  Sparkles
} from 'lucide-react'
>>>>>>> ebecadb (frontend changed)
import { CONFIG } from '../config'
import { useAuth, PRESET_USERS } from '../context/AuthContext'

interface NavbarProps {
  currentView: 'associate' | 'supervisor' | 'leader' | 'claim'
  setCurrentView: (v: 'associate' | 'supervisor' | 'leader' | 'claim') => void
  isMock: boolean
  setIsMock: (m: boolean) => void
<<<<<<< HEAD
  associateName: string
  selectedAssociateId?: string
  onSelectAssociate?: (assocId: string) => void
=======
  selectedAssociateId: string
  onSelectAssociate: (id: string) => void
  onOpenSimulation?: () => void
>>>>>>> ebecadb (frontend changed)
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  isMock,
  setIsMock,
<<<<<<< HEAD
  associateName,
  selectedAssociateId = 'EMP101',
  onSelectAssociate
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const PRESET_ASSOCIATES = [
    { id: 'EMP101', name: 'Associate EMP101', role: 'AR Specialist' },
    { id: 'EMP102', name: 'Associate EMP102', role: 'Denial Specialist' },
    { id: 'EMP103', name: 'Associate EMP103', role: 'Appeals Analyst' },
    { id: 'EMP104', name: 'Associate EMP104', role: 'Senior Specialist' },
    { id: 'EMP-GOKUL', name: 'Associate Gokul', role: 'Workstation Agent' }
  ]

  const handleSelect = (id: string) => {
    if (onSelectAssociate) {
      onSelectAssociate(id)
    }
    setIsDropdownOpen(false)
  }

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (customInput.trim()) {
      handleSelect(customInput.trim().toUpperCase())
      setCustomInput('')
    }
  }

  const initials = associateName
=======
  selectedAssociateId,
  onSelectAssociate,
  onOpenSimulation
}) => {
  const { user, logout, switchUser } = useAuth()
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
>>>>>>> ebecadb (frontend changed)
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
<<<<<<< HEAD
        {/* --- Brand --- */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
=======
        {/* Left: Brand */}
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

>>>>>>> ebecadb (frontend changed)
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

<<<<<<< HEAD
        {/* --- Vertical Divider --- */}
        <div
          style={{
            width: 1,
            height: 22,
            background: '#e2e8f0',
            margin: '0 22px',
            flexShrink: 0
          }}
        />

        {/* --- Navigation tabs --- */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 0, height: '100%', flex: 1 }}>
          {(
            [
              { id: 'associate', label: 'Associate Workspace', icon: <User size={14} /> },
              { id: 'supervisor', label: 'Supervisor Overview', icon: <Users size={14} /> },
              { id: 'claim',     label: 'Claim Deep Dive',    icon: <Compass size={14} /> }
            ] as const
          ).map(({ id, label, icon }) => (
=======
        {/* Right: Controls & User Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Associate Workspace Switcher dropdown */}
          <div style={{ position: 'relative' }}>
>>>>>>> ebecadb (frontend changed)
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

<<<<<<< HEAD
        {/* --- Right-side controls --- */}
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
=======
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
>>>>>>> ebecadb (frontend changed)
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
            title="Toggle mock fixtures <-> live FastAPI backend"
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

<<<<<<< HEAD
          {/* Associate Switcher Dropdown */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(prev => !prev)}
=======
          {/* User Profile Pill & Logout Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
>>>>>>> ebecadb (frontend changed)
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 10px',
<<<<<<< HEAD
                border: '1px solid #0f172a',
                background: isDropdownOpen ? '#f8fafc' : '#ffffff',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.12s ease',
                boxShadow: isDropdownOpen ? '0 0 0 2px rgba(15,23,42,0.15)' : 'none'
=======
                borderRadius: 9999,
                border: '1px solid var(--border-subtle, #e2e8f0)',
                background: 'var(--bg-card, #ffffff)',
                cursor: 'pointer'
>>>>>>> ebecadb (frontend changed)
              }}
              title="Click to switch Associate profile or enter custom ID"
            >
              <div
                style={{
<<<<<<< HEAD
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
=======
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
>>>>>>> ebecadb (frontend changed)
                }}
              >
                {initials}
              </div>
<<<<<<< HEAD
              <div style={{ textAlign: 'left', lineHeight: 1.1 }}>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    maxWidth: 110,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {selectedAssociateId}
                </div>
                <div
                  style={{
                    fontSize: '0.625rem',
                    color: '#64748b',
                    maxWidth: 110,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {associateName}
                </div>
              </div>
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
              <ChevronDown
                size={14}
                color="#64748b"
                style={{
                  transform: isDropdownOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease'
                }}
              />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  width: 280,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderTop: '3px solid #0f172a',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)',
                  zIndex: 200,
                  padding: '12px',
                  borderRadius: 2
                }}
              >
                <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Switch Associate
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                    Select profile to isolate live tracking data
                  </div>
                </div>

                {/* If current selection is a custom ID not in presets */}
                {!PRESET_ASSOCIATES.some(p => p.id === selectedAssociateId) && (
                  <div
                    onClick={() => handleSelect(selectedAssociateId)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      marginBottom: 8,
                      cursor: 'pointer'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af' }}>
                        {selectedAssociateId} (Custom)
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#3b82f6' }}>
                        Active Custom Associate
                      </div>
                    </div>
                    <Check size={14} color="#2563eb" />
                  </div>
                )}

                {/* Standard Team Presets */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                  {PRESET_ASSOCIATES.map(p => {
                    const isSelected = p.id === selectedAssociateId
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSelect(p.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          background: isSelected ? '#f1f5f9' : 'transparent',
                          border: isSelected ? '1px solid #0f172a' : '1px solid transparent',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          textAlign: 'left',
                          transition: 'background 0.1s ease'
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#f8fafc'
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
                            {p.id} - {p.name}
                          </div>
                          <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                            {p.role}
                          </div>
                        </div>
                        {isSelected && <Check size={14} color="#0f172a" />}
                      </button>
                    )
                  })}
                </div>

                {/* Custom ID Form */}
                <form
                  onSubmit={handleCustomSubmit}
                  style={{
                    paddingTop: 10,
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}
                >
                  <label style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                    Or Custom Associate ID:
                  </label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input
                      type="text"
                      placeholder="e.g. EMP105, USER-B"
                      value={customInput}
                      onChange={e => setCustomInput(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '5px 8px',
                        fontSize: '0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: 2,
                        fontFamily: 'inherit',
                        outline: 'none'
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!customInput.trim()}
                      style={{
                        padding: '5px 10px',
                        background: '#0f172a',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        cursor: customInput.trim() ? 'pointer' : 'not-allowed',
                        opacity: customInput.trim() ? 1 : 0.6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3
                      }}
                    >
                      Switch <ArrowRight size={10} />
                    </button>
                  </div>
                </form>

                <div style={{ marginTop: 8, fontSize: '0.625rem', color: '#94a3b8', textAlign: 'center' }}>
                  Tip: Append <code>?user={selectedAssociateId}</code> to share direct link
                </div>
=======
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
>>>>>>> ebecadb (frontend changed)
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
