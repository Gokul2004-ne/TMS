import React, { useState, useRef, useEffect } from 'react'
import { Activity, Users, User, Compass, Database, ChevronDown, Check, UserCheck, ArrowRight } from 'lucide-react'
import { CONFIG } from '../config'

interface NavbarProps {
  currentView: 'associate' | 'supervisor' | 'claim'
  setCurrentView: (v: 'associate' | 'supervisor' | 'claim') => void
  isMock: boolean
  setIsMock: (m: boolean) => void
  associateName: string
  selectedAssociateId?: string
  onSelectAssociate?: (assocId: string) => void
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  isMock,
  setIsMock,
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

          {/* Associate Switcher Dropdown */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(prev => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 10px',
                border: '1px solid #0f172a',
                background: isDropdownOpen ? '#f8fafc' : '#ffffff',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.12s ease',
                boxShadow: isDropdownOpen ? '0 0 0 2px rgba(15,23,42,0.15)' : 'none'
              }}
              title="Click to switch Associate profile or enter custom ID"
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
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
