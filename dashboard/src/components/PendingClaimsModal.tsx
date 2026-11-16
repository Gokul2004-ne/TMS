import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Search,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Inbox
} from 'lucide-react'
import { api } from '../api/client'
import { PendingClaimItem } from '../api/types'

interface PendingClaimsModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectClaim: (claimId: string, patientName?: string) => void
  currentActiveClaimId?: string | null
  associateId?: string
}

const DEMO_PENDING_CLAIMS: PendingClaimItem[] = [
  {
    claim_id: 'CLM-9021',
    associate_id: 'EMP101',
    claim_type_name: 'CR - Call / IVR (CO-16 Missing Docs)',
    category: 'Commercial',
    due_date: 'Today',
    days_until_due: 0,
    urgency: 'OVERDUE',
    standard_minutes: 14
  },
  {
    claim_id: 'CLM-9022',
    associate_id: 'EMP101',
    claim_type_name: 'DM - Clinical / Auth (PR-204 Not Covered)',
    category: 'Commercial',
    due_date: 'Tomorrow',
    days_until_due: 1,
    urgency: 'DUE_SOON',
    standard_minutes: 13
  },
  {
    claim_id: 'CLM-9023',
    associate_id: 'EMP101',
    claim_type_name: 'PPA - Review / Posting (CO-97 Included)',
    category: 'Medicare',
    due_date: 'In 3 days',
    days_until_due: 3,
    urgency: 'ON_TRACK',
    standard_minutes: 3
  },
  {
    claim_id: 'CLM-9024',
    associate_id: 'EMP101',
    claim_type_name: 'AP - Review / Written (CO-4 Modifier Mismatch)',
    category: 'Medicaid',
    due_date: 'Yesterday',
    days_until_due: -1,
    urgency: 'OVERDUE',
    standard_minutes: 18
  },
  {
    claim_id: 'CLM-9025',
    associate_id: 'EMP101',
    claim_type_name: 'SI - Call / IVR (CO-18 Duplicate)',
    category: 'Commercial',
    due_date: 'In 5 days',
    days_until_due: 5,
    urgency: 'ON_TRACK',
    standard_minutes: 7
  }
]

export const PendingClaimsModal: React.FC<PendingClaimsModalProps> = ({
  isOpen,
  onClose,
  onSelectClaim,
  currentActiveClaimId,
  associateId
}) => {
  const [claims, setClaims] = useState<PendingClaimItem[]>(DEMO_PENDING_CLAIMS)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState<'ALL' | 'OVERDUE' | 'DUE_SOON' | 'ON_TRACK'>('ALL')

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      api.getPendingClaims(associateId)
        .then(res => {
          if (res && res.length > 0) {
            setClaims(res)
          } else {
            setClaims(DEMO_PENDING_CLAIMS)
          }
        })
        .catch(() => {
          setClaims(DEMO_PENDING_CLAIMS)
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [isOpen, associateId])

  if (!isOpen) return null

  const filtered = claims.filter(c => {
    const matchesSearch =
      c.claim_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.claim_type_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesUrgency = urgencyFilter === 'ALL' || c.urgency === urgencyFilter
    return matchesSearch && matchesUrgency
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
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    background: '#f1f5f9',
                    color: '#475569'
                  }}
                >
                  {filtered.length} Pending
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                Select a pending claim to begin active processing and automated telemetry tracking
              </p>
            </div>

            <button
              onClick={onClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Filters Bar */}
          <div
            style={{
              padding: '14px 24px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              background: '#ffffff'
            }}
          >
            <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
              <Search
                size={16}
                color="#94a3b8"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by Claim ID or Type..."
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

            <div style={{ display: 'flex', gap: 6 }}>
              {(['ALL', 'OVERDUE', 'DUE_SOON', 'ON_TRACK'] as const).map(u => (
                <button
                  key={u}
                  onClick={() => setUrgencyFilter(u)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 9999,
                    border: urgencyFilter === u ? '1px solid #18171c' : '1px solid #e2e8f0',
                    background: urgencyFilter === u ? '#18171c' : '#ffffff',
                    color: urgencyFilter === u ? '#ffffff' : '#64748b',
                    fontSize: '0.75rem',
                    fontWeight: urgencyFilter === u ? 700 : 500,
                    cursor: 'pointer'
                  }}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Claims List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
            {loading ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                Loading pending claims...
              </div>
            ) : filtered.length === 0 ? (
              <div
                style={{
                  padding: '56px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  gap: 12
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8'
                  }}
                >
                  <Inbox size={28} />
                </div>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                    No Pending Claims
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: 4, maxWidth: 360 }}>
                    There are no unadjudicated claims in your queue. Incoming claims assigned by your supervisor will appear here.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtered.map(claim => {
                  const isActive = currentActiveClaimId === claim.claim_id
                  return (
                    <div
                      key={claim.claim_id}
                      style={{
                        padding: '16px 18px',
                        borderRadius: 16,
                        border: isActive ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                        background: isActive ? '#fbfaff' : '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background:
                              claim.urgency === 'OVERDUE'
                                ? 'rgba(239, 68, 68, 0.1)'
                                : claim.urgency === 'DUE_SOON'
                                ? 'rgba(245, 158, 11, 0.1)'
                                : 'rgba(59, 130, 246, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color:
                              claim.urgency === 'OVERDUE'
                                ? '#dc2626'
                                : claim.urgency === 'DUE_SOON'
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
                              {claim.claim_id}
                            </span>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
                              · {claim.claim_type_name}
                            </span>
                            <span
                              style={{
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 6,
                                background:
                                  claim.urgency === 'OVERDUE'
                                    ? '#fee2e2'
                                    : claim.urgency === 'DUE_SOON'
                                    ? '#fef3c7'
                                    : '#e0f2fe',
                                color:
                                  claim.urgency === 'OVERDUE'
                                    ? '#991b1b'
                                    : claim.urgency === 'DUE_SOON'
                                    ? '#92400e'
                                    : '#075985'
                              }}
                            >
                              {claim.urgency}
                            </span>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              fontSize: '0.75rem',
                              color: '#64748b',
                              marginTop: 4
                            }}
                          >
                            <span>Category: <strong>{claim.category}</strong></span>
                            <span>•</span>
                            <span>Target SLA: <strong>{claim.standard_minutes}m</strong></span>
                            {claim.due_date && (
                              <>
                                <span>•</span>
                                <span>Due: <strong>{claim.due_date}</strong></span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        {isActive ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '8px 14px',
                              borderRadius: 10,
                              background: '#ecfdf5',
                              color: '#059669',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              border: '1px solid #a7f3d0'
                            }}
                          >
                            <CheckCircle2 size={14} />
                            <span>Currently Active</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              onSelectClaim(claim.claim_id)
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
                              gap: 6
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
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
