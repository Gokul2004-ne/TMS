import React, { useState, useEffect, useMemo } from 'react'
import {
  Award,
  Users,
  Clock,
  AlertTriangle,
  Download,
  Briefcase,
  Sparkles,
  Hourglass,
  RefreshCw,
  Pause,
  Play,
  TrendingUp
} from 'lucide-react'
import { TeamOverviewData, NVASummaryData, InsightsResponse, AssociateOverviewItem } from '../api/types'
import { api } from '../api/client'
import { KpiCard } from '../components/KpiCard'
import { LiveTeamMetricsChart } from '../components/LiveTeamMetricsChart'
import { useLivePolling } from '../hooks/useLivePolling'

interface LeaderDashboardProps {
  onSelectManager?: (managerId: string) => void
}

interface PodRollup {
  teamName: string
  supervisorId: string
  supervisorName: string
  activeAssociates: number
  totalAssociates: number
  claimsCompleted: number
  targetClaims: number
  ahtMinutes: number
  efficiencyScore: number
  idlePercentage: number
  systemBufferSeconds: number
  nvaLossHours: number
  status: 'EXCEEDING_TARGET' | 'ON_TRACK' | 'ATTENTION'
  topPerformer: string
}

export const LeaderDashboard: React.FC<LeaderDashboardProps> = ({ onSelectManager }) => {
  const [timeframe, setTimeframe] = useState<'TODAY' | 'WTD' | 'MTD'>('TODAY')
  const [team, setTeam] = useState<TeamOverviewData | null>(null)
  const [nva, setNva] = useState<NVASummaryData | null>(null)
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [teamRes, nvaRes, insRes] = await Promise.all([
        api.getEnrichedTeamOverview(),
        api.getTeamNvaSummary(),
        api.getAiInsights()
      ])
      setTeam(teamRes)
      setNva(nvaRes)
      setInsights(insRes)
    } catch (err) {
      console.error('[LeaderDashboard] loadData error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Asynchronous 1-second minimum live telemetry refresh
  const { countdown, isPolling, togglePolling, refreshNow } = useLivePolling(loadData, {
    intervalSec: 1,
    enabled: true
  })

  useEffect(() => {
    loadData()
  }, [])

  const periodMultiplier = timeframe === 'TODAY' ? 1 : timeframe === 'WTD' ? 5 : 22

  const orgKpis = useMemo(() => {
    const baseClaims = team?.total_claims_completed ?? 0
    const baseExpected = team?.team_expected_output ?? Math.max(baseClaims, 40)
    const totalBufSec =
      team?.team_system_buffer_seconds ??
      (team?.associates || []).reduce((acc, a) => acc + (a.system_buffer_seconds || 0), 0)

    return {
      totalClaims: Math.round(baseClaims * periodMultiplier),
      claimsTarget: Math.round(baseExpected * periodMultiplier),
      avgHandleTime: team?.team_aht_minutes ?? 0,
      orgEfficiency: team?.team_efficiency_score ?? 0,
      orgOccupancy: team?.team_occupancy_percentage ?? 0,
      orgUtilisation: team?.team_utilisation_percentage ?? 0,
      orgIdle: team?.team_idle_percentage ?? 0,
      activeAssociates: team?.active_associates_count ?? 0,
      totalAssociates: team?.total_associates ?? 0,
      systemBufferSeconds: Math.round(totalBufSec * periodMultiplier),
      totalNvaLossHours: +((nva?.total_nva_time_lost_hours ?? 0) * periodMultiplier).toFixed(1),
      capacityGapMinutes: Math.round((team?.team_capacity_gap_minutes ?? 0) * periodMultiplier)
    }
  }, [team, nva, periodMultiplier])

  const teamComparison = useMemo<PodRollup[]>(() => {
    const associates = team?.associates || []
    const buildPod = (
      teamName: string,
      supervisorId: string,
      supervisorName: string,
      members: AssociateOverviewItem[]
    ): PodRollup => {
      const claimsSum = members.reduce((s, a) => s + (a.completed_claims || 0), 0)
      const expSum = members.reduce((s, a) => s + (a.expected_output || 0), 0)
      const activeCount = members.filter(a => a.status === 'ACTIVE').length
      const withWork = members.filter(a => (a.completed_claims || 0) > 0 || (a.aht_minutes || 0) > 0)
      const weightedAhtDenom = withWork.reduce((s, a) => s + Math.max(1, a.completed_claims || 1), 0)
      const avgAht =
        weightedAhtDenom > 0
          ? +(
              withWork.reduce((s, a) => s + (a.aht_minutes || 0) * Math.max(1, a.completed_claims || 1), 0) /
              weightedAhtDenom
            ).toFixed(2)
          : 0
      const avgEff =
        members.length > 0
          ? +(members.reduce((s, a) => s + (a.efficiency_score || 0), 0) / members.length).toFixed(1)
          : 0
      const avgIdle =
        members.length > 0
          ? +(members.reduce((s, a) => s + (a.idle_percentage || 0), 0) / members.length).toFixed(1)
          : 0
      const bufSec = members.reduce((s, a) => s + (a.system_buffer_seconds || 0), 0)
      const flagsSum = members.reduce((s, a) => s + (a.flags_count || 0), 0)
      const top = [...members].sort((a, b) => (b.completed_claims || 0) - (a.completed_claims || 0))[0]
      const target = Math.max(1, Math.round(expSum * periodMultiplier) || members.length * 15 * periodMultiplier)
      const scaledClaims = Math.round(claimsSum * periodMultiplier)

      return {
        teamName,
        supervisorId,
        supervisorName,
        activeAssociates: activeCount,
        totalAssociates: members.length,
        claimsCompleted: scaledClaims,
        targetClaims: target,
        ahtMinutes: avgAht,
        efficiencyScore: avgEff,
        idlePercentage: avgIdle,
        systemBufferSeconds: Math.round(bufSec * periodMultiplier),
        nvaLossHours: +(Math.max(0, flagsSum * 0.015) * periodMultiplier).toFixed(1),
        status: avgEff >= 85 ? 'EXCEEDING_TARGET' : avgEff >= 65 ? 'ON_TRACK' : 'ATTENTION',
        topPerformer: top ? `${top.name} (${top.associate_id})` : '—'
      }
    }

    const podAlpha = associates.filter(a => ['EMP101', 'EMP102'].includes(a.associate_id))
    const podBeta = associates.filter(a => ['EMP103', 'EMP104'].includes(a.associate_id))
    const podWorkstations = associates.filter(a => !['EMP101', 'EMP102', 'EMP103', 'EMP104'].includes(a.associate_id))

    const rows: PodRollup[] = []
    if (podAlpha.length > 0) rows.push(buildPod('Operations Pod Alpha (Core RCM)', 'MGR101', 'Sarah Jenkins', podAlpha))
    if (podBeta.length > 0) rows.push(buildPod('Operations Pod Beta (Denials & Appeals)', 'MGR102', 'Robert Vance', podBeta))
    if (podWorkstations.length > 0) {
      rows.push(buildPod('Live Workstation Agents (Auto-Tracked)', 'MGR-LIVE', 'Operations Floor', podWorkstations))
    }
    return rows
  }, [team?.associates, periodMultiplier])

  const nvaBreakdown = useMemo(() => {
    const cats = nva?.breakdown_by_category || {
      EXCEL_OVERUSE: nva?.excel_overuse_claims_count ?? 0,
      APP_SWITCHING: nva?.app_switching_spikes_count ?? 0,
      LONG_IDLE: nva?.long_idle_incidents_count ?? 0,
      OUTLIER: nva?.outlier_claims_count ?? 0,
      REWORK: nva?.rework_claims_count ?? 0
    }
    const items = [
      {
        label: 'Post-Adjudication Rework Touches',
        count: cats.REWORK ?? 0,
        color: '#7c3aed',
        desc: 'Multi-touch claims re-opened or escalated within session'
      },
      {
        label: 'Payer Portal App Switching Spikes',
        count: cats.APP_SWITCHING ?? 0,
        color: '#2563eb',
        desc: 'Claims with >= 8 rapid browser/tool toggles'
      },
      {
        label: 'Long User Idle Incidents',
        count: cats.LONG_IDLE ?? 0,
        color: '#d97706',
        desc: 'Claims with >= 3 minutes of inactivity (excl. System Buffer)'
      },
      {
        label: 'Handling Time Outliers (>20m)',
        count: cats.OUTLIER ?? 0,
        color: '#dc2626',
        desc: 'Complex denials exceeding upper SLA threshold'
      },
      {
        label: 'Excel Crosswalk Overuse',
        count: cats.EXCEL_OVERUSE ?? 0,
        color: '#16a34a',
        desc: 'Claims spending >40% active duration inside Excel spreadsheets'
      }
    ]
    const total = items.reduce((s, i) => s + i.count, 0) || 1
    return items.map(i => ({ ...i, pct: Math.round((i.count / total) * 100) }))
  }, [nva])

  const handleExportBriefing = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Metric,Value\n' +
      `Timeframe,${timeframe}\n` +
      `Total Claims Completed,${orgKpis.totalClaims}\n` +
      `Expected Output,${orgKpis.claimsTarget}\n` +
      `Org Average Handle Time (min),${orgKpis.avgHandleTime}\n` +
      `Org Productive Efficiency (%),${orgKpis.orgEfficiency}\n` +
      `Org Occupancy (%),${orgKpis.orgOccupancy}\n` +
      `Org Utilisation (%),${orgKpis.orgUtilisation}\n` +
      `Org Idle Ratio (%),${orgKpis.orgIdle}\n` +
      `System Buffer Time Excluded (sec),${orgKpis.systemBufferSeconds}\n` +
      `NVA Hours Lost,${orgKpis.totalNvaLossHours}\n`

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `NovaArc_Executive_Summary_${timeframe}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading && !team) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ display: 'inline-block', marginBottom: 12 }}>
          <RefreshCw className="spin" size={28} color="#7c3aed" />
        </div>
        <div>Streaming Live Executive Operations Telemetry...</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Executive Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--text-main, #18171c)',
                margin: 0,
                letterSpacing: '-0.02em'
              }}
            >
              Enterprise Revenue Cycle Operations
            </h1>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 9999,
                background: isPolling ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.15)',
                color: isPolling ? '#059669' : '#64748b',
                border: isPolling ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #cbd5e1',
                display: 'flex',
                alignItems: 'center',
                gap: 5
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
              {isPolling ? `Executive Live (${countdown}s Async)` : 'Polling Paused'}
            </span>
          </div>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-muted, #716e7d)',
              margin: '4px 0 0 0'
            }}
          >
            Real-time cross-team AHT, KPI rollups, Efficiency, Idle Ratio &amp; excluded System Buffer telemetry
          </p>
        </div>

        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={togglePolling}
            className="btn-ghost"
            style={{ padding: '7px 10px', fontSize: '0.75rem', borderRadius: 10 }}
            title={isPolling ? 'Pause live async polling' : 'Resume live async polling'}
          >
            {isPolling ? <Pause size={13} /> : <Play size={13} />}
          </button>

          <button
            onClick={() => refreshNow()}
            className="btn-ghost"
            style={{ padding: '7px 10px', fontSize: '0.75rem', borderRadius: 10 }}
            title="Refresh telemetry immediately"
          >
            <RefreshCw size={13} />
          </button>

          {/* Timeframe selector */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-card, rgba(255, 255, 255, 0.75))',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              borderRadius: 12,
              padding: 3
            }}
          >
            {(['TODAY', 'WTD', 'MTD'] as const).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 9,
                  border: 'none',
                  background: timeframe === tf ? '#18171c' : 'transparent',
                  color: timeframe === tf ? '#ffffff' : 'var(--text-muted, #716e7d)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Export Report */}
          <button
            onClick={handleExportBriefing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 16px',
              borderRadius: 12,
              border: '1px solid var(--border-subtle, #e2e8f0)',
              background: 'var(--bg-card, #ffffff)',
              color: 'var(--text-main, #18171c)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Download size={15} />
            <span>Export Briefing</span>
          </button>
        </div>
      </div>

      {/* Top Executive KPI Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))',
          gap: 16
        }}
      >
        <KpiCard
          title="Total Claims Adjudicated"
          value={orgKpis.totalClaims}
          subtitle={`Exp: ${orgKpis.claimsTarget} | ${orgKpis.activeAssociates}/${orgKpis.totalAssociates} active`}
          status="optimal"
          badge="LIVE"
          icon={<Briefcase size={18} />}
        />

        <KpiCard
          title="Org Avg Handle Time"
          value={`${orgKpis.avgHandleTime}m`}
          subtitle={`SLA: 9.0m · Occ: ${orgKpis.orgOccupancy}%`}
          status={orgKpis.avgHandleTime <= 9.0 ? 'optimal' : 'warning'}
          icon={<Clock size={18} />}
        />

        <KpiCard
          title="Org Efficiency (C02)"
          value={`${orgKpis.orgEfficiency}%`}
          subtitle={`Util: ${orgKpis.orgUtilisation}% · Gap: ${orgKpis.capacityGapMinutes}m`}
          status={orgKpis.orgEfficiency >= 80 ? 'optimal' : 'warning'}
          icon={<Award size={18} />}
        />

        <KpiCard
          title="Idle Ratio & NVA Loss"
          value={`${orgKpis.orgIdle}%`}
          subtitle={`NVA Loss: ${orgKpis.totalNvaLossHours}h · Top: ${nva?.top_nva_category || 'NONE'}`}
          status={orgKpis.orgIdle <= 10 ? 'optimal' : 'warning'}
          icon={<TrendingUp size={18} />}
        />

        <KpiCard
          title="System Buffer Time"
          value={`${Math.floor(orgKpis.systemBufferSeconds / 60)}m ${orgKpis.systemBufferSeconds % 60}s`}
          subtitle="Load >10s · Excl. from AHT & KPI"
          accentColor="#0891b2"
          badge="SEPARATE"
          icon={<Hourglass size={18} />}
        />
      </div>

      {/* Live Enterprise Telemetry Graph (1s Async) */}
      <LiveTeamMetricsChart
        associates={team?.associates || []}
        title="Live Org-Wide AHT, Efficiency & Idle Stream"
        subtitle={`Real-time 1s asynchronous updates (${timeframe}) · ${orgKpis.activeAssociates} active agent(s)`}
        slaTargetMinutes={9.0}
      />

      {/* Cross-Manager Oversight Table */}
      <div
        style={{
          background: 'var(--bg-card, rgba(255, 255, 255, 0.78))',
          backdropFilter: 'blur(16px)',
          borderRadius: 24,
          padding: '24px',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          boxShadow: 'var(--shadow-md, 0 10px 25px -5px rgba(0, 0, 0, 0.05))'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: 'var(--accent-tint, rgba(124, 58, 237, 0.1))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary, #7c3aed)'
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 800, color: 'var(--text-main, #18171c)' }}>
                Cross-Manager Performance &amp; Live Pod Rollup
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #716e7d)' }}>
                Computed live from {orgKpis.totalAssociates} tracked associates · click any pod to drill into Supervisor view
              </span>
            </div>
          </div>

          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 9999,
              background: '#ede9fe',
              color: '#7c3aed'
            }}
          >
            {teamComparison.length} Operational Pods · {orgKpis.activeAssociates} Live Now
          </span>
        </div>

        {/* Teams Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border-subtle, #e2e8f0)', fontSize: '0.75rem', color: 'var(--text-muted, #716e7d)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>POD &amp; SUPERVISOR</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>STAFF</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>VOLUME</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>AVG AHT</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>EFFICIENCY</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>IDLE %</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>SYS BUFFER</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {teamComparison.map(pod => (
                <tr
                  key={pod.supervisorId}
                  onClick={() => onSelectManager && onSelectManager(pod.supervisorId)}
                  style={{
                    borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                    fontSize: '0.875rem',
                    cursor: onSelectManager ? 'pointer' : 'default',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 800, color: 'var(--text-main, #18171c)' }}>{pod.teamName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #716e7d)', marginTop: 2 }}>
                      Lead: <strong>{pod.supervisorName}</strong> ({pod.supervisorId})
                    </div>
                  </td>

                  <td style={{ padding: '16px', color: 'var(--text-main, #18171c)', fontWeight: 600 }}>
                    {pod.activeAssociates} active / {pod.totalAssociates} total
                  </td>

                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-main, #18171c)' }}>
                      {pod.claimsCompleted} / {pod.targetClaims}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: pod.claimsCompleted >= pod.targetClaims ? '#059669' : '#d97706', fontWeight: 700 }}>
                      {Math.round((pod.claimsCompleted / Math.max(1, pod.targetClaims)) * 100)}% of expected
                    </div>
                  </td>

                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: pod.ahtMinutes <= 9.0 ? '#059669' : '#d97706' }}>
                      {pod.ahtMinutes}m
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #716e7d)' }}>Benchmark: 9.0m</div>
                  </td>

                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#7c3aed' }}>
                      {pod.efficiencyScore}%
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #716e7d)' }}>Top: {pod.topPerformer}</div>
                  </td>

                  <td style={{ padding: '16px', fontWeight: 700, color: pod.idlePercentage > 15 ? '#dc2626' : '#0f172a' }}>
                    {pod.idlePercentage}%
                  </td>

                  <td style={{ padding: '16px', fontWeight: 700, color: '#0891b2' }}>
                    {Math.floor(pod.systemBufferSeconds / 60)}m {pod.systemBufferSeconds % 60}s
                  </td>

                  <td style={{ padding: '16px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 9999,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: pod.status === 'EXCEEDING_TARGET' ? '#ecfdf5' : pod.status === 'ON_TRACK' ? '#fef3c7' : '#fef2f2',
                        color: pod.status === 'EXCEEDING_TARGET' ? '#065f46' : pod.status === 'ON_TRACK' ? '#92400e' : '#b91c1c',
                        border: `1px solid ${pod.status === 'EXCEEDING_TARGET' ? '#a7f3d0' : pod.status === 'ON_TRACK' ? '#fde68a' : '#fecaca'}`
                      }}
                    >
                      {pod.status === 'EXCEEDING_TARGET' ? 'Exceeding SLA' : pod.status === 'ON_TRACK' ? 'On Track' : 'Needs Review'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Strategic Insights & Live NVA Breakdown Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {/* Live Departmental NVA Friction */}
        <div
          style={{
            background: 'var(--bg-card, rgba(255, 255, 255, 0.78))',
            backdropFilter: 'blur(16px)',
            borderRadius: 24,
            padding: '24px',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            boxShadow: 'var(--shadow-md, 0 10px 25px -5px rgba(0, 0, 0, 0.05))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#dc2626'
              }}
            >
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main, #18171c)' }}>
                Departmental NVA Friction Breakdown (Live)
              </h3>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #716e7d)' }}>
                Total tracked NVA loss: {orgKpis.totalNvaLossHours} hrs · Dominant: {nva?.top_nva_category || 'NONE'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {nvaBreakdown.map((item, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-main, #18171c)' }}>{item.label}</span>
                  <span style={{ fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: item.color }}>
                    {item.count} ({item.pct}%)
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(item.count > 0 ? 4 : 0, item.pct)}%`, height: '100%', background: item.color, borderRadius: 3, transition: 'width 0.35s ease' }} />
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #716e7d)', marginTop: 2 }}>
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Executive Directives & AI Recommendations */}
        <div
          style={{
            background: 'var(--bg-card, rgba(255, 255, 255, 0.78))',
            backdropFilter: 'blur(16px)',
            borderRadius: 24,
            padding: '24px',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            boxShadow: 'var(--shadow-md, 0 10px 25px -5px rgba(0, 0, 0, 0.05))',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: 'rgba(16, 185, 129, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#059669'
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main, #18171c)' }}>
                  Executive Directives &amp; AI Recommendations
                </h3>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #716e7d)' }}>
                  Live operational guidance synthesized from today&apos;s telemetry
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(insights?.insights || []).slice(0, 3).map(ins => (
                <div
                  key={ins.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: ins.severity === 'HIGH' ? 'rgba(220, 38, 38, 0.06)' : 'rgba(124, 58, 237, 0.06)',
                    border: `1px solid ${ins.severity === 'HIGH' ? 'rgba(220, 38, 38, 0.2)' : 'rgba(124, 58, 237, 0.15)'}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: ins.severity === 'HIGH' ? '#991b1b' : '#5b21b6' }}>
                      {ins.title}
                    </span>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b' }}>
                      -{ins.estimated_time_loss_mins}m est.
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#334155', marginTop: 4 }}>
                    {ins.recommendation}
                  </div>
                </div>
              ))}
              {(!insights?.insights || insights.insights.length === 0) && (
                <div style={{ fontSize: '0.8125rem', color: '#64748b', padding: 12 }}>
                  Waiting for AI recommendations stream...
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              paddingTop: 14,
              marginTop: 14,
              borderTop: '1px solid var(--border-subtle, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--text-muted, #716e7d)'
            }}
          >
            <span>System Buffer Excluded: <strong>{Math.floor(orgKpis.systemBufferSeconds / 60)}m {orgKpis.systemBufferSeconds % 60}s</strong></span>
            <span style={{ color: '#059669', fontWeight: 700 }}>
              Synced {insights?.timestamp ? new Date(insights.timestamp).toLocaleTimeString() : 'Live'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
