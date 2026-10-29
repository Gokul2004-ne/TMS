import React, { useState, useEffect, useMemo, useRef } from 'react'
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
  FileCheck2
} from 'lucide-react'
import { AssociateTodayData, PendingClaimItem } from '../api/types'
import { api } from '../api/client'
import { KpiCard } from '../components/KpiCard'
import { ApplicationTimeDonut } from '../components/ApplicationTimeDonut'
import { NvaBadge } from '../components/NvaBadge'
import { ClaimWorkAssistantModal } from '../components/ClaimWorkAssistantModal'
import { PendingClaimsModal } from '../components/PendingClaimsModal'
import { exportClaimsToVoiceTM_Csv } from '../utils/csvExporter'
import { useLivePolling } from '../hooks/useLivePolling'
import { CONFIG } from '../config'
import { ClaimTypeDefinition } from '../constants/claimTypes'

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
  const [pendingClaims, setPendingClaims] = useState<PendingClaimItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<NvaFilterType>('ALL')
  const [sortBy, setSortBy] = useState<SortOption>('NEWEST')

  // Modals state
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false)
  const [activePatientName, setActivePatientName] = useState<string>('')
  const [trackingBannerVisible, setTrackingBannerVisible] = useState<boolean>(true)
  const [lastlyWorkedClaim, setLastlyWorkedClaim] = useState<string | null>(null)
  const [liveElapsedSec, setLiveElapsedSec] = useState<number>(0)
  // Track which claim the running timer belongs to (to detect claim switches)
  const [timerClaimId, setTimerClaimId] = useState<string | null>(null)

  const isFetchingRef = useRef(false)

  const loadData = async () => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    try {
      const [assocRes, pendingRes] = await Promise.all([
        api.getAssociateToday(associateId),
        api.getPendingClaims(associateId)
      ])
      setData(assocRes)
      setPendingClaims(pendingRes)
      if (assocRes) {
        const incomingClaimId = (assocRes.active_claim_id && assocRes.active_claim_id !== 'UNASSIGNED')
          ? assocRes.active_claim_id
          : null
        const serverElapsed = assocRes.active_elapsed_seconds || 0

        if (incomingClaimId) {
          setTimerClaimId(prev => {
            if (prev !== incomingClaimId) {
              // New or different claim - hard-reset timer to server value
              setLiveElapsedSec(serverElapsed)
              return incomingClaimId
            } else {
              // Same claim - only correct if local timer is stale (drifted >5s behind server)
              setLiveElapsedSec(current => {
                if (serverElapsed - current > 5) return serverElapsed
                return current  // Keep local tick running smoothly
              })
              return prev
            }
          })
        } else {
          setTimerClaimId(null)
          setLiveElapsedSec(0)
        }

        setLastlyWorkedClaim(prev => {
          if (prev) return prev
          if (assocRes.recent_claims && assocRes.recent_claims.length > 0) {
            const prior = assocRes.recent_claims.find(
              c => c.claim_id !== assocRes.active_claim_id && c.claim_id !== 'UNASSIGNED'
            )
            if (prior) return prior.claim_id
            return assocRes.recent_claims[0].claim_id
          }
          return null
        })
      }
    } finally {
      setLoading(false)
    }
  }

  // Live 1-second timer tick for active claim countdown & elapsed time
  useEffect(() => {
    if (data?.active_claim_id && data.active_claim_id !== 'UNASSIGNED') {
      const timer = setInterval(() => {
        setLiveElapsedSec(prev => prev + 1)
      }, 1000)
      return () => clearInterval(timer)
    } else {
      setLiveElapsedSec(0)
    }
  }, [data?.active_claim_id])

  // Setup real-time auto-polling (3s for instant live demo response)
  const { countdown, isPolling, togglePolling, refreshNow } = useLivePolling(loadData, {
    intervalSec: Math.round(CONFIG.POLL_INTERVAL_MS / 1000) || 3,
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

  const formatMmSs = (sec: number) => {
    const clamped = Math.max(0, sec)
    const m = Math.floor(clamped / 60)
    const s = clamped % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Handle manual claim confirmation (Idea_pic.jpeg Step 3 & 4)
  const handleConfirmClaim = async (
    claimId: string,
    patientName?: string
  ) => {
    try {
      if (data?.active_claim_id && data.active_claim_id !== 'UNASSIGNED' && data.active_claim_id !== claimId) {
        setLastlyWorkedClaim(data.active_claim_id)
      }

      const activeRes = await api.setActiveClaim(associateId, claimId)
      setData(prev => {
        if (!prev) return null
        return {
          ...prev,
          active_claim_id: claimId,
          active_claim_type: (activeRes as any)?.action_type || prev.active_claim_type,
          active_target_minutes: (activeRes as any)?.target_minutes || prev.active_target_minutes,
          active_target_seconds: (activeRes as any)?.target_seconds || prev.active_target_seconds,
          active_elapsed_seconds: 0,
          app_distribution: []
        }
      })
      setLiveElapsedSec(0)
      if (patientName) setActivePatientName(patientName)
      setTrackingBannerVisible(true)
      await loadData()
    } catch (err) {
      console.error('Failed to set active claim:', err)
    }
  }

  // Handle starting a claim from PendingClaimsModal
  const handleStartClaim = async (claimId: string) => {
    setIsPendingModalOpen(false)
    await handleConfirmClaim(claimId)
  }

  // Handle closing a claim from the assistant (marks COMPLETED, exports to Excel, refreshes dashboard)
  const handleCloseClaim = async (claimId: string) => {
    try {
      await api.completeClaim(associateId, claimId)
      setLastlyWorkedClaim(claimId)
      // Immediately reload data so claim shows as COMPLETED in recent claims and KPIs update
      await loadData()
    } catch (err) {
      console.error('Failed to complete claim:', err)
    }
  }

  // Handle toggling claim status from the assistant
  const handleToggleClaimStatus = async (claimId: string, newStatus: string) => {
    try {
      await api.updateClaimStatus(associateId, claimId, newStatus)
      if (newStatus === 'COMPLETED') {
        setLastlyWorkedClaim(claimId)
      }
      await loadData()
    } catch (err) {
      console.error('Failed to update claim status:', err)
    }
  }

  // Filtered, deduplicated, and sorted claims
  const processedClaims = useMemo(() => {
    if (!data?.recent_claims) return []

    // 0. Deduplicate by unique claim_id (keep latest/active entry)
    const dedupedMap = new Map<string, typeof data.recent_claims[0]>()
    for (const c of data.recent_claims) {
      if (!c.claim_id) continue
      const existing = dedupedMap.get(c.claim_id)
      if (!existing) {
        dedupedMap.set(c.claim_id, c)
      } else {
        if (c.status === 'IN_PROGRESS') {
          dedupedMap.set(c.claim_id, c)
        } else if (existing.status !== 'IN_PROGRESS' && (c.total_duration_seconds > existing.total_duration_seconds || c.app_switches_count > existing.app_switches_count)) {
          dedupedMap.set(c.claim_id, c)
        }
      }
    }

    let list = Array.from(dedupedMap.values())

    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(c => c.claim_id.toLowerCase().includes(q))
    }

    // 2. NVA Category Filter
    if (filterType === 'FLAGGED') {
      list = list.filter(c => c.nva_flags.length > 0)
    } else if (filterType === 'CLEAN') {
      list = list.filter(c => c.nva_flags.length === 0)
    } else if (filterType !== 'ALL') {
      list = list.filter(c => c.nva_flags.includes(filterType))
    }

    // 3. Sorting
    list.sort((a, b) => {
      if (sortBy === 'LONGEST') return b.total_duration_seconds - a.total_duration_seconds
      if (sortBy === 'SHORTEST') return a.total_duration_seconds - b.total_duration_seconds
      if (sortBy === 'SWITCHES') return b.app_switches_count - a.app_switches_count
      return new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    })

    return list
  }, [data?.recent_claims, searchQuery, filterType, sortBy])

  // CSV Export - Matches exact 'Prev Entd Voice T&M.xlsx' columns
  const handleExportCsv = () => {
    let fallbackBreakdown: Record<string, number> = {}
    if (data?.app_distribution && Array.isArray(data.app_distribution)) {
      data.app_distribution.forEach(a => { fallbackBreakdown[a.app_name] = a.duration_seconds })
    }

    const claimsToExport = (processedClaims && processedClaims.length > 0)
      ? processedClaims
      : (data?.recent_claims && data.recent_claims.length > 0)
        ? data.recent_claims
        : (data?.active_claim_id && data.active_claim_id !== 'UNASSIGNED')
          ? [{
              claim_id: data.active_claim_id,
              associate_id: data.associate_id,
              session_id: data.session_id || `sess-${data.associate_id}-1`,
              start_time: new Date(Date.now() - (data.total_work_seconds || 0) * 1000).toISOString(),
              end_time: new Date().toISOString(),
              total_duration_seconds: liveElapsedSec || data.total_work_seconds || 0,
              active_duration_seconds: liveElapsedSec || data.total_active_seconds || 0,
              idle_duration_seconds: data.total_idle_seconds || 0,
              app_switches_count: 0,
              status: 'IN_PROGRESS' as const,
              action_type: data.active_claim_type || 'CR - Call / IVR',
              target_minutes: data.active_target_minutes || 14,
              target_seconds: data.active_target_seconds || 840,
              variance_seconds: (data.active_target_seconds || 840) - (liveElapsedSec || 0),
              nva_flags: [] as string[],
              app_breakdown: fallbackBreakdown
            }]
          : []

    if (claimsToExport.length === 0) return
    exportClaimsToVoiceTM_Csv(claimsToExport, data?.associate_name || `Associate ${associateId}`, 'TMS_Claim_Activity_Report', data)
  }

  const overdueCount = pendingClaims.filter(c => c.urgency === 'OVERDUE').length

  if (loading && !data) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ display: 'inline-block', marginBottom: 12 }}>
          <RefreshCw className="spin" size={28} color="var(--accent-primary)" />
        </div>
        <div>Loading Associate Workspace ({associateId})...</div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div>
      {/* Top Controls & Live Polling Status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: isPolling ? '#f0fdf4' : '#f8fafc',
            border: isPolling ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: isPolling ? 'var(--accent-emerald)' : 'var(--text-dim)'
          }}>
            <span style={{ width: 6, height: 6, background: isPolling ? '#15803d' : '#94a3b8' }} />
            {isPolling ? `Live Polling (${countdown}s)` : 'Polling Paused'}
          </div>

          <button
            onClick={togglePolling}
            className="btn-ghost"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            title={isPolling ? 'Pause Polling' : 'Resume Polling'}
          >
            {isPolling ? <Pause size={12} /> : <Play size={12} />}
          </button>

          <button
            onClick={() => refreshNow()}
            className="btn-ghost"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            title="Refresh now"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

          {/* Pending Claims Modal Trigger with Badge */}
          <button
            onClick={() => setIsPendingModalOpen(true)}
            style={{
              padding: '6px 14px',
              fontSize: '0.8125rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: overdueCount > 0 ? '#b91c1c' : '#0f172a',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <FileCheck2 size={15} />
            <span>Pending Claims</span>
            <span
              style={{
                background: overdueCount > 0 ? '#fef2f2' : '#3b82f6',
                color: overdueCount > 0 ? '#b91c1c' : '#ffffff',
                fontSize: 11,
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: 10
              }}
            >
              {pendingClaims.length}
            </span>
          </button>

          <a
            href={CONFIG.OFFICE_PLATFORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '6px 14px',
              fontSize: '0.8125rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#4f46e5',
              color: '#ffffff',
              border: '1px solid #4338ca',
              fontWeight: 700,
              textDecoration: 'none',
              cursor: 'pointer'
            }}
            title="Open NovaArc RCM Company Platform in browser"
          >
            <ExternalLink size={14} />
            <span>Open NovaArc RCM</span>
          </a>

          <button
            onClick={handleExportCsv}
            className="btn-ghost"
            style={{ padding: '6px 14px', fontSize: '0.8125rem' }}
            title="Download Time & Motion log in exact Prev Entd Voice T&M format"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Step 4 Tracking Confirmation Banner (Idea_pic.jpeg Step 4) */}
      {data.active_claim_id && data.active_claim_id !== 'UNASSIGNED' && trackingBannerVisible && (
        <div className="tracking-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={18} color="#10b981" strokeWidth={2.5} />
            <span>
              <strong>Tracking Claim: {data.active_claim_id}</strong>
              {activePatientName ? ` (${activePatientName})` : ''} - Desktop agent is automatically recording active time, idle periods, and app switches for this claim.
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
            title="Dismiss banner"
          >
            x
          </button>
        </div>
      )}

      {/* Active Claim Context Command Center (Reference Idea_pic.jpeg Step 3 & 4) */}
      {(() => {
        const activeClaimId = data.active_claim_id
        const isClaimActive = Boolean(activeClaimId && activeClaimId !== 'UNASSIGNED')
        const activeType = data.active_claim_type || 'CR - Call / IVR'
        const activeTargetMins = data.active_target_minutes || 14
        const activeTargetSecs = data.active_target_seconds || (activeTargetMins * 60)
        const activeRemainingSecs = activeTargetSecs - liveElapsedSec
        const isOvertime = activeRemainingSecs <= 0
        const isRunningOut = activeRemainingSecs <= 120

        return (
          <div
            className="command-card"
            style={{ cursor: 'pointer', padding: '14px 20px' }}
            onClick={() => setIsAssistantOpen(true)}
            title="Click to open Claim Work Assistant"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
              <div style={{
                width: 48,
                height: 48,
                background: isClaimActive ? '#059669' : '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${isClaimActive ? '#059669' : '#0f172a'}`,
                flexShrink: 0
              }}>
                <Zap size={24} color="#ffffff" strokeWidth={2.5} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#475569'
                  }}>
                    Active Claim Context
                  </span>
                  <span className="pulse-dot"></span>
                  <span style={{
                    fontSize: '0.625rem',
                    fontWeight: 800,
                    padding: '1px 6px',
                    background: isClaimActive ? '#059669' : '#0f172a',
                    color: '#ffffff'
                  }}>
                    {isClaimActive ? 'LIVE TRACKING' : 'IDLE / READY'}
                  </span>
                </div>

                {isClaimActive ? (
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                    {/* Claim ID */}
                    <div
                      onClick={() => onSelectClaim(activeClaimId)}
                      title={`Inspect Claim Deep Dive for ${activeClaimId}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 10px',
                        background: '#f1f5f9', border: '1px solid #cbd5e1',
                        fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Claim ID:</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '0.9rem', color: '#0f172a' }}>{activeClaimId}</span>
                      <ExternalLink size={12} color="#059669" />
                    </div>

                    <span style={{ color: '#cbd5e1', fontSize: '1.25rem', fontWeight: 300 }}>|</span>

                    {/* Claim Type */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px',
                      background: '#f1f5f9', border: '1px solid #cbd5e1',
                      fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b'
                    }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Claim Type:</span>
                      <span>{activeType}</span>
                    </div>

                    <span style={{ color: '#cbd5e1', fontSize: '1.25rem', fontWeight: 300 }}>|</span>

                    {/* Target time countdown */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px',
                      background: isRunningOut ? '#fef2f2' : '#ecfdf5',
                      border: `1.5px solid ${isRunningOut ? '#ef4444' : '#10b981'}`,
                      fontSize: '0.8125rem', fontWeight: 700,
                      color: isRunningOut ? '#b91c1c' : '#047857',
                      transition: 'all 0.3s ease'
                    }}>
                      <Clock size={14} color={isRunningOut ? '#ef4444' : '#10b981'} />
                      <span style={{ color: isRunningOut ? '#b91c1c' : '#475569', fontWeight: 600 }}>Target time:</span>
                      <span
                        className="mono"
                        style={{
                          fontWeight: 900,
                          fontSize: '1rem',
                          color: isRunningOut ? '#dc2626' : '#047857'
                        }}
                      >
                        {activeRemainingSecs > 0 ? formatMmSs(activeRemainingSecs) : `00:00 (+${formatMmSs(liveElapsedSec - activeTargetSecs)} OT)`}
                      </span>
                    </div>

                    <span style={{ color: '#cbd5e1', fontSize: '1.25rem', fontWeight: 300 }}>|</span>

                    {/* Time taken (elapsed) */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a'
                    }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Time taken:</span>
                      <span className="mono" style={{ fontWeight: 900, fontSize: '0.95rem' }}>{formatMmSs(liveElapsedSec)}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{
                      fontSize: '1.625rem',
                      fontWeight: 900,
                      color: '#64748b',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '-0.02em'
                    }}>
                      UNASSIGNED
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                      No active claim context detected. Launch a claim from NovaArc RCM or click Activate Claim to begin.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setIsAssistantOpen(true)}
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  border: '1px solid #0f172a',
                  padding: '8px 16px',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Zap size={14} />
                <span>{isClaimActive ? 'Switch Claim' : 'Activate Claim'}</span>
              </button>
            </div>
          </div>
        )
      })()}

      {/* Claim Work Assistant Modal (Idea_pic.jpeg Step 3) */}
      <ClaimWorkAssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        currentActiveClaim={data.active_claim_id}
        lastlyWorkedClaim={lastlyWorkedClaim}
        onConfirmClaim={handleConfirmClaim}
        onCloseClaim={handleCloseClaim}
        onToggleStatus={handleToggleClaimStatus}
        runningClaims={(data.recent_claims || []).map(c => ({
          claim_id: c.claim_id,
          patient_name: '',
          status: c.status
        }))}
      />

      {/* Pending Claims / Denials Modal */}
      <PendingClaimsModal
        isOpen={isPendingModalOpen}
        onClose={() => setIsPendingModalOpen(false)}
        pendingClaims={pendingClaims}
        onStartClaim={handleStartClaim}
        activeClaimId={data.active_claim_id}
      />

      {/* 4 Top KPI Cards (NovaChron Aligned) */}
      <div className="kpi-grid">
        <KpiCard
          title="Claims Processed"
          value={`${data.completed_claims_count} / ${data.target_claims}`}
          subtitle={data.expected_output ? `Target: ${data.expected_output} exp | Attain: ${data.output_attainment ?? 100}%` : 'Shift Target: In Progress'}
          icon={<CheckCircle2 size={16} />}
          accentColor="#10b981"
          badge={data.completed_claims_count > 0 ? (data.output_attainment && data.output_attainment >= 95 ? "ON TARGET" : "IN PROGRESS") : undefined}
        />
        <KpiCard
          title="Average Handling Time (AHT)"
          value={`${data.aht_minutes}m`}
          subtitle={`Benchmark: 9.0m | Attain: ${data.aht_attainment ?? 100}%`}
          icon={<Clock size={16} />}
          accentColor="#0f172a"
        />
        <KpiCard
          title="Occupancy & Utilisation"
          value={`${data.occupancy_percentage ?? 85}%`}
          subtitle={`Util: ${data.utilisation_percentage ?? 80}% | Idle: ${data.idle_percentage}%`}
          icon={<AlertCircle size={16} />}
          accentColor="#d97706"
        />
        <KpiCard
          title="Performance Index (C01)"
          value={`${data.c01_performance_index ?? data.efficiency_score}%`}
          subtitle={`${data.performance_band || 'On target'} | ${data.points_today ?? 85} pts (L${data.level_number || 4} ${data.level_name || 'Specialist'})`}
          icon={<TrendingUp size={16} />}
          accentColor="#7c3aed"
          badge={data.status_label || "OPTIMAL"}
        />
      </div>

      {/* NovaChron 5-Factor Composite Performance Strip (Section 8 & 9) */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        padding: '12px 18px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
              C01 Factor Blend:
            </span>
          </div>

          {/* Factor 1: Output Attainment (30%) */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>
            <span style={{ color: '#64748b' }}>Output (30%):</span>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>{data.output_attainment ?? 97.0}%</span>
          </div>

          <span style={{ color: '#cbd5e1' }}>|</span>

          {/* Factor 2: AHT Attainment (20%) */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>
            <span style={{ color: '#64748b' }}>AHT (20%):</span>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>{data.aht_attainment ?? 95.7}%</span>
          </div>

          <span style={{ color: '#cbd5e1' }}>|</span>

          {/* Factor 3: Utilisation (20%) */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>
            <span style={{ color: '#64748b' }}>Util (20%):</span>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>{data.utilisation_percentage ?? 75.8}%</span>
          </div>

          <span style={{ color: '#cbd5e1' }}>|</span>

          {/* Factor 4: Quality (15%) */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>
            <span style={{ color: '#64748b' }}>Quality (15%):</span>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>{data.quality_score ?? 96.2}%</span>
          </div>

          <span style={{ color: '#cbd5e1' }}>|</span>

          {/* Factor 5: SOP (15%) */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>
            <span style={{ color: '#64748b' }}>SOP (15%):</span>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>{data.sop_adherence ?? 94.0}%</span>
          </div>
        </div>

        {/* Level & Points Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            padding: '3px 8px',
            fontSize: '0.75rem',
            fontWeight: 800,
            color: '#0f172a'
          }}>
            <span>Level {data.level_number || 4}: {data.level_name || 'Specialist'} ({data.lifetime_points || 2840} pts{data.points_to_next_level ? ` | ${data.points_to_next_level} to L${(data.level_number || 4) + 1}` : ''})</span>
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: '#ecfdf5',
            border: '1px solid #10b981',
            padding: '3px 8px',
            fontSize: '0.75rem',
            fontWeight: 800,
            color: '#047857'
          }}>
            <span>+{data.points_today ?? 85} pts today</span>
          </div>
        </div>
      </div>

      {/* Main Content 2-Column Grid */}
      <div className="two-col-grid">
        {/* Left Column: Recent Claims Table with Filters */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 className="title-md">Today's Claim Activity Log</h2>
              <p className="text-sub">Chronological list of claims processed in this shift</p>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
              Showing {processedClaims.length} of {data.recent_claims.length} claims
            </span>
          </div>

          {/* Search, Filter Pills & Sort Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: 10 }} />
                <input
                  type="text"
                  placeholder="Search claim ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 32px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: 'var(--text-main)',
                    fontSize: '0.8125rem'
                  }}
                />
              </div>

              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortOption)}
                style={{
                  padding: '8px 12px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: 'var(--text-main)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <option value="NEWEST">Sort: Newest First</option>
                <option value="LONGEST">Sort: Longest Handling Time</option>
                <option value="SHORTEST">Sort: Shortest Handling Time</option>
                <option value="SWITCHES">Sort: Most App Switches</option>
              </select>
            </div>

            {/* Filter Pills - Sharp 2D Buttons */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['ALL', 'FLAGGED', 'EXCEL_OVERUSE', 'APP_SWITCHING', 'LONG_IDLE', 'OUTLIER', 'CLEAN'] as NvaFilterType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: filterType === type ? '#0f172a' : '#ffffff',
                    color: filterType === type ? '#ffffff' : 'var(--text-muted)',
                    border: filterType === type ? '1px solid #0f172a' : '1px solid #cbd5e1',
                    transition: 'all 0.1s ease'
                  }}
                >
                  {type === 'ALL' && 'All Claims'}
                  {type === 'FLAGGED' && 'Flagged Only'}
                  {type === 'EXCEL_OVERUSE' && 'Excel Overuse'}
                  {type === 'APP_SWITCHING' && 'App Switches'}
                  {type === 'LONG_IDLE' && 'Long Idle'}
                  {type === 'OUTLIER' && 'Outliers'}
                  {type === 'CLEAN' && 'Clean Adjudication'}
                </button>
              ))}
            </div>
          </div>

          <table className="tms-table">
            <thead>
              <tr>
                <th style={{ minWidth: 110 }}>Claim ID</th>
                <th style={{ minWidth: 150 }}>Claim Type</th>
                <th style={{ minWidth: 110 }}>Handling Time</th>
                <th style={{ minWidth: 180 }}>Target Variance</th>
                <th style={{ minWidth: 100 }}>App Switches</th>
                <th style={{ minWidth: 160 }}>NVA Flags</th>
                <th style={{ minWidth: 110 }}>Status</th>
                <th style={{ minWidth: 70, textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {processedClaims.map((c, i) => {
                const isItemActive = c.status === 'IN_PROGRESS'
                const displayDuration = isItemActive && c.claim_id === data.active_claim_id
                  ? liveElapsedSec
                  : c.total_duration_seconds
                const cTargetSec = c.target_seconds || (c.target_minutes ? c.target_minutes * 60 : 840)
                const cTargetMins = c.target_minutes || Math.round(cTargetSec / 60)
                const variance = cTargetSec - displayDuration

                return (
                  <tr
                    key={i}
                    onClick={() => onSelectClaim(c.claim_id)}
                    style={{
                      cursor: 'pointer',
                      background: isItemActive ? '#f0fdf4' : undefined
                    }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isItemActive && <span className="pulse-dot" style={{ width: 8, height: 8 }} />}
                        <span className="mono" style={{ fontWeight: 800, color: '#0f172a' }}>
                          {c.claim_id}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                        {c.action_type || 'CR - Call / IVR'}
                      </span>
                    </td>
                    <td>
                      <span className="mono" style={{ fontWeight: 700 }}>
                        {formatDuration(displayDuration)}
                      </span>
                    </td>
                    <td>
                      {isItemActive ? (
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: variance <= 120 ? '#dc2626' : '#15803d',
                          background: variance <= 120 ? '#fee2e2' : '#dcfce7',
                          padding: '3px 8px',
                          border: `1px solid ${variance <= 120 ? '#fca5a5' : '#86efac'}`,
                          borderRadius: 2,
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          Target ({cTargetMins}m): {variance > 0 ? `${formatMmSs(variance)} left` : `-${formatDuration(Math.abs(variance))} over`}
                        </span>
                      ) : (
                        <div style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}>
                          {variance >= 0 ? (
                            <span style={{
                              color: '#15803d',
                              fontWeight: 800,
                              fontSize: '0.75rem',
                              background: '#dcfce7',
                              padding: '3px 8px',
                              border: '1px solid #bbf7d0',
                              borderRadius: 2,
                              whiteSpace: 'nowrap'
                            }}>
                              (saved +{formatDuration(variance)})
                            </span>
                          ) : (
                            <span style={{
                              color: '#dc2626',
                              fontWeight: 800,
                              fontSize: '0.75rem',
                              background: '#fee2e2',
                              padding: '3px 8px',
                              border: '1px solid #fecaca',
                              borderRadius: 2,
                              whiteSpace: 'nowrap'
                            }}>
                              (additional -{formatDuration(Math.abs(variance))})
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>{c.app_switches_count}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {c.nva_flags.length > 0 ? (
                          c.nva_flags.map((f, fi) => <NvaBadge key={fi} flag={f} />)
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>None</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        background: isItemActive ? '#ecfdf5' : '#f0fdf4',
                        color: isItemActive ? '#059669' : '#15803d',
                        border: `1px solid ${isItemActive ? '#a7f3d0' : '#bbf7d0'}`,
                        borderRadius: 2
                      }}>
                        {isItemActive ? 'IN PROGRESS' : 'COMPLETED'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-ghost"
                        style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectClaim(c.claim_id)
                        }}
                        title={`Deep Dive into ${c.claim_id}`}
                      >
                        <ExternalLink size={12} />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {processedClaims.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)' }}>
                    No claims match your current filter or search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Right Column: Application Time Distribution (Analytical Donut View) */}
        <div className="glass-card">
          <div style={{ marginBottom: 16 }}>
            <h2 className="title-md">Application Time Share</h2>
            <p className="text-sub">
              {data.active_claim_id && data.active_claim_id !== 'UNASSIGNED'
                ? `Where time was spent on active claim (${data.active_claim_id})`
                : `Where time was spent across today's shift`}
            </p>
          </div>

          <ApplicationTimeDonut
            items={data.app_distribution}
            activeClaimId={data.active_claim_id}
          />
        </div>

      </div>
    </div>
  )
}