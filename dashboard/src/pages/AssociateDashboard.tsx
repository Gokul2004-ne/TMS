import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
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
  FileCheck2,
  Layers
} from 'lucide-react'
import { AssociateTodayData, PendingClaimItem } from '../api/types'
import { api } from '../api/client'
import { KpiCard } from '../components/KpiCard'
import { ApplicationTimeDonut } from '../components/ApplicationTimeDonut'
import { NvaBadge } from '../components/NvaBadge'
import { exportClaimsToVoiceTM_Csv } from '../utils/csvExporter'
import { useLivePolling } from '../hooks/useLivePolling'
import { CONFIG } from '../config'
import { ClaimTypeDefinition } from '../constants/claimTypes'
import { formatAhtDisplay } from '../utils/metricFormatting'

const ClaimWorkAssistantModal = React.lazy(() => import('../components/ClaimWorkAssistantModal').then(m => ({ default: m.ClaimWorkAssistantModal })))
const PendingClaimsModal = React.lazy(() => import('../components/PendingClaimsModal').then(m => ({ default: m.PendingClaimsModal })))

interface AssociateDashboardProps {
  associateId?: string
  onSelectClaim: (claimId: string, associateId?: string) => void
  onSwitchAssociate?: (assocId: string, isAutoSync?: boolean) => void
  allowAutoSyncAssociate?: boolean
}

type NvaFilterType = 'ALL' | 'FLAGGED' | 'EXCEL_OVERUSE' | 'APP_SWITCHING' | 'LONG_IDLE' | 'OUTLIER' | 'CLEAN'
type SortOption = 'NEWEST' | 'LONGEST' | 'SHORTEST' | 'SWITCHES'

