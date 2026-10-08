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
    // 1. Remove from local modal dropdown list
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
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(3px)',
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
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
        position: 'relative',
        animation: 'fadeIn 0.15s ease-out'
      }}>
        {/* Top Header Bar */}
        <div style={{
          background: '#0f172a',
          color: '#ffffff',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #1e293b'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28,
              height: 28,
              background: '#0f172a',
              border: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileText size={16} color="#ffffff" strokeWidth={2.5} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '0.9375rem', letterSpacing: '-0.01em' }}>
              Claim Work Assistant
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

        {/* Modal Body */}
        <div style={{ padding: '20px 22px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14
          }}>
            <p style={{
              fontSize: '0.875rem',
              color: '#334155',
              fontWeight: 600,
              margin: 0
            }}>
              A claim platform is open (<strong style={{ color: '#4f46e5' }}>NovaArc RCM</strong>). Which claim do you want to work on?
            </p>
            <a
              href="https://krishna-caare.github.io/novaarc-rcm/login"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.75rem',
                color: '#4f46e5',
                fontWeight: 700,
                textDecoration: 'underline',
                whiteSpace: 'nowrap',
                marginLeft: 8
              }}
            >
              Open Platform ↗
            </a>
          </div>

          {feedbackMsg && (
            <div style={{
              padding: '6px 10px',
              marginBottom: 12,
              background: '#ecfdf5',
              border: '1px solid #10b981',
              color: '#065f46',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <CheckCircle2 size={14} color="#10b981" />
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
              CLAIM ID (TYPE NEW OR SELECT EXISTING):
            </label>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                list="running-claims-datalist"
                value={selectedClaimId}
                onChange={(e) => {
                  setSelectedClaimId(e.target.value)
                }}
                placeholder="Type new Claim ID or select from list below..."
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
              Type any Claim ID directly, or click a claim below to select, toggle status, or close.
            </p>

            {/* Interactive Claims List with Toggleable Status and Close Button */}
            {claimsList.length > 0 ? (
              <div style={{
                maxHeight: 180,
                overflowY: 'auto',
                border: '1px solid #cbd5e1',
                borderRadius: 2,
                background: '#f8fafc',
                padding: '4px 0'
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
                        padding: '7px 12px',
                        background: isSelected ? '#eff6ff' : '#ffffff',
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.1s ease'
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
                          color: '#0f172a'
                        }}>
                          {c.claim_id}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          — Shift Claim
                        </span>
                      </div>

                      {/* Right: Actions (Status Toggle + Close button) */}
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
                            padding: '3px 8px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            letterSpacing: '0.02em',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          {isCompleted ? 'COMPLETED' : 'IN_PROGRESS'}
                          <RefreshCw size={10} />
                        </button>

                        {/* Close Button */}
                        <button
                          type="button"
                          onClick={() => handleCloseClaim(c.claim_id)}
                          title="Complete & Close this claim (disappears from list, updates in Excel & dashboard)"
                          style={{
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            padding: '3px 8px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{
                padding: '12px',
                textAlign: 'center',
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                color: '#64748b',
                fontSize: '0.75rem'
              }}>
                No running claims in list. Type a new claim ID above to start tracking.
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            paddingTop: 14,
            borderTop: '1px solid #e2e8f0'
          }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
              style={{ padding: '8px 16px' }}
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
                padding: '9px 22px',
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
