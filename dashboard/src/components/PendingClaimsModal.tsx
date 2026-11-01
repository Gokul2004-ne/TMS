<<<<<<< HEAD
import React from 'react'
import { PendingClaimItem } from '../api/types'
=======
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Search,
  Clock,
  AlertCircle,
  ArrowRight,
  Filter,
  DollarSign,
  Building,
  CheckCircle2,
  Sparkles
} from 'lucide-react'

export interface PendingClaimItem {
  id: string
  patientName: string
  payer: string
  amount: number
  agingDays: number
  priority: 'URGENT' | 'HIGH' | 'NORMAL'
  denialCode: string
  denialReason: string
}
>>>>>>> ebecadb (frontend changed)

interface PendingClaimsModalProps {
  isOpen: boolean
  onClose: () => void
<<<<<<< HEAD
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
=======
  onSelectClaim: (claimId: string, patientName?: string) => void
  currentActiveClaimId?: string | null
}

const SAMPLE_PENDING_CLAIMS: PendingClaimItem[] = [
  {
    id: 'CLM-9021',
    patientName: 'Eleanor Higgins',
    payer: 'BlueCross BlueShield',
    amount: 1420.50,
    agingDays: 42,
    priority: 'URGENT',
    denialCode: 'CO-16',
    denialReason: 'Claim lacks missing information or documentation'
  },
  {
    id: 'CLM-9022',
    patientName: 'Lucas Vance',
    payer: 'UnitedHealthcare',
    amount: 3840.00,
    agingDays: 31,
    priority: 'HIGH',
    denialCode: 'PR-204',
    denialReason: 'This service/equipment/drug is not covered under the patient benefit plan'
  },
  {
    id: 'CLM-9023',
    patientName: 'Sophia Ramirez',
    payer: 'Aetna Health',
    amount: 875.25,
    agingDays: 14,
    priority: 'NORMAL',
    denialCode: 'CO-97',
    denialReason: 'The benefit for this service is included in the payment/allowance for another service'
  },
  {
    id: 'CLM-9024',
    patientName: 'David Thorne',
    payer: 'Medicare Part B',
    amount: 5120.00,
    agingDays: 55,
    priority: 'URGENT',
    denialCode: 'CO-4',
    denialReason: 'The procedure code is inconsistent with the modifier used or a required modifier is missing'
  },
  {
    id: 'CLM-9025',
    patientName: 'Hannah Abbott',
    payer: 'Cigna Healthcare',
    amount: 620.00,
    agingDays: 18,
    priority: 'NORMAL',
    denialCode: 'CO-18',
    denialReason: 'Exact duplicate claim/service previously adjudicated'
  },
  {
    id: 'CLM-9026',
    patientName: 'Gregory House',
    payer: 'Humana',
    amount: 2450.80,
    agingDays: 38,
    priority: 'HIGH',
    denialCode: 'CO-50',
    denialReason: 'These are non-covered services because this is not deemed a medical necessity'
  }
]

export const PendingClaimsModal: React.FC<PendingClaimsModalProps> = ({
  isOpen,
  onClose,
  onSelectClaim,
  currentActiveClaimId
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'URGENT' | 'HIGH' | 'NORMAL'>('ALL')

  if (!isOpen) return null

  const filtered = SAMPLE_PENDING_CLAIMS.filter(c => {
    const matchesSearch =
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.payer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.denialCode.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesPriority = priorityFilter === 'ALL' || c.priority === priorityFilter
    return matchesSearch && matchesPriority
  })

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(8px)'
          }}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 820,
            maxHeight: '85vh',
            background: '#ffffff',
            borderRadius: 24,
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 10
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#fafafa'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: '#18171c' }}>
                  Unadjudicated Claims Queue
                </h2>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 9999,
                    background: '#ede9fe',
                    color: '#7c3aed',
                    fontSize: '0.6875rem',
                    fontWeight: 700
                  }}
                >
                  {filtered.length} Available
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                Select a pending healthcare claim to load into your active workspace timer & tracking co-pilot
              </p>
            </div>

            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 'none',
                background: '#f1f5f9',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div
            style={{
              padding: '14px 24px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap'
            }}
          >
            <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
              <Search
                size={16}
                color="#94a3b8"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by Claim ID, Patient, Payer, or CARC Code..."
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: 10,
                  border: '1.5px solid #e2e8f0',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Filter pills */}
            <div style={{ display: 'flex', gap: 6 }}>
              {(['ALL', 'URGENT', 'HIGH', 'NORMAL'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 9999,
                    border: priorityFilter === p ? '1px solid #18171c' : '1px solid #e2e8f0',
                    background: priorityFilter === p ? '#18171c' : '#ffffff',
                    color: priorityFilter === p ? '#ffffff' : '#64748b',
                    fontSize: '0.75rem',
                    fontWeight: priorityFilter === p ? 700 : 500,
                    cursor: 'pointer'
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Claims List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(claim => {
                const isActive = currentActiveClaimId === claim.id
                return (
                  <div
                    key={claim.id}
                    style={{
                      padding: '16px 18px',
                      borderRadius: 16,
                      border: isActive ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                      background: isActive ? '#fbfaff' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Left: Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          background:
                            claim.priority === 'URGENT'
                              ? 'rgba(239, 68, 68, 0.1)'
                              : claim.priority === 'HIGH'
                              ? 'rgba(245, 158, 11, 0.1)'
                              : 'rgba(59, 130, 246, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color:
                            claim.priority === 'URGENT'
                              ? '#dc2626'
                              : claim.priority === 'HIGH'
                              ? '#d97706'
                              : '#2563eb',
                          flexShrink: 0
                        }}
                      >
                        <AlertCircle size={22} />
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontWeight: 800,
                              fontSize: '0.9375rem',
                              color: '#18171c'
                            }}
                          >
                            {claim.id}
                          </span>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                            {claim.patientName}
                          </span>
                          <span
                            style={{
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background:
                                claim.priority === 'URGENT'
                                  ? '#fee2e2'
                                  : claim.priority === 'HIGH'
                                  ? '#fef3c7'
                                  : '#e0f2fe',
                              color:
                                claim.priority === 'URGENT'
                                  ? '#991b1b'
                                  : claim.priority === 'HIGH'
                                  ? '#92400e'
                                  : '#075985'
                            }}
                          >
                            {claim.priority}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: '0.75rem', color: '#64748b' }}>
                          <span>Payer: <strong>{claim.payer}</strong></span>
                          <span>•</span>
                          <span>Aging: <strong>{claim.agingDays}d</strong></span>
                          <span>•</span>
                          <span style={{ color: '#dc2626', fontWeight: 600 }}>{claim.denialCode}: {claim.denialReason}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount & Action */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 800,
                            fontSize: '0.9375rem',
                            color: '#18171c'
                          }}
                        >
                          ${claim.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>Claim Value</div>
                      </div>

                      {isActive ? (
                        <div
                          style={{
                            padding: '8px 14px',
                            borderRadius: 10,
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            color: '#15803d',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <CheckCircle2 size={14} />
                          <span>Active Now</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            onSelectClaim(claim.id, claim.patientName)
                            onClose()
                          }}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 10,
                            border: 'none',
                            background: '#18171c',
                            color: '#ffffff',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span>Start Working</span>
                          <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

>>>>>>> ebecadb (frontend changed)
