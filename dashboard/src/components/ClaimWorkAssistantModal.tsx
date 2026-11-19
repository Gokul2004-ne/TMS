import React, { useState, useEffect } from 'react'
import { X, CheckCircle2, RefreshCw, ExternalLink } from 'lucide-react'
import { CONFIG } from '../config'

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
  lastlyWorkedClaim?: string | null
  onConfirmClaim: (claimId: string, patientName?: string) => void
  onCloseClaim?: (claimId: string) => void
  onToggleStatus?: (claimId: string, newStatus: string) => void
  runningClaims?: RunningClaimOption[]
}

export const ClaimWorkAssistantModal: React.FC<ClaimWorkAssistantModalProps> = ({
  isOpen,
  onClose,
  currentActiveClaim,
  lastlyWorkedClaim,
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
    setClaimsList(prev => prev.filter(c => c.claim_id.toUpperCase() !== claimId.toUpperCase()))

    if (selectedClaimId.trim().toUpperCase() === claimId.toUpperCase()) {
      setSelectedClaimId('')
    }

    setFeedbackMsg(`Claim ${claimId} marked COMPLETED & closed.`)
    setTimeout(() => setFeedbackMsg(null), 3500)

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
      background: 'rgba(2, 44, 34, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16
    }}>
      {/* Modern Executive Modal Card */}
      <div style={{
        background: '#ffffff',
        border: '1.5px solid #10b981',
        width: '100%',
        maxWidth: 520,
        boxShadow: '0 25px 60px -15px rgba(6, 78, 59, 0.4)',
        position: 'relative',
        animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        borderRadius: 14,
        overflow: 'hidden'
      }}>
        {/* Top Vibrant Emerald Accent Gradient */}
        <div style={{ height: 4, background: 'linear-gradient(90deg, #10b981, #059669, #34d399)' }} />

        {/* Top Banner: Lastly worked claim/denial */}
        <div style={{
          background: '#022c22',
          color: '#ffffff',
          padding: '10px 22px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid #064e3b'
        }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#a7f3d0', letterSpacing: '0.02em' }}>
            lastly worked claim/denial:
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.125rem',
            fontWeight: 900,
            color: '#4ade80',
            letterSpacing: '0.03em'
          }}>
            {lastlyWorkedClaim || (runningClaims.find(c => c.claim_id !== currentActiveClaim && c.claim_id !== 'UNASSIGNED')?.claim_id) || (runningClaims.find(c => c.status && c.status.toUpperCase() === 'COMPLETED')?.claim_id) || 'None (Shift Start)'}
          </span>
        </div>

        {/* Top Header Bar */}
        <div style={{
          background: '#064e3b',
          color: '#ffffff',
          padding: '14px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #047857'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 34,
              height: 34,
              background: '#059669',
              border: '1.5px solid #34d399',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 14px rgba(16, 185, 129, 0.4)',
              borderRadius: 8
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#ffffff', letterSpacing: '0.05em' }}>
                TMS
              </span>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.01em', color: '#ffffff' }}>
                Claim Work Assistant
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a7f3d0', marginTop: 1 }}>
                Active session claim tracking
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Live platform badge */}
            <div style={{
              background: '#022c22',
              border: '1px solid #059669',
              padding: '4px 10px',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399', display: 'inline-block' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#a7f3d0' }}>
                NovaArc RCM
              </span>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#a7f3d0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
                borderRadius: 4,
                transition: 'all 0.15s ease'
              }}
              title="Close Assistant"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '22px 24px', background: '#ffffff' }}>
          {/* Information callout banner */}
          <div style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderLeft: '4px solid #059669',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}>
            <div>
              <p style={{
                fontSize: '0.84rem',
                color: '#064e3b',
                fontWeight: 800,
                margin: 0
              }}>
                Select or enter the claim you are working on
              </p>
              <p style={{ fontSize: '0.75rem', color: '#047857', margin: '3px 0 0 0', fontWeight: 500 }}>
                Claim benchmark & target AHT automatically detected from NovaArc.
              </p>
            </div>
            <a
              href={CONFIG.OFFICE_PLATFORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.75rem',
                color: '#ffffff',
                background: '#059669',
                border: '1px solid #047857',
                padding: '6px 14px',
                borderRadius: 6,
                fontWeight: 700,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              <span>NovaArc</span>
              <ExternalLink size={12} />
            </a>
          </div>

          {feedbackMsg && (
            <div style={{
              padding: '10px 14px',
              marginBottom: 16,
              background: '#ecfdf5',
              border: '1px solid #10b981',
              borderRadius: 8,
              color: '#065f46',
              fontSize: '0.8125rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              animation: 'fadeIn 0.2s ease'
            }}>
              <CheckCircle2 size={16} color="#059669" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* Claim ID Field - Full Width (Claim Type removed) */}
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 800,
              color: '#1e293b',
              marginBottom: 6
            }}>
              Claim ID
            </label>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                list="running-claims-datalist"
                value={selectedClaimId}
                onChange={(e) => setSelectedClaimId(e.target.value)}
                placeholder="e.g. CLM-607 or type new claim..."
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '2px solid #a7f3d0',
                  borderRadius: 8,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.9375rem',
                  fontWeight: 800,
                  color: '#022c22',
                  background: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease',
                  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.04)'
                }}
                onFocus={(e) => (e.target.style.borderColor = '#059669')}
                onBlur={(e) => (e.target.style.borderColor = '#a7f3d0')}
                autoFocus
              />

              <datalist id="running-claims-datalist">
                {claimsList.map((c) => (
                  <option key={c.claim_id} value={c.claim_id}>
                    {c.claim_id}{c.patient_name && c.patient_name !== 'Shift Claim' ? ` (${c.patient_name})` : ''}{c.status ? ` (${c.status})` : ''}
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          {/* Interactive Claims List with Perfectly Fitted Badges and Buttons */}
          {claimsList.length > 0 ? (
            <div style={{
              maxHeight: 180,
              overflowY: 'auto',
              border: '1.5px solid #d1fae5',
              borderRadius: 8,
              background: '#f8fafc',
              padding: '6px',
              marginBottom: 18
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
                      marginBottom: 4,
                      background: isSelected ? '#ecfdf5' : '#ffffff',
                      border: isSelected ? '1.5px solid #059669' : '1px solid #e2e8f0',
                      borderRadius: 6,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Left: Claim info */}
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
                        color: isSelected ? '#047857' : '#022c22'
                      }}>
                        {c.claim_id}
                      </span>
                      {c.patient_name && c.patient_name !== 'Shift Claim' && (
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          ({c.patient_name})
                        </span>
                      )}
                    </div>

                    {/* Right: Actions Container */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* Status Toggle Button - Perfectly Fitted */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(c.claim_id)}
                        title="Click to toggle status between IN_PROGRESS and COMPLETED"
                        style={{
                          background: isCompleted ? '#d1fae5' : '#fef3c7',
                          color: isCompleted ? '#065f46' : '#92400e',
                          border: `1px solid ${isCompleted ? '#6ee7b7' : '#fcd34d'}`,
                          padding: '5px 12px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          borderRadius: 6,
                          letterSpacing: '0.02em',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span>{isCompleted ? 'COMPLETED' : 'IN PROGRESS'}</span>
                        <RefreshCw size={11} />
                      </button>

                      {/* Close Button - Cleanly Fitted Action Pill */}
                      {isCompleted && (
                        <button
                          type="button"
                          onClick={() => handleCloseClaim(c.claim_id)}
                          title="Complete & Close this claim"
                          style={{
                            background: '#ffe4e6',
                            color: '#be123c',
                            border: '1px solid #fecdd3',
                            padding: '5px 12px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            borderRadius: 6,
                            cursor: 'pointer',
                            animation: 'fadeIn 0.15s ease-out',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Close
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{
              padding: '16px',
              textAlign: 'center',
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: 8,
              color: '#64748b',
              fontSize: '0.8125rem',
              fontWeight: 600,
              marginBottom: 18
            }}>
              All claims completed and closed! Type a new Claim ID above to begin tracking.
            </div>
          )}

          {/* Action Buttons - Perfectly Fitted Matching Heights & Widths */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            paddingTop: 16,
            borderTop: '1px solid #e2e8f0'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 42,
                minWidth: 120,
                padding: '0 20px',
                background: '#f4f4f5',
                border: '1.5px solid #d4d4d8',
                color: '#27272a',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: 'pointer',
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              style={{
                height: 42,
                minWidth: 140,
                padding: '0 24px',
                background: '#059669',
                color: '#ffffff',
                border: '1.5px solid #047857',
                fontSize: '0.875rem',
                fontWeight: 800,
                cursor: 'pointer',
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)',
                transition: 'all 0.15s ease'
              }}
            >
              <span>Continue</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
