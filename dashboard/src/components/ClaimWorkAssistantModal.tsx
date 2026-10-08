import React, { useState, useEffect } from 'react'
import { FileText, X, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react'

export interface RunningClaimOption {
  claim_id: string
  patient_name: string
  status: string
  payer?: string
}

interface ClaimWorkAssistantModalProps {
  isOpen: boolean
  onClose: () => void
  currentActiveClaim?: string | null
  onConfirmClaim: (claimId: string, patientName?: string) => void
  onCloseClaim?: (claimId: string) => void
  onToggleStatus?: (claimId: string, newStatus: string) => void
  runningClaims?: RunningClaimOption[]
}

export const ClaimWorkAssistantModal: React.FC<ClaimWorkAssistantModalProps> = ({
  isOpen,
  onClose,
  currentActiveClaim,
  onConfirmClaim,
  onCloseClaim,
  onToggleStatus,
  runningClaims = []
}) => {
  const [selectedClaimId, setSelectedClaimId] = useState<string>(
    currentActiveClaim && currentActiveClaim !== 'UNASSIGNED'
      ? currentActiveClaim
      : (runningClaims.length > 0 ? runningClaims[0].claim_id : '')
  )

  const [claimsList, setClaimsList] = useState<RunningClaimOption[]>([])
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  useEffect(() => {
    setClaimsList(runningClaims)
  }, [runningClaims, isOpen])

  if (!isOpen) return null

  const handleConfirm = () => {
    const finalClaim = selectedClaimId.trim().toUpperCase()
    if (!finalClaim) return

    let patientName = ''
    const found = claimsList.find(c => c.claim_id.toUpperCase() === finalClaim)
    if (found) {
      patientName = found.patient_name
    }

    onConfirmClaim(finalClaim, patientName)
    onClose()
  }

  const handleToggleStatus = (claimId: string) => {
    setClaimsList(prev =>
      prev.map(c => {
        if (c.claim_id.toUpperCase() === claimId.toUpperCase()) {
          const newStatus = c.status.toUpperCase() === 'COMPLETED' ? 'IN_PROGRESS' : 'COMPLETED'
          if (onToggleStatus) onToggleStatus(claimId, newStatus)
          return { ...c, status: newStatus }
        }
        return c
      })
    )
  }

  const handleCloseClaim = (claimId: string) => {
    // 1. Remove from local modal dropdown list immediately
    setClaimsList(prev => prev.filter(c => c.claim_id.toUpperCase() !== claimId.toUpperCase()))

    // 2. If it was typed into the input, clear it so user can type new claim ID
    if (selectedClaimId.trim().toUpperCase() === claimId.toUpperCase()) {
      setSelectedClaimId('')
    }

    // 3. Show feedback message
    setFeedbackMsg(`Claim ${claimId} marked COMPLETED & closed (saved to Excel).`)
    setTimeout(() => setFeedbackMsg(null), 4000)

    // 4. Notify parent / API
    if (onCloseClaim) {
      onCloseClaim(claimId)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(11, 17, 32, 0.72)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16
    }}>
      {/* 2D Sharp Executive Modal (Reference Idea_pic.jpeg Step 3) */}
      <div style={{
        background: '#ffffff',
        border: '2px solid #0f172a',
        width: '100%',
        maxWidth: 540,
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
        position: 'relative',
        animation: 'fadeIn 0.15s ease-out',
        borderRadius: 2
      }}>
        {/* Top Decorative Accent Line */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #2563eb, #38bdf8)' }} />

        {/* Top Header Bar */}
        <div style={{
          background: '#090d16',
          color: '#ffffff',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #1e293b'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 30,
              height: 30,
              background: '#2563eb',
              border: '1px solid #3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(37, 99, 235, 0.4)'
            }}>
              <FileText size={16} color="#ffffff" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.9375rem', letterSpacing: '-0.01em', color: '#f8fafc' }}>
                Claim Work Assistant
              </div>
              <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#60a5fa', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Effort Telemetry & Context
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Live platform badge */}
            <div style={{
              background: '#1e293b',
              border: '1px solid #334155',
              padding: '3px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 5
            }}>
              <span style={{ color: '#10b981', fontSize: '0.625rem' }}>●</span>
              <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#93c5fd' }}>
                NovaArc RCM
              </span>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4
              }}
              title="Close Assistant"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 22px' }}>
          {/* Information callout banner */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderLeft: '4px solid #2563eb',
            padding: '10px 14px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <p style={{
                fontSize: '0.8125rem',
                color: '#0f172a',
                fontWeight: 700,
                margin: 0
              }}>
                A claim platform is open (<strong style={{ color: '#2563eb' }}>NovaArc RCM</strong>).
              </p>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0 0' }}>
                Select an existing claim to complete, or enter a new Claim ID to start.
              </p>
            </div>
            <a
              href="https://krishna-caare.github.io/novaarc-rcm/login"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.75rem',
                color: '#2563eb',
                fontWeight: 700,
                textDecoration: 'underline',
                whiteSpace: 'nowrap',
                marginLeft: 12
              }}
            >
              Open Platform ↗
            </a>
          </div>

          {feedbackMsg && (
            <div style={{
              padding: '8px 12px',
              marginBottom: 14,
              background: '#ecfdf5',
              border: '1px solid #10b981',
              color: '#065f46',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              animation: 'fadeIn 0.2s ease'
            }}>
              <CheckCircle2 size={15} color="#10b981" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* Single Box With Dropdown (User can type new claim ID or pick existing) */}
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#475569',
              marginBottom: 8
            }}>
              ACTIVE CLAIM IDENTIFIER:
            </label>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                list="running-claims-datalist"
                value={selectedClaimId}
                onChange={(e) => {
                  setSelectedClaimId(e.target.value)
                }}
                placeholder="Type new Claim ID or select from suggestions below..."
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  border: '2px solid #0f172a',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  background: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                autoFocus
              />

              <datalist id="running-claims-datalist">
                {claimsList.map((c) => (
                  <option key={c.claim_id} value={c.claim_id}>
                    {c.claim_id}{c.patient_name ? ` — ${c.patient_name}` : ''}{c.status ? ` (${c.status})` : ''}
                  </option>
                ))}
              </datalist>
            </div>

            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 6, marginBottom: 12 }}>
              Tip: Click <strong>IN_PROGRESS</strong> to convert to <strong>COMPLETED</strong> — the <strong>Close</strong> button will then appear.
            </p>

            {/* Interactive Claims List with Dynamic Close Button Visibility */}
            {claimsList.length > 0 ? (
              <div style={{
                maxHeight: 180,
                overflowY: 'auto',
                border: '1px solid #cbd5e1',
                borderRadius: 2,
                background: '#f8fafc',
                padding: '4px'
              }}>
                {claimsList.map((c) => {
                  const isCompleted = c.status.toUpperCase() === 'COMPLETED'
                  const isSelected = selectedClaimId.trim().toUpperCase() === c.claim_id.toUpperCase()

                  return (
                    <div
                      key={c.claim_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        marginBottom: 3,
                        background: isSelected ? '#eff6ff' : '#ffffff',
                        border: isSelected ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                        transition: 'all 0.1s ease'
                      }}
                    >
                      {/* Left: Claim info (Clicking selects the claim) */}
                      <div
                        onClick={() => setSelectedClaimId(c.claim_id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer',
                          flex: 1
                        }}
                      >
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          fontSize: '0.875rem',
                          color: isSelected ? '#1d4ed8' : '#0f172a'
                        }}>
                          {c.claim_id}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          — Shift Claim
                        </span>
                      </div>

                      {/* Right: Actions Container */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {/* Status Toggle Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(c.claim_id)}
                          title="Click to toggle status between IN_PROGRESS and COMPLETED"
                          style={{
                            background: isCompleted ? '#dcfce7' : '#fef3c7',
                            color: isCompleted ? '#15803d' : '#b45309',
                            border: `1px solid ${isCompleted ? '#86efac' : '#fde68a'}`,
                            padding: '3px 9px',
                            fontSize: '0.6875rem',
                            fontWeight: 800,
                            letterSpacing: '0.02em',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <span>{isCompleted ? '✓ COMPLETED' : '● IN_PROGRESS'}</span>
                          <RefreshCw size={10} />
                        </button>

                        {/* KEY REQUIREMENT: Close Button ONLY appears when status is COMPLETED! */}
                        {isCompleted && (
                          <button
                            type="button"
                            onClick={() => handleCloseClaim(c.claim_id)}
                            title="Complete & Close this claim (disappears from list, updates in Excel & dashboard)"
                            style={{
                              background: '#fee2e2',
                              color: '#b91c1c',
                              border: '1px solid #fca5a5',
                              padding: '3px 9px',
                              fontSize: '0.6875rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              animation: 'fadeIn 0.15s ease-out'
                            }}
                          >
                            ✕ Close
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{
                padding: '14px',
                textAlign: 'center',
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                color: '#64748b',
                fontSize: '0.75rem',
                fontWeight: 600
              }}>
                All claims completed and closed! Type a new Claim ID above to begin tracking.
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            paddingTop: 16,
            borderTop: '1px solid #e2e8f0'
          }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
              style={{
                padding: '9px 18px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#475569',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              style={{
                background: '#0f172a',
                color: '#ffffff',
                border: '1px solid #0f172a',
                padding: '9px 24px',
                fontWeight: 700,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <span>Continue</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
