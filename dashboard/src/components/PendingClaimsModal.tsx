import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Search,
  AlertCircle,
  ArrowRight,
  CheckCircle2
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

interface PendingClaimsModalProps {
  isOpen: boolean
  onClose: () => void
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
    patientName: 'David Evans',
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
                cursor: 'pointer'
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
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
