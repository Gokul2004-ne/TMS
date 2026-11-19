import React, { useState, useEffect, useMemo } from 'react'
import {
  CheckCircle2,
  Clock,
  Zap,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  ArrowRight,
  Search,
  Download,
  RefreshCw,
  Pause,
  Play,
  Activity,
  Inbox
} from 'lucide-react'
import { AssociateTodayData } from '../api/types'
import { api } from '../api/client'
import { KpiCard } from '../components/KpiCard'
import { ApplicationTimeDonut } from '../components/ApplicationTimeDonut'
import { NvaBadge } from '../components/NvaBadge'
import { ClaimWorkAssistantModal } from '../components/ClaimWorkAssistantModal'
import { PerformanceWaveChart } from '../components/PerformanceWaveChart'
import { SpeedometerGauge } from '../components/SpeedometerGauge'
import { PendingClaimsModal } from '../components/PendingClaimsModal'
import { LiveSimulationModal } from '../components/LiveSimulationModal'
import { exportClaimsToVoiceTM_Csv } from '../utils/csvExporter'
import { useLivePolling } from '../hooks/useLivePolling'
import { CONFIG } from '../config'

interface AssociateDashboardProps {
  associateId?: string
  onSelectClaim: (claimId: string) => void
}

type NvaFilterType = 'ALL' | 'FLAGGED' | 'EXCEL_OVERUSE' | 'APP_SWITCHING' | 'LONG_IDLE' | 'OUTLIER' | 'CLEAN'
type SortOption = 'NEWEST' | 'LONGEST' | 'SHORTEST' | 'SWITCHES'

