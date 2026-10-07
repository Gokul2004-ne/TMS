import React, { useState } from 'react'
import { FileText, X, ArrowRight } from 'lucide-react'

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
}

const DEFAULT_RUNNING_CLAIMS: RunningClaimOption[] = [
  { claim_id: 'CLM-316', patient_name: 'Robert Wilson', status: 'In Progress', payer: 'UHC' },
  { claim_id: 'CLM1003', patient_name: 'Robert Wilson', status: 'In Review', payer: 'UHC' },
  { claim_id: 'CLM1001', patient_name: 'John Smith', status: 'Pending', payer: 'BCBS' },
  { claim_id: 'CLM1002', patient_name: 'Mary Davis', status: 'Denied', payer: 'Medicare' },
  { claim_id: 'CLM1004', patient_name: 'Linda Brown', status: 'Pending', payer: 'Aetna' },
  { claim_id: 'CLM1005', patient_name: 'Michael Lee', status: 'Pending', payer: 'Cigna' },
  { claim_id: 'CLM1028', patient_name: 'David Miller', status: 'In Progress', payer: 'UHC' }
]

export const ClaimWorkAssistantModal: React.FC<ClaimWorkAssistantModalProps> = ({
  isOpen,
  onClose,
  currentActiveClaim,
  onConfirmClaim
}) => {
  const [selectedClaimId, setSelectedClaimId] = useState<string>(
    currentActiveClaim && currentActiveClaim !== 'UNASSIGNED' ? currentActiveClaim : 'CLM1003'
  )

  if (!isOpen) return null

  const handleConfirm = () => {
    const finalClaim = selectedClaimId.trim().toUpperCase()
    if (!finalClaim) return

    let patientName = ''
    const found = DEFAULT_RUNNING_CLAIMS.find(c => c.claim_id.toUpperCase() === finalClaim)
    if (found) {
      patientName = found.patient_name
    } else {
      patientName = 'Ad-hoc Transaction'
    }

    onConfirmClaim(finalClaim, patientName)
    onClose()
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
        maxWidth: 520,
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
            marginBottom: 16
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

          {/* Single Box With Dropdown (User can type new claim ID or pick existing) */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#475569',
              marginBottom: 8
            }}>
              CLAIM ID (ENTER NEW OR SELECT FROM DROPDOWN):
            </label>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                list="running-claims-datalist"
                value={selectedClaimId}
                onChange={(e) => {
                  setSelectedClaimId(e.target.value)
                }}
                placeholder="Type new Claim ID or pick from dropdown..."
                style={{
                  width: '100%',
                  padding: '11px 40px 11px 14px',
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
                {DEFAULT_RUNNING_CLAIMS.map((c) => (
                  <option key={c.claim_id} value={c.claim_id}>
                    {c.claim_id} — {c.patient_name} ({c.status})
                  </option>
                ))}
              </datalist>
            </div>

            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 6, marginBottom: 14 }}>
              Type a new claim ID directly into this box, or select from the dropdown suggestions.
            </p>

            {/* Quick-Pick Pill suggestions from running claims */}
            <div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Quick Select:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {DEFAULT_RUNNING_CLAIMS.slice(0, 5).map((c) => (
                  <button
                    key={c.claim_id}
                    type="button"
                    onClick={() => setSelectedClaimId(c.claim_id)}
                    style={{
                      background: selectedClaimId === c.claim_id ? '#0f172a' : '#f1f5f9',
                      color: selectedClaimId === c.claim_id ? '#ffffff' : '#334155',
                      border: '1px solid #cbd5e1',
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {c.claim_id}
                  </button>
                ))}
              </div>
            </div>
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
