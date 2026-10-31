import React from 'react'
import { PendingClaimItem } from '../api/types'

interface PendingClaimsModalProps {
  isOpen: boolean
  onClose: () => void
  pendingClaims: PendingClaimItem[]
  onStartClaim: (claimId: string) => void
  activeClaimId?: string | null
}

export const PendingClaimsModal: React.FC<PendingClaimsModalProps> = ({
  isOpen,
  onClose,
  pendingClaims,
  onStartClaim,
  activeClaimId
}) => {
  if (!isOpen) return null

  // Deduplicate by claim_id first
  const dedupedClaimsMap = new Map<string, PendingClaimItem>()
  for (const c of pendingClaims) {
    if (!c.claim_id) continue
    const cid = c.claim_id.trim().toUpperCase()
    if (!dedupedClaimsMap.has(cid)) {
      dedupedClaimsMap.set(cid, c)
    }
  }

  // Sorted by due date ASC (null due dates at end)
  const sortedClaims = Array.from(dedupedClaimsMap.values()).sort((a, b) => {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })

  const overdueCount = sortedClaims.filter(c => c.urgency === 'OVERDUE').length
  const dueSoonCount = sortedClaims.filter(c => c.urgency === 'DUE_SOON').length

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 8,
          width: '100%',
          maxWidth: 820,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                Pending Claims & Denials
              </h2>
              <span
                style={{
                  background: '#3b82f6',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 12
                }}
              >
                {sortedClaims.length}
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
              Claims prioritized by deadline urgency. Starting a claim auto-activates its timer.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: '#64748b',
              padding: 4
            }}
          >
            x
          </button>
        </div>

        {/* Urgency Summary Bar */}
        {(overdueCount > 0 || dueSoonCount > 0) && (
          <div
            style={{
              padding: '10px 20px',
              background: overdueCount > 0 ? '#fef2f2' : '#fffbeb',
              borderBottom: `1px solid ${overdueCount > 0 ? '#fecaca' : '#fde68a'}`,
              display: 'flex',
              gap: 16,
              fontSize: 12,
              fontWeight: 600
            }}
          >
            {overdueCount > 0 && (
              <span style={{ color: '#b91c1c' }}>
                {overdueCount} Overdue Claim{overdueCount > 1 ? 's' : ''}
              </span>
            )}
            {dueSoonCount > 0 && (
              <span style={{ color: '#b45309' }}>
                {dueSoonCount} Due Within 48 Hours
              </span>
            )}
          </div>
        )}

        {/* Content / Table */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 20px' }}>
          {sortedClaims.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>No pending claims in queue!</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>All assigned claims are up to date.</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '10px 8px', fontWeight: 600 }}>Claim ID</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600 }}>Process / Type</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600 }}>Category</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600 }}>Due Date</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600 }}>Std Time</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600 }}>Urgency</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedClaims.map(claim => {
                  const isCurrentActive = activeClaimId === claim.claim_id
                  let urgencyBadge = {
                    text: 'On Track',
                    bg: '#f1f5f9',
                    color: '#475569',
                    border: '#cbd5e1'
                  }

                  if (claim.urgency === 'OVERDUE') {
                    urgencyBadge = {
                      text: `Overdue (${Math.abs(claim.days_until_due || 0)}d)`,
                      bg: '#fee2e2',
                      color: '#b91c1c',
                      border: '#fca5a5'
                    }
                  } else if (claim.urgency === 'DUE_SOON') {
                    urgencyBadge = {
                      text: `Due Soon (${claim.days_until_due}d)`,
                      bg: '#fef3c7',
                      color: '#b45309',
                      border: '#fcd34d'
                    }
                  }

                  return (
                    <tr
                      key={claim.claim_id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: isCurrentActive ? '#eff6ff' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                        {claim.claim_id}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#1e293b' }}>
                        {claim.claim_type_name}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#64748b' }}>
                        {claim.category}
                      </td>
                      <td style={{ padding: '10px 8px', color: claim.urgency === 'OVERDUE' ? '#b91c1c' : '#334155' }}>
                        {claim.due_date ? new Date(claim.due_date).toLocaleDateString() : '-'}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#475569' }}>
                        {claim.standard_minutes}m
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: urgencyBadge.bg,
                            color: urgencyBadge.color,
                            border: `1px solid ${urgencyBadge.border}`
                          }}
                        >
                          {urgencyBadge.text}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        {isCurrentActive ? (
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>
                            Active Now
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              onStartClaim(claim.claim_id)
                              onClose()
                            }}
                            style={{
                              background: '#0f172a',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: 4,
                              padding: '5px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Start Now
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            background: '#f8fafc'
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: 4,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              color: '#334155'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