export const AssociateDashboard: React.FC<AssociateDashboardProps> = ({
  associateId = 'EMP101',
  onSelectClaim
}) => {
  const [data, setData] = useState<AssociateTodayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<NvaFilterType>('ALL')
  const [sortBy, setSortBy] = useState<SortOption>('NEWEST')

  // Modals state
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false)
  const [isSimModalOpen, setIsSimModalOpen] = useState(false)
  const [activePatientName, setActivePatientName] = useState<string>('')
  const [trackingBannerVisible, setTrackingBannerVisible] = useState<boolean>(true)

  const loadData = async () => {
    try {
      const res = await api.getAssociateToday(associateId)
      setData(res)
    } finally {
      setLoading(false)
    }
  }

  // Setup 15s auto-polling
  const { countdown, isPolling, togglePolling, refreshNow } = useLivePolling(loadData, {
    intervalSec: 15,
    enabled: true
  })

  useEffect(() => {
    setLoading(true)
    loadData()
  }, [associateId])

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60)
    return `${mins}m ${sec % 60}s`
  }

  // Handle manual claim confirmation
  const handleConfirmClaim = async (claimId: string, patientName?: string) => {
    try {
      await api.setActiveClaim(associateId, claimId, patientName)
      setData(prev => {
        if (!prev) return null
        const isSameClaim = prev.active_claim_id === claimId
        return {
          ...prev,
          active_claim_id: claimId,
          app_distribution: isSameClaim ? prev.app_distribution : []
        }
      })
      if (patientName) setActivePatientName(patientName)
      setTrackingBannerVisible(true)
    } catch (err) {
      console.error('Failed to set active claim:', err)
    }
  }

  // Handle closing a claim
  const handleCloseClaim = async (claimId: string) => {
    try {
      await api.completeClaim(associateId, claimId)
      await loadData()
    } catch (err) {
      console.error('Failed to complete claim:', err)
    }
  }

  // Handle toggling claim status
  const handleToggleClaimStatus = async (claimId: string, newStatus: string) => {
    try {
      await api.updateClaimStatus(associateId, claimId, newStatus)
      await loadData()
    } catch (err) {
      console.error('Failed to update claim status:', err)
    }
  }

  // Filtered and sorted claims
  const processedClaims = useMemo(() => {
    if (!data?.recent_claims) return []

    let list = [...data.recent_claims]

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(c => c.claim_id.toLowerCase().includes(q))
    }

    if (filterType === 'FLAGGED') {
      list = list.filter(c => c.nva_flags.length > 0)
    } else if (filterType === 'CLEAN') {
      list = list.filter(c => c.nva_flags.length === 0)
    } else if (filterType !== 'ALL') {
      list = list.filter(c => c.nva_flags.includes(filterType))
    }

    list.sort((a, b) => {
      if (sortBy === 'LONGEST') return b.total_duration_seconds - a.total_duration_seconds
      if (sortBy === 'SHORTEST') return a.total_duration_seconds - b.total_duration_seconds
      if (sortBy === 'SWITCHES') return b.app_switches_count - a.app_switches_count
      return new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    })

    return list
  }, [data?.recent_claims, searchQuery, filterType, sortBy])

  // CSV Export
  const handleExportCsv = () => {
    let fallbackBreakdown: Record<string, number> = {}
    if (data?.app_distribution && Array.isArray(data.app_distribution)) {
      data.app_distribution.forEach(a => { fallbackBreakdown[a.app_name] = a.duration_seconds })
    }

    const claimsToExport = (data?.recent_claims && data.recent_claims.length > 0)
      ? data.recent_claims
      : (data?.active_claim_id && data.active_claim_id !== 'UNASSIGNED')
        ? [{
            claim_id: data.active_claim_id,
            associate_id: data.associate_id,
            session_id: data.session_id || `sess-${data.associate_id}-1`,
            start_time: new Date(Date.now() - (data.total_work_seconds || 0) * 1000).toISOString(),
            end_time: new Date().toISOString(),
            total_duration_seconds: data.total_work_seconds || 0,
            active_duration_seconds: data.total_active_seconds || 0,
            idle_duration_seconds: data.total_idle_seconds || 0,
            app_switches_count: 0,
            status: 'IN_PROGRESS' as const,
            nva_flags: [] as string[],
            app_breakdown: fallbackBreakdown
          }]
        : []

    if (claimsToExport.length === 0) return
    exportClaimsToVoiceTM_Csv(claimsToExport, data?.associate_name || `Associate ${associateId}`)
  }

  if (loading && !data) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ display: 'inline-block', marginBottom: 12 }}>
          <RefreshCw className="spin" size={28} color="#7c3aed" />
        </div>
        <div>Loading Associate Workspace ({associateId})...</div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Controls & Live Polling Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 9999,
              background: isPolling ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.12)',
              border: isPolling ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(148, 163, 184, 0.3)',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: isPolling ? '#059669' : '#64748b'
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: isPolling ? '#10b981' : '#94a3b8'
              }}
            />
            {isPolling ? `Live Polling (${countdown}s)` : 'Polling Paused'}
          </div>

          <button
            onClick={togglePolling}
            className="btn-ghost"
            style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: 8 }}
            title={isPolling ? 'Pause Polling' : 'Resume Polling'}
          >
            {isPolling ? <Pause size={13} /> : <Play size={13} />}
          </button>

          <button
            onClick={() => refreshNow()}
            className="btn-ghost"
            style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: 8 }}
            title="Refresh now"
          >
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Quick action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setIsPendingModalOpen(true)}
            style={{
              padding: '7px 14px',
              borderRadius: 12,
              border: '1px solid var(--border-subtle, #e2e8f0)',
              background: 'var(--bg-card, #ffffff)',
              color: 'var(--text-main, #18171c)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: 'var(--shadow-xs)'
            }}
          >
            <Inbox size={15} color="#7c3aed" />
            <span>Claims Queue</span>
          </button>

          <button
            onClick={() => setIsSimModalOpen(true)}
            style={{
              padding: '7px 14px',
              borderRadius: 12,
              border: '1px solid rgba(124, 58, 237, 0.3)',
              background: 'rgba(124, 58, 237, 0.08)',
              color: '#7c3aed',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Activity size={15} />
            <span>Simulate Live Adjudication</span>
          </button>

          <a
            href={CONFIG.OFFICE_PLATFORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '7px 14px',
              borderRadius: 12,
              fontSize: '0.8125rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#18171c',
              color: '#ffffff',
              fontWeight: 700,
              textDecoration: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(24, 23, 28, 0.15)'
            }}
          >
            <ExternalLink size={14} />
            <span>Open NovaArc RCM</span>
          </a>

          <button
            onClick={handleExportCsv}
            className="btn-ghost"
            style={{ padding: '7px 14px', fontSize: '0.8125rem', borderRadius: 12 }}
            title="Download Time & Motion log in exact Prev Entd Voice T&M format"
          >
            <Download size={14} />
            <span>Export T&amp;M CSV</span>
          </button>
        </div>
      </div>

      {/* Step 4 Tracking Confirmation Banner */}
      {data.active_claim_id && data.active_claim_id !== 'UNASSIGNED' && trackingBannerVisible && (
        <div className="tracking-banner" style={{ borderRadius: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={18} color="#10b981" strokeWidth={2.5} />
            <span>
              <strong>Tracking Claim: {data.active_claim_id}</strong>
              {activePatientName ? ` (${activePatientName})` : ''} — All activity will be linked to this claim.
            </span>
          </div>
          <button
            onClick={() => setTrackingBannerVisible(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#065f46',
              cursor: 'pointer',
              padding: '2px 6px',
              fontWeight: 800
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Active Claim Context Command Center */}
      <div
        className="command-card glass-card"
        style={{
          cursor: 'pointer',
          borderRadius: 24,
          padding: '24px 28px'
        }}
        onClick={() => setIsAssistantOpen(true)}
        title="Click to open Claim Work Assistant"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #18171c 0%, #312e38 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 6px 16px rgba(24, 23, 28, 0.25)'
            }}
          >
            <Zap size={24} color="#ffffff" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-muted, #716e7d)'
                }}
              >
                Active Claim Context
              </span>
              <span className="pulse-dot"></span>
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 9999,
                  background: data.active_claim_id && data.active_claim_id !== 'UNASSIGNED' ? '#ecfdf5' : '#f1f5f9',
                  color: data.active_claim_id && data.active_claim_id !== 'UNASSIGNED' ? '#059669' : '#475569',
                  border: data.active_claim_id && data.active_claim_id !== 'UNASSIGNED' ? '1px solid #a7f3d0' : '1px solid #cbd5e1'
                }}
              >
                {data.active_claim_id && data.active_claim_id !== 'UNASSIGNED' ? 'ACTIVE' : 'IDLE'}
              </span>
            </div>
            <div
              style={{
                fontSize: '1.625rem',
                fontWeight: 900,
                color: 'var(--text-main, #18171c)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '-0.02em'
              }}
            >
              {data.active_claim_id || 'IDLE / UNASSIGNED'}
              {activePatientName && data.active_claim_id && data.active_claim_id !== 'UNASSIGNED' && (
                <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: 10, fontFamily: 'var(--font-sans)' }}>
                  — {activePatientName}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary, #5b5866)' }}>
              All desktop interactions across Epic, Chrome &amp; Excel are actively attributed to this claim.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={e => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setIsAssistantOpen(true)}
            style={{
              background: '#18171c',
              color: '#ffffff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(24, 23, 28, 0.2)'
            }}
          >
            <Zap size={14} />
            <span>{data.active_claim_id && data.active_claim_id !== 'UNASSIGNED' ? 'Switch Claim' : 'Activate Claim'}</span>
          </button>

          {data.active_claim_id && data.active_claim_id !== 'UNASSIGNED' && (
            <button
              onClick={() => onSelectClaim(data.active_claim_id!)}
              style={{
                background: '#ffffff',
                color: '#18171c',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                padding: '10px 16px',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>Inspect Timeline</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16
        }}
      >
        <KpiCard
          title="Claims Today"
          value={`${data.completed_claims_count} / ${data.target_claims}`}
          benchmark={data.target_claims > 0 ? `Target Progress: ${Math.round((data.completed_claims_count / data.target_claims) * 100)}%` : 'Shift Target: In Progress'}
          icon={<CheckCircle2 size={16} />}
          status="optimal"
        />
        <KpiCard
          title="Avg Handle Time"
          value={`${data.aht_minutes}m`}
          benchmark="Target SLA: 6.5m"
          icon={<Clock size={16} />}
          status={data.aht_minutes <= 6.5 ? 'optimal' : 'warning'}
        />
        <KpiCard
          title="Idle Time Ratio"
          value={`${data.idle_percentage}%`}
          benchmark={`${Math.round(data.total_idle_seconds / 60)} mins idle`}
          icon={<AlertCircle size={16} />}
          status={data.idle_percentage <= 20 ? 'optimal' : 'warning'}
        />
        <KpiCard
          title="Efficiency Score"
          value={`${data.efficiency_score}%`}
          benchmark="Quality & Effort Composite"
          icon={<TrendingUp size={16} />}
          status="optimal"
        />
      </div>

      {/* Advanced Visualizations Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 16
        }}
      >
        <PerformanceWaveChart
          claims={data.recent_claims || []}
          benchmarkMinutes={6.5}
          onSelectClaim={onSelectClaim}
        />

        <SpeedometerGauge
          score={data.efficiency_score}
          targetScore={85}
          label="Adjudication Efficiency"
          sublabel="Calculated from real-time EHR & Payer active touch ratio"
        />
      </div>

      {/* Main Content 2-Column Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.8fr 1.2fr',
          gap: 16
        }}
      >
        {/* Left Column: Recent Claims Table */}
        <div className="glass-card" style={{ borderRadius: 24, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main, #18171c)', margin: 0 }}>
                Claims Handled Today
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #716e7d)' }}>
                {processedClaims.length} records matching current view
              </span>
            </div>

            <div style={{ position: 'relative', minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search claim..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 30px',
                  borderRadius: 10,
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  background: 'var(--bg-card, #ffffff)',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle, #e2e8f0)', color: 'var(--text-muted, #716e7d)' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>CLAIM ID</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>DURATION</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>SWITCHES</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>STATUS</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>NVA FLAGS</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {processedClaims.map(c => (
                  <tr
                    key={c.claim_id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                    onClick={() => onSelectClaim(c.claim_id)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-main, #18171c)' }}>
                      {c.claim_id}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {formatDuration(c.total_duration_seconds)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {c.app_switches_count}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 9999,
                          background: c.status === 'COMPLETED' ? '#ecfdf5' : '#eff6ff',
                          color: c.status === 'COMPLETED' ? '#059669' : '#2563eb'
                        }}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {c.nva_flags.length === 0 ? (
                          <span style={{ fontSize: '0.6875rem', color: '#10b981', fontWeight: 700 }}>Clean</span>
                        ) : (
                          c.nva_flags.map((f, i) => <NvaBadge key={i} flag={f} />)
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <ArrowRight size={14} color="#7c3aed" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Application Time Donut */}
        <div className="glass-card" style={{ borderRadius: 24, padding: 24 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main, #18171c)', margin: '0 0 16px 0' }}>
            Application Time Distribution
          </h2>
          <ApplicationTimeDonut
            items={data.app_distribution || []}
            activeClaimId={data.active_claim_id || undefined}
          />
        </div>
      </div>

      <ClaimWorkAssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        currentActiveClaim={data.active_claim_id}
        onConfirmClaim={handleConfirmClaim}
        onCloseClaim={handleCloseClaim}
        onToggleStatus={handleToggleClaimStatus}
        runningClaims={(data.recent_claims || []).map(c => ({
          claim_id: c.claim_id,
          patient_name: '',
          status: c.status
        }))}
      />

      <PendingClaimsModal
        isOpen={isPendingModalOpen}
        onClose={() => setIsPendingModalOpen(false)}
        onSelectClaim={handleConfirmClaim}
        currentActiveClaimId={data.active_claim_id}
      />

      <LiveSimulationModal
        isOpen={isSimModalOpen}
        onClose={() => setIsSimModalOpen(false)}
        associateId={associateId}
        claimId={data.active_claim_id || 'CLM-9021'}
        onCompleteSimulation={async (cid) => {
          await handleConfirmClaim(cid)
          await handleCloseClaim(cid)
        }}
      />
    </div>
  )
}
