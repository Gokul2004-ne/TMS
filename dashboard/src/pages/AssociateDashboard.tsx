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
  Play
} from 'lucide-react'
import { AssociateTodayData } from '../api/types'
import { api } from '../api/client'
import { KpiCard } from '../components/KpiCard'
import { ApplicationTimeDonut } from '../components/ApplicationTimeDonut'
import { NvaBadge } from '../components/NvaBadge'
import { ClaimWorkAssistantModal } from '../components/ClaimWorkAssistantModal'
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
  
  // Claim Work Assistant state (Idea_pic.jpeg)
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
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

  // Handle manual claim confirmation (Idea_pic.jpeg Step 3 & 4)
  const handleConfirmClaim = async (claimId: string, patientName?: string) => {
    try {
      await api.setActiveClaim(associateId, claimId, patientName)
      setData(prev => prev ? { ...prev, active_claim_id: claimId } : null)
      if (patientName) setActivePatientName(patientName)
      setTrackingBannerVisible(true)
    } catch (err) {
      console.error('Failed to set active claim:', err)
    }
  }

  // Filtered and sorted claims
  const processedClaims = useMemo(() => {
    if (!data?.recent_claims) return []

    let list = [...data.recent_claims]

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
            <span>Export Claims CSV (T&M Format)</span>
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
            title="Dismiss banner"
          >
            ✕
          </button>
        </div>
      )}

      {/* Active Claim Context Command Center (Reference Idea_pic.jpeg Step 3 & 4) */}
      <div
        className="command-card"
        style={{ cursor: 'pointer' }}
        onClick={() => setIsAssistantOpen(true)}
        title="Click to open Claim Work Assistant"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 46,
            height: 46,
            background: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #0f172a'
          }}>
            <Zap size={22} color="#ffffff" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
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
                background: data.active_claim_id && data.active_claim_id !== 'UNASSIGNED' ? '#059669' : '#0f172a',
                color: '#ffffff'
              }}>
                {data.active_claim_id && data.active_claim_id !== 'UNASSIGNED' ? 'ACTIVE' : 'IDLE'}
              </span>
            </div>
            <div style={{
              fontSize: '1.625rem',
              fontWeight: 900,
              color: '#0f172a',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '-0.02em'
            }}>
              {data.active_claim_id || 'IDLE / UNASSIGNED'}
              {activePatientName && data.active_claim_id && data.active_claim_id !== 'UNASSIGNED' && (
                <span style={{ fontSize: '1rem', fontWeight: 600, color: '#475569', marginLeft: 10, fontFamily: 'var(--font-sans)' }}>
                  — {activePatientName}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#334155' }}>
              All desktop interactions across ClaimPlatform, Chrome & Excel are actively attributed to this claim.
            </div>
          </div>
        </div>

        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
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
            <span>{data.active_claim_id && data.active_claim_id !== 'UNASSIGNED' ? 'Switch Claim' : 'Activate Claim'}</span>
          </button>

          {data.active_claim_id && data.active_claim_id !== 'UNASSIGNED' && (
            <button
              className="btn-ghost"
              style={{ background: '#ffffff', color: '#0f172a', border: '1px solid #0f172a', padding: '8px 16px' }}
              onClick={() => onSelectClaim(data.active_claim_id!)}
            >
              <span>Inspect Live Timeline</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Claim Work Assistant Modal (Idea_pic.jpeg Step 3) */}
      <ClaimWorkAssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        currentActiveClaim={data.active_claim_id}
        onConfirmClaim={handleConfirmClaim}
        runningClaims={(data.recent_claims || []).map(c => ({
          claim_id: c.claim_id,
          patient_name: '',
          status: c.status
        }))}
      />

      {/* KPI Cards Row */}
      <div className="kpi-grid">
        <KpiCard
          title="Claims Processed"
          value={`${data.completed_claims_count} / ${data.target_claims}`}
          subtitle={data.target_claims > 0 ? `Target Progress: ${Math.round((data.completed_claims_count / data.target_claims) * 100)}%` : 'Shift Target: In Progress'}
          icon={<CheckCircle2 size={16} />}
          accentColor="#10b981"
          badge={data.completed_claims_count > 0 ? "ON TRACK" : undefined}
        />
        <KpiCard
          title="Average Handling Time"
          value={`${data.aht_minutes}m`}
          subtitle="Target Benchmark: 8.0m"
          icon={<Clock size={16} />}
          accentColor="#0f172a"
        />
        <KpiCard
          title="Idle Time Ratio"
          value={`${data.idle_percentage}%`}
          subtitle={`${Math.round(data.total_idle_seconds / 60)} mins idle`}
          icon={<AlertCircle size={16} />}
          accentColor="#d97706"
        />
        <KpiCard
          title="Efficiency Score"
          value={`${data.efficiency_score}%`}
          subtitle="Quality & Effort composite"
          icon={<TrendingUp size={16} />}
          accentColor="#7c3aed"
          badge="OPTIMAL"
        />
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
                <th>Claim ID</th>
                <th>Handling Time</th>
                <th>App Switches</th>
                <th>NVA Flags</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {processedClaims.map((c, i) => (
                <tr key={i} onClick={() => onSelectClaim(c.claim_id)} style={{ cursor: 'pointer' }}>
                  <td>
                    <span className="mono" style={{ fontWeight: 800, color: '#0f172a' }}>
                      {c.claim_id}
                    </span>
                  </td>
                  <td>{formatDuration(c.total_duration_seconds)}</td>
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
                      fontWeight: 700,
                      padding: '2px 6px',
                      background: c.status === 'COMPLETED' ? '#f0fdf4' : '#fffbeb',
                      color: c.status === 'COMPLETED' ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                      border: `1px solid ${c.status === 'COMPLETED' ? '#bbf7d0' : '#fde68a'}`
                    }}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: '0.75rem' }}>
                      <ExternalLink size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {processedClaims.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)' }}>
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
            <p className="text-sub">Where time was spent across today's shift</p>
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