export const AssociateDashboard: React.FC<AssociateDashboardProps> = ({
  associateId = 'EMP101',
  onSelectClaim,
  onSwitchAssociate,
  allowAutoSyncAssociate = true
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
  const [mismatchLiveAssociate, setMismatchLiveAssociate] = useState<{ associate_id: string; claim_id?: string } | null>(null)
  const lastMismatchCheckRef = useRef<number>(0)
  const hasAutoSwitchedRef = useRef<boolean>(false)

  // Retrieve persisted active claim timer across component remounts & view navigation
  const getPersistedTimer = useCallback((): { claimId: string | null; elapsed: number } => {
    try {
      const stored = localStorage.getItem(`tms_active_timer_${associateId}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.claimId && typeof parsed.serverElapsed === 'number' && parsed.syncedAt) {
          const elapsedSinceSync = Math.max(0, Math.floor((Date.now() - parsed.syncedAt) / 1000))
          const totalElapsed = parsed.serverElapsed + elapsedSinceSync
          if (totalElapsed >= 0 && totalElapsed < 86400) {
            return { claimId: parsed.claimId, elapsed: totalElapsed }
          }
        }
      }
    } catch {}
    return { claimId: null, elapsed: 0 }
  }, [associateId])

  const onSwitchAssociateRef = useRef(onSwitchAssociate)
  onSwitchAssociateRef.current = onSwitchAssociate

  const initialTimer = useMemo(() => getPersistedTimer(), [getPersistedTimer])
  const [liveElapsedSec, setLiveElapsedSec] = useState<number>(initialTimer.elapsed)
  // Track which claim the running timer belongs to (to detect claim switches)
  const timerClaimIdRef = useRef<string | null>(initialTimer.claimId)

  const isFetchingRef = useRef(false)

  const loadData = useCallback(async () => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    try {
      const [assocRes, p] = await Promise.allSettled([
        api.getAssociateToday(associateId),
        api.getPendingClaims(associateId)
      ])

      if (assocRes.status === 'fulfilled' && assocRes.value) {
        setData(assocRes.value)
        const incomingClaimId = (assocRes.value.active_claim_id && assocRes.value.active_claim_id !== 'UNASSIGNED')
          ? assocRes.value.active_claim_id
          : null
        const serverElapsed = assocRes.value.active_elapsed_seconds || 0

        if (incomingClaimId) {
          // Authoritative elapsed time directly from server (immune to client timezone offset)
          const calcElapsed = serverElapsed

          // Persist to localStorage with syncedAt so view switches never reset timer
          try {
            localStorage.setItem(`tms_active_timer_${associateId}`, JSON.stringify({
              claimId: incomingClaimId,
              serverElapsed: serverElapsed,
              syncedAt: Date.now()
            }))
          } catch {}

          if (timerClaimIdRef.current !== incomingClaimId) {
            // New or different claim - hard-reset timer cleanly to calcElapsed
            timerClaimIdRef.current = incomingClaimId
            setLiveElapsedSec(calcElapsed)
          } else {
            // Same claim - only correct if local timer drifted by > 3s behind server
            setLiveElapsedSec(current => {
              if (Math.abs(calcElapsed - current) > 3) return calcElapsed
              return current  // Keep local tick running smoothly with zero jitter
            })
          }
        } else {
          timerClaimIdRef.current = null
          setLiveElapsedSec(0)
          try {
            localStorage.removeItem(`tms_active_timer_${associateId}`)
          } catch {}

          // Check if current profile is UNASSIGNED while another associate has live desktop tracking
          if (!CONFIG.USE_MOCK) {
            const nowMs = Date.now()
            if (nowMs - lastMismatchCheckRef.current > 10000) {
              lastMismatchCheckRef.current = nowMs
              api.getTeamOverview().then(team => {
                const liveAssoc = (team.associates || []).find(
                  a => a.associate_id !== associateId && a.current_claim_id && a.current_claim_id !== 'UNASSIGNED'
                ) || (
                  assocRes.value.completed_claims_count === 0
                    ? (team.associates || []).find(a => a.associate_id !== associateId && (a.status === 'ACTIVE' || (a.completed_claims > 0 && a.associate_id === 'EMP101')))
                    : undefined
                )
                if (liveAssoc) {
                  setMismatchLiveAssociate({
                    associate_id: liveAssoc.associate_id,
                    claim_id: liveAssoc.current_claim_id !== 'UNASSIGNED' ? liveAssoc.current_claim_id : undefined
                  })
                  if (allowAutoSyncAssociate && onSwitchAssociateRef.current && !hasAutoSwitchedRef.current && liveAssoc.current_claim_id && liveAssoc.current_claim_id !== 'UNASSIGNED') {
                    hasAutoSwitchedRef.current = true
                    onSwitchAssociateRef.current(liveAssoc.associate_id, true)
                  }
                } else {
                  setMismatchLiveAssociate(null)
                }
              }).catch(() => {})
            }
          } else {
            setMismatchLiveAssociate(null)
          }
        }

        setLastlyWorkedClaim(prev => {
          if (prev) return prev
          if (assocRes.value.recent_claims && assocRes.value.recent_claims.length > 0) {
            const prior = assocRes.value.recent_claims.find(
              c => c.claim_id !== assocRes.value.active_claim_id && c.claim_id !== 'UNASSIGNED'
            )
            if (prior) return prior.claim_id
            return assocRes.value.recent_claims[0].claim_id
          }
          return null
        })
      }

      if (p.status === 'fulfilled' && Array.isArray(p.value)) {
        setPendingClaims(p.value)
      }
    } catch (err) {
      console.error('[Dashboard] Error polling associate today:', err)
    } finally {
      isFetchingRef.current = false
      setLoading(false)
    }
  }, [associateId, allowAutoSyncAssociate])

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

  // Setup real-time auto-polling with fast 4s interval for instantaneous claim status updates
  const pollingOptions = useMemo(() => ({
    intervalSec: 4,
    enabled: true
  }), [])

  const { countdown, isPolling, togglePolling, refreshNow } = useLivePolling(loadData, pollingOptions)

  // Only load on mount or when associateId changes
  useEffect(() => {
    setLoading(true)
    loadData()
  }, [loadData])

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
    patientName?: string,
    actionType?: string,
    targetMinutes?: number
  ) => {
    try {
      if (data?.active_claim_id && data.active_claim_id !== 'UNASSIGNED' && data.active_claim_id !== claimId) {
        setLastlyWorkedClaim(data.active_claim_id)
      }

      const effectiveType = actionType || data?.active_claim_type || 'CR - Call / IVR'
      const effectiveMinutes = targetMinutes || data?.active_target_minutes || 14
      const effectiveSeconds = targetMinutes ? targetMinutes * 60 : (data?.active_target_seconds || 840)

      // Optimistically update UI immediately so user sees instant feedback
      setData(prev => {
        if (!prev) return null
        return {
          ...prev,
          active_claim_id: claimId,
          active_claim_type: effectiveType,
          active_target_minutes: effectiveMinutes,
          active_target_seconds: effectiveSeconds,
          active_elapsed_seconds: 0,
          app_distribution: []
        }
      })
      setLiveElapsedSec(0)
      if (patientName) setActivePatientName(patientName)
      setTrackingBannerVisible(true)

      const activeRes = await api.setActiveClaim(associateId, claimId, actionType, targetMinutes)
      if (activeRes) {
        setData(prev => {
          if (!prev) return null
          return {
            ...prev,
            active_claim_id: claimId,
            active_claim_type: (activeRes as any)?.action_type || effectiveType,
            active_target_minutes: (activeRes as any)?.target_minutes || effectiveMinutes,
            active_target_seconds: (activeRes as any)?.target_seconds || effectiveSeconds,
            active_elapsed_seconds: 0
          }
        })
      }
      await loadData()
    } catch (err) {
      console.error('Failed to set active claim:', err)
    }
  }

  // Handle starting a claim from PendingClaimsModal
  const handleStartClaim = async (claimId: string, claimType?: string, targetMinutes?: number) => {
    setIsPendingModalOpen(false)
    setPendingClaims(prev => prev.filter(c => c.claim_id.toUpperCase() !== claimId.toUpperCase()))
    await handleConfirmClaim(claimId, undefined, claimType, targetMinutes)
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

  // Filtered, deduplicated, and stably sorted claims (supports 40-50+ simultaneous users)
  const processedClaims = useMemo(() => {
    if (!data?.recent_claims) return []

    // 0. Deduplicate by unique (claim_id + associate_id) so teammate claims never collide
    const dedupedMap = new Map<string, typeof data.recent_claims[0]>()
    for (const c of data.recent_claims) {
      if (!c.claim_id) continue
      const isMyActive = Boolean(
        data.active_claim_id && data.active_claim_id !== 'UNASSIGNED' &&
        c.claim_id === data.active_claim_id && c.associate_id === associateId
      )
      const key = `${c.claim_id}__${c.associate_id || 'UNKNOWN'}`
      const existing = dedupedMap.get(key)
      const itemStatus = isMyActive || c.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : (c.status || 'COMPLETED')
      if (!existing) {
        dedupedMap.set(key, { ...c, status: itemStatus })
      } else {
        const existingIsActive = existing.status === 'IN_PROGRESS'
        const incomingIsActive = itemStatus === 'IN_PROGRESS'
        if (incomingIsActive && !existingIsActive) {
          dedupedMap.set(key, { ...c, status: 'IN_PROGRESS' })
        } else if (existingIsActive && !incomingIsActive) {
          // Keep active live touch isolated from historical completed touch
        } else {
          const tC = c.start_time ? new Date(c.start_time).getTime() : 0
          const tEx = existing.start_time ? new Date(existing.start_time).getTime() : 0
          const chosen = (c.total_duration_seconds > 0 && (tC >= tEx || existing.total_duration_seconds === 0)) ? c : existing
          dedupedMap.set(key, {
            ...chosen,
            status: incomingIsActive || existingIsActive ? 'IN_PROGRESS' : (chosen.status || 'COMPLETED')
          })
        }
      }
    }

    let list = Array.from(dedupedMap.values())

    // 1. Search Query (matches claim ID or associate ID)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(c => c.claim_id.toLowerCase().includes(q) || (c.associate_id || '').toLowerCase().includes(q))
    }

    // 2. NVA Category Filter
    if (filterType === 'FLAGGED') {
      list = list.filter(c => c.nva_flags.length > 0)
    } else if (filterType === 'CLEAN') {
      list = list.filter(c => c.nva_flags.length === 0)
    } else if (filterType !== 'ALL') {
      list = list.filter(c => c.nva_flags.includes(filterType))
    }

    // 3. Stable Sorting: ALL IN_PROGRESS claims stay pinned at the top (never jumbling), followed by chosen sort
    list.sort((a, b) => {
      const aActive = a.status === 'IN_PROGRESS' ? 0 : 1
      const bActive = b.status === 'IN_PROGRESS' ? 0 : 1
      if (aActive !== bActive) return aActive - bActive

      if (sortBy === 'LONGEST') return b.total_duration_seconds - a.total_duration_seconds
      if (sortBy === 'SHORTEST') return a.total_duration_seconds - b.total_duration_seconds
      if (sortBy === 'SWITCHES') return b.app_switches_count - a.app_switches_count
      const tA = a.start_time ? new Date(a.start_time).getTime() : 0
      const tB = b.start_time ? new Date(b.start_time).getTime() : 0
      return tB - tA
    })

    return list
  }, [data?.recent_claims, data?.active_claim_id, associateId, searchQuery, filterType, sortBy])

  // DOM Optimization: Table Pagination / Windowing (reduces DOM complexity from >900 nodes to <350)
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 10

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterType, sortBy])

  const totalPages = Math.max(1, Math.ceil(processedClaims.length / PAGE_SIZE))
  const paginatedClaims = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return processedClaims.slice(start, start + PAGE_SIZE)
  }, [processedClaims, currentPage])

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
            aria-label={isPolling ? 'Pause Polling' : 'Resume Polling'}
          >
            {isPolling ? <Pause size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
          </button>

          <button
            onClick={() => refreshNow()}
            className="btn-ghost"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            title="Refresh now"
            aria-label="Refresh now"
          >
            <RefreshCw size={12} aria-hidden="true" />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

          {/* Pending Claims Modal Trigger with Badge */}
          <button
            onClick={() => setIsPendingModalOpen(true)}
            aria-label={`Open pending claims list, ${pendingClaims.length} pending`}
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
            <FileCheck2 size={15} aria-hidden="true" />
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
            aria-label="Export Time and Motion CSV"
          >
            <Download size={14} aria-hidden="true" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Desktop Agent Associate Profile Mismatch Banner */}
      {mismatchLiveAssociate && (!data.active_claim_id || data.active_claim_id === 'UNASSIGNED') && (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderLeft: '4px solid #d97706',
          padding: '10px 16px',
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#92400e', fontSize: '0.8125rem' }}>
            <AlertCircle size={18} color="#d97706" aria-hidden="true" />
            <span>
              You are viewing <strong>{associateId}</strong> (currently UNASSIGNED), while live desktop agent activity is running on{' '}
              <strong>{mismatchLiveAssociate.associate_id}</strong>
              {mismatchLiveAssociate.claim_id ? ` (Tracking ${mismatchLiveAssociate.claim_id})` : ''}.
            </span>
          </div>
          {onSwitchAssociate && (
            <button
              type="button"
              onClick={() => onSwitchAssociate(mismatchLiveAssociate.associate_id)}
              style={{
                background: '#d97706',
                color: '#ffffff',
                border: 'none',
                padding: '6px 14px',
                fontWeight: 800,
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>Switch to {mismatchLiveAssociate.associate_id}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Step 4 Tracking Confirmation Banner (Idea_pic.jpeg Step 4) */}
      {data.active_claim_id && data.active_claim_id !== 'UNASSIGNED' && trackingBannerVisible && (
        <div className="tracking-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={18} color="#10b981" strokeWidth={2.5} aria-hidden="true" />
            <span>
              <strong>Tracking Claim: {data.active_claim_id}</strong>
              {activePatientName ? ` (${activePatientName})` : ''} - Desktop agent is automatically recording active time, idle periods, and app switches for this claim.
            </span>
          </div>
          <button
            onClick={() => setTrackingBannerVisible(false)}
            aria-label="Dismiss tracking confirmation banner"
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
        const activeClaimRecord = data.recent_claims?.find(c => c.claim_id === activeClaimId && c.associate_id === associateId) || data.recent_claims?.find(c => c.claim_id === activeClaimId)
        const activeAppSwitches = data.active_app_switches ?? activeClaimRecord?.app_switches_count ?? 0
        const activeType = data.active_claim_type || 'CR - Call / IVR'
        const activeTargetMins = data.active_target_minutes || 14
        const activeTargetSecs = data.active_target_seconds || (activeTargetMins * 60)
        const activeRemainingSecs = activeTargetSecs - liveElapsedSec
        const isOvertime = activeRemainingSecs <= 0
        const isRunningOut = activeRemainingSecs <= 120

        return (
          <div
            className="command-card"
            style={{ cursor: 'pointer', padding: '10px 16px', marginBottom: 12 }}
            onClick={() => setIsAssistantOpen(true)}
            title="Click to open Claim Work Assistant"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              <div style={{
                width: 38,
                height: 38,
                background: isClaimActive ? '#059669' : '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${isClaimActive ? '#059669' : '#0f172a'}`,
                flexShrink: 0
              }}>
                <Zap size={20} color="#ffffff" strokeWidth={2.5} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{
                    fontSize: '0.625rem',
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
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
                    {/* Claim ID */}
                    <div
                      onClick={() => onSelectClaim(activeClaimId)}
                      title={`Inspect Claim Deep Dive for ${activeClaimId}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '2px 8px',
                        background: '#f1f5f9', border: '1px solid #cbd5e1',
                        fontSize: '0.75rem', fontWeight: 700, color: '#1e293b',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Claim ID:</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '0.8125rem', color: '#0f172a' }}>{activeClaimId}</span>
                      <ExternalLink size={11} color="#059669" />
                    </div>

                    <span style={{ color: '#cbd5e1', fontSize: '1rem', fontWeight: 300 }}>|</span>

                    {/* Claim Type */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '2px 8px',
                      background: '#f1f5f9', border: '1px solid #cbd5e1',
                      fontSize: '0.75rem', fontWeight: 700, color: '#1e293b'
                    }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Claim Type:</span>
                      <span>{activeType}</span>
                    </div>

                    <span style={{ color: '#cbd5e1', fontSize: '1rem', fontWeight: 300 }}>|</span>

                    {/* Target time */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '2px 8px',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.75rem', fontWeight: 700,
                      color: '#334155'
                    }}>
                      <Clock size={12} color="#64748b" />
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Target:</span>
                      <span className="mono" style={{ fontWeight: 900, fontSize: '0.8125rem', color: '#0f172a' }}>
                        {activeTargetSecs > 0 ? formatMmSs(activeTargetSecs) : '—'}
                      </span>
                    </div>

                    {activeTargetSecs > 0 && (
                      <>
                        <span style={{ color: '#cbd5e1', fontSize: '1rem', fontWeight: 300 }}>|</span>
                        {/* Countdown / Overtime Chip */}
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '2px 8px',
                          background: isOvertime ? '#fef2f2' : '#ecfdf5',
                          border: `1.5px solid ${isOvertime ? '#ef4444' : '#10b981'}`,
                          fontSize: '0.75rem', fontWeight: 700,
                          color: isOvertime ? '#b91c1c' : '#047857',
                          transition: 'all 0.3s ease'
                        }}>
                          <span style={{ color: isOvertime ? '#b91c1c' : '#047857', fontWeight: 700 }}>
                            {isOvertime ? 'Overtime:' : 'Remaining:'}
                          </span>
                          <span
                            className="mono"
                            style={{
                              fontWeight: 900,
                              fontSize: '0.8125rem',
                              color: isOvertime ? '#dc2626' : '#047857'
                            }}
                          >
                            {isOvertime
                              ? `${formatMmSs(liveElapsedSec - activeTargetSecs)} over`
                              : `${formatMmSs(activeRemainingSecs)} left`}
                          </span>
                        </div>
                      </>
                    )}

                    <span style={{ color: '#cbd5e1', fontSize: '1rem', fontWeight: 300 }}>|</span>

                    {/* Time taken (elapsed) */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '2px 8px',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.75rem', fontWeight: 700, color: '#0f172a'
                    }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Time taken:</span>
                      <span className="mono" style={{ fontWeight: 900, fontSize: '0.8125rem' }}>{formatMmSs(liveElapsedSec)}</span>
                    </div>

                    <span style={{ color: '#cbd5e1', fontSize: '1rem', fontWeight: 300 }}>|</span>

                    {/* System Buffer Time (>10s app launch, excluded from AHT) */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '2px 8px',
                      background: '#f0fdfa',
                      border: '1px solid #99f6e4',
                      fontSize: '0.75rem', fontWeight: 700, color: '#0f766e'
                    }} title="System buffer time: application launch/load delays exceeding 10 seconds (strictly excluded from AHT)">
                      <span style={{ color: '#0d9488', fontWeight: 600 }}>System Buffer:</span>
                      <span className="mono" style={{ fontWeight: 900, fontSize: '0.8125rem', color: '#0f766e' }}>
                        {formatDuration(data.system_buffer_seconds || 0)}
                      </span>
                    </div>

                    <span style={{ color: '#cbd5e1', fontSize: '1rem', fontWeight: 300 }}>|</span>

                    {/* Live App Switches Count */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '2px 8px',
                      background: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      fontSize: '0.75rem', fontWeight: 700, color: '#0369a1'
                    }} title="Total application switches recorded during this active claim">
                      <Layers size={12} color="#0284c7" aria-hidden="true" />
                      <span style={{ color: '#0369a1', fontWeight: 600 }}>App Switches:</span>
                      <span className="mono" style={{ fontWeight: 900, fontSize: '0.8125rem', color: '#0284c7' }}>
                        {activeAppSwitches}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{
                      fontSize: '1.125rem',
                      fontWeight: 800,
                      color: '#64748b',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '-0.01em'
                    }}>
                      UNASSIGNED
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      No active claim context detected. Launch a claim from NovaArc RCM or click Activate Claim to begin.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
              {isClaimActive && (
                <button
                  type="button"
                  aria-label="Unassign current active claim"
                  onClick={async () => {
                    try {
                      await api.setActiveClaim(associateId, 'UNASSIGNED')
                      setData(prev => prev ? { ...prev, active_claim_id: 'UNASSIGNED', active_elapsed_seconds: 0 } : null)
                      setLiveElapsedSec(0)
                      await loadData()
                    } catch (err) {
                      console.error('Failed to unassign claim:', err)
                    }
                  }}
                  style={{
                    background: '#fff1f2',
                    color: '#e11d48',
                    border: '1px solid #fecdd3',
                    padding: '5px 12px',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                  title="Unassign current active claim"
                >
                  <span>Unassign</span>
                </button>
              )}
              <button
                type="button"
                aria-label={isClaimActive ? 'Switch active claim' : 'Activate claim context'}
                onClick={() => setIsAssistantOpen(true)}
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  border: '1px solid #0f172a',
                  padding: '5px 14px',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                <Zap size={13} aria-hidden="true" />
                <span>{isClaimActive ? 'Switch Claim' : 'Activate Claim'}</span>
              </button>
            </div>
          </div>
        )
      })()}

      {/* Modals loaded lazily on demand */}
      <React.Suspense fallback={null}>
        {isAssistantOpen && (
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
        )}

        {isPendingModalOpen && (
          <PendingClaimsModal
            isOpen={isPendingModalOpen}
            onClose={() => setIsPendingModalOpen(false)}
            pendingClaims={pendingClaims}
            onStartClaim={handleStartClaim}
            activeClaimId={data.active_claim_id}
          />
        )}
      </React.Suspense>

      {/* 4 Top KPI Cards (NovaChron Aligned) */}
      <div className="kpi-grid">
        <KpiCard
          title="Claims Processed"
          value={`${data.completed_claims_count} / ${data.target_claims}`}
          subtitle={`Target: ${data.target_claims} | Attain: ${data.completed_claims_count > 0 ? (data.output_attainment ?? 100) : 0}%${data.expected_output ? ` (Pace: ${data.expected_output} exp)` : ''}`}
          icon={<CheckCircle2 size={16} />}
          accentColor="#10b981"
          badge={data.completed_claims_count > 0 ? (data.output_attainment && data.output_attainment >= 95 ? "ON TARGET" : "IN PROGRESS") : undefined}
        />
        {(() => {
          const ahtInfo = formatAhtDisplay(data.aht_minutes, 9.0, data.completed_claims_count)
          return (
            <KpiCard
              title="Average Handling Time (AHT)"
              value={ahtInfo.display}
              subtitle={
                ahtInfo.warning
                  ? ahtInfo.warning
                  : data.completed_claims_count > 0
                    ? `Benchmark: 9.0m | Attain: ${data.aht_attainment ?? 100}%`
                    : 'Benchmark: 9.0m | No claims completed'
              }
              icon={<Clock size={16} aria-hidden="true" />}
              accentColor="#0f172a"
              badge={ahtInfo.isOutlier ? "OUTLIER" : undefined}
            />
          )
        })()}
        <KpiCard
          title="Occupancy & Utilisation"
          value={(data.completed_claims_count > 0 || (data.total_work_seconds || 0) > 0) ? `${data.occupancy_percentage ?? 0}%` : '0%'}
          subtitle={`Util: ${(data.completed_claims_count > 0 || (data.total_work_seconds || 0) > 0) ? (data.utilisation_percentage ?? 0) : 0}% | Idle: ${data.idle_percentage}% | Buffer: ${data.buffer_percentage ?? 0}%`}
          icon={<AlertCircle size={16} />}
          accentColor="#d97706"
        />
        <KpiCard
          title="Performance Index (C01)"
          value={(data.completed_claims_count > 0 || (data.total_work_seconds || 0) > 0) ? `${data.c01_performance_index ?? data.efficiency_score}%` : '—'}
          subtitle={(data.completed_claims_count > 0 || (data.total_work_seconds || 0) > 0) ? `${data.performance_band || 'On target'} | ${data.points_today ?? 0} pts (L${data.level_number || 1} ${data.level_name || 'Associate'})` : 'Ready / No data yet'}
          icon={<TrendingUp size={16} />}
          accentColor="#7c3aed"
          badge={(data.completed_claims_count > 0 || (data.total_work_seconds || 0) > 0) ? (data.status_label || "OPTIMAL") : "READY"}
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
            <span style={{ fontWeight: 800, color: '#0f172a' }}>{data.completed_claims_count > 0 ? (data.output_attainment ?? 0) : 0}%</span>
          </div>

          <span style={{ color: '#cbd5e1' }}>|</span>

          {/* Factor 2: AHT Attainment (20%) */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>
            <span style={{ color: '#64748b' }}>AHT (20%):</span>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>{data.completed_claims_count > 0 ? (data.aht_attainment ?? 0) : 0}%</span>
          </div>

          <span style={{ color: '#cbd5e1' }}>|</span>

          {/* Factor 3: Utilisation (20%) */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>
            <span style={{ color: '#64748b' }}>Util (20%):</span>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>{(data.completed_claims_count > 0 || (data.total_work_seconds || 0) > 0) ? (data.utilisation_percentage ?? 0) : 0}%</span>
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
            <span>Level {data.level_number || 1}: {data.level_name || 'Associate'} ({data.lifetime_points || 0} pts{data.points_to_next_level ? ` | ${data.points_to_next_level} to L${(data.level_number || 1) + 1}` : ''})</span>
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
            <span>+{data.points_today ?? 0} pts today</span>
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
              <p className="text-sub">{data.recent_claims.length} claims · {data.completed_claims_count} completed in this shift</p>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
              Showing {processedClaims.length} of {data.recent_claims.length} claims
            </span>
          </div>

          {/* Search, Filter Pills & Sort Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={14} color="var(--text-muted)" aria-hidden="true" style={{ position: 'absolute', left: 10, top: 10 }} />
                <input
                  id="associate-claims-search"
                  name="claimsSearch"
                  type="text"
                  placeholder="Search claim ID..."
                  aria-label="Search claim ID or associate"
                  spellCheck={false}
                  data-gramm="false"
                  data-quillbot-element="false"
                  autoComplete="off"
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
                id="associate-claims-sort"
                name="claimsSort"
                aria-label="Sort claim activity list"
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
                  aria-label={`Filter claims by ${type.toLowerCase().replace('_', ' ')}`}
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

          <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
            <table className="tms-table">
            <thead>
              <tr>
                <th style={{ minWidth: 110 }}>Claim ID</th>
                <th style={{ minWidth: 120 }}>Associate</th>
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
              {paginatedClaims.map((c, i) => {
                const isItemActive = c.status === 'IN_PROGRESS'
                let displayDuration = c.total_duration_seconds
                if (isItemActive) {
                  if (c.claim_id === data.active_claim_id && c.associate_id === associateId) {
                    displayDuration = liveElapsedSec
                  } else {
                    displayDuration = c.total_duration_seconds
                  }
                }
                const cTargetSec = c.target_seconds || (c.target_minutes ? c.target_minutes * 60 : 840)
                const cTargetMins = c.target_minutes || Math.round(cTargetSec / 60)
                const variance = cTargetSec - displayDuration

                return (
                  <tr
                    key={c.claim_id ? `${c.claim_id}-${c.associate_id || ''}-${c.status || ''}` : `claim-${i}`}
                    onClick={() => onSelectClaim(c.claim_id, c.associate_id)}
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
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 7px',
                        background: c.associate_id === associateId ? '#e0f2fe' : '#f1f5f9',
                        color: c.associate_id === associateId ? '#0369a1' : '#475569',
                        border: `1px solid ${c.associate_id === associateId ? '#bae6fd' : '#cbd5e1'}`,
                        borderRadius: 3,
                        fontSize: '0.6875rem',
                        fontWeight: 700
                      }}>
                        {c.associate_id || associateId}
                      </span>
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
                          color: variance <= 0 ? '#dc2626' : variance <= 120 ? '#b45309' : '#15803d',
                          background: variance <= 0 ? '#fee2e2' : variance <= 120 ? '#fef3c7' : '#dcfce7',
                          padding: '3px 8px',
                          border: `1px solid ${variance <= 0 ? '#fca5a5' : variance <= 120 ? '#fcd34d' : '#86efac'}`,
                          borderRadius: 2,
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          Target ({cTargetMins}m): {variance > 0 ? `${formatMmSs(variance)} left` : `${formatDuration(Math.abs(variance))} over`}
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
                              ({formatDuration(Math.abs(variance))} over)
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>{isItemActive ? (data?.active_app_switches ?? c.app_switches_count) : c.app_switches_count}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {c.nva_flags.length > 0 ? (
                          c.nva_flags.map((f, fi) => <NvaBadge key={`${c.claim_id}-${f}-${fi}`} flag={f} />)
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
                        {isItemActive ? 'IN PROGRESS' : (c.status || 'COMPLETED')}
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
                        aria-label={`Deep Dive into claim ${c.claim_id}`}
                      >
                        <ExternalLink size={12} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {processedClaims.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)' }}>
                    {(data.recent_claims?.length || 0) === 0 ? 'No claims worked yet in this shift. Launch NovaArc RCM and start working a claim to track time & motion.' : 'No claims match your current filter or search criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          {/* DOM Optimization: Clean Pagination Controls */}
          {processedClaims.length > PAGE_SIZE && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              fontSize: '0.75rem',
              color: '#475569',
              flexWrap: 'wrap',
              gap: 8
            }}>
              <div>
                Showing <strong>{((currentPage - 1) * PAGE_SIZE) + 1}</strong> - <strong>{Math.min(currentPage * PAGE_SIZE, processedClaims.length)}</strong> of <strong>{processedClaims.length}</strong> claims
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous claims page"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 3,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.5 : 1
                  }}
                >
                  Previous
                </button>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Next claims page"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 3,
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.5 : 1
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

          {/* Right Column: Application Time Distribution (Analytical Donut View) */}
          <div className="glass-card" style={{ padding: '16px 20px' }}>
            <div style={{ marginBottom: 12 }}>
              <h2 className="title-md" style={{ fontSize: '1.05rem', margin: 0 }}>Application Time Share</h2>
              <p className="text-sub" style={{ fontSize: '0.75rem', marginTop: 2 }}>
                {data.active_claim_id && data.active_claim_id !== 'UNASSIGNED'
                  ? `Where time was spent on active claim (${data.active_claim_id})`
                  : `Where time was spent across today's shift`}
              </p>
            </div>

            {(() => {
              let donutItems = data.app_distribution || []
              if (donutItems.length === 0 && data.active_claim_id && data.active_claim_id !== 'UNASSIGNED') {
                const activeRecord = data.recent_claims?.find(c => c.claim_id === data.active_claim_id)
                if (activeRecord && activeRecord.app_breakdown && typeof activeRecord.app_breakdown === 'object') {
                  const total = Object.values(activeRecord.app_breakdown).reduce((a, b) => a + Number(b || 0), 0)
                  donutItems = Object.entries(activeRecord.app_breakdown).map(([appName, sec]) => ({
                    app_name: appName,
                    duration_seconds: Number(sec) || 0,
                    percentage: total > 0 ? Math.round((Number(sec) / total) * 1000) / 10 : 0
                  }))
                }
              }

              return (
                <ApplicationTimeDonut
                  items={donutItems}
                  activeClaimId={data.active_claim_id && data.active_claim_id !== 'UNASSIGNED' ? data.active_claim_id : undefined}
                  width={200}
                  height={200}
                />
              )
            })()}
          </div>

      </div>
    </div>
  )
}