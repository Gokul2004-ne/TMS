import React, { useState, useEffect, useMemo } from 'react'
import {
  Users,
  Clock,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  FileSpreadsheet,
  Shuffle,
  ShieldAlert,
  Repeat,
  Flame,
  ArrowUpDown,
  Download,
  RefreshCw,
  Pause,
  Play,
  ArrowRight
} from 'lucide-react'
import { TeamOverviewData, NVASummaryData, InsightsResponse } from '../api/types'
import { api } from '../api/client'
import { KpiCard } from '../components/KpiCard'
import { InsightCard } from '../components/InsightCard'
import { useLivePolling } from '../hooks/useLivePolling'

interface SupervisorDashboardProps {
  onSelectAssociate?: (associateId: string) => void
}

type SortField = 'name' | 'status' | 'completed_claims' | 'aht_minutes' | 'idle_percentage' | 'efficiency_score' | 'flags_count'
type SortOrder = 'asc' | 'desc'

export const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({ onSelectAssociate }) => {
  const [team, setTeam] = useState<TeamOverviewData | null>(null)
  const [nva, setNva] = useState<NVASummaryData | null>(null)
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('efficiency_score')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('tms_dismissed_alerts')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  const loadData = async () => {
    try {
      const [teamRes, nvaRes, insRes] = await Promise.all([
        api.getTeamOverview(),
        api.getTeamNvaSummary(),
        api.getAiInsights()
      ])
      setTeam(teamRes)
      setNva(nvaRes)
      setInsights(insRes)
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
    loadData()
  }, [])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const sortedAssociates = useMemo(() => {
    if (!team?.associates) return []
    const list = [...team.associates]
    list.sort((a, b) => {
      let valA = a[sortField]
      let valB = b[sortField]

      if (typeof valA === 'string') {
        valA = (valA as string).toLowerCase()
        valB = (valB as string).toLowerCase()
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [team?.associates, sortField, sortOrder])

  const handleExportTeamCsv = () => {
    if (!team?.associates || team.associates.length === 0) return

    const headers = ['Associate ID', 'Name', 'Status', 'Current Claim', 'Completed Claims', 'AHT (mins)', 'Idle (%)', 'Efficiency Score (%)', 'NVA Flags']
    const rows = team.associates.map(a => [
      a.associate_id,
      `"${a.name}"`,
      a.status,
      a.current_claim_id || 'None',
      a.completed_claims,
      a.aht_minutes,
      a.idle_percentage,
      a.efficiency_score,
      a.flags_count
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `TMS_Team_Operations_${team.date || new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading || !team || !nva || !insights) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ display: 'inline-block', marginBottom: 12 }}>
          <RefreshCw className="spin" size={28} color="var(--accent-primary)" />
        </div>
        <div>Loading Supervisor Operations Dashboard...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Top Controls Bar */}
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

        <button
          onClick={handleExportTeamCsv}
          className="btn-ghost"
          style={{ padding: '6px 14px', fontSize: '0.8125rem' }}
        >
          <Download size={14} />
          <span>Export Operations CSV</span>
        </button>
      </div>

      {/* Active Operational Alerts Banner */}
      {team.active_alerts && team.active_alerts.filter(al => !dismissedAlerts.has(`${al.associate_id}:${al.type}`)).length > 0 && (
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {team.active_alerts
            .filter(al => !dismissedAlerts.has(`${al.associate_id}:${al.type}`))
            .map((al, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 16px',
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderLeft: '4px solid var(--accent-rose)',
                color: 'var(--accent-rose)',
                fontSize: '0.8125rem',
                animation: 'fadeIn 0.2s ease-out'
              }}
            >
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, marginRight: 6 }}>{al.type}:</span>
                {al.message}
              </div>
              <button
                onClick={async () => {
                  const key = `${al.associate_id}:${al.type}`
                  setDismissedAlerts(prev => {
                    const next = new Set([...prev, key])
                    try { localStorage.setItem('tms_dismissed_alerts', JSON.stringify([...next])) } catch {}
                    return next
                  })
                  await api.resolveAlert(al.type, al.associate_id)
                }}
                title="Dismiss alert"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--accent-rose)',
                  fontWeight: 700,
                  fontSize: '1rem',
                  lineHeight: 1,
                  padding: '2px 6px',
                  opacity: 0.7,
                  flexShrink: 0
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Team Top-level KPIs */}
      <div className="kpi-grid">
        <KpiCard
          title="Active Associates"
          value={`${team.active_associates_count} / ${team.total_associates}`}
          subtitle="Currently active in shift"
          icon={<Users size={16} />}
          accentColor="#0f172a"
          badge="SHIFT ACTIVE"
        />
        <KpiCard
          title="Team Output"
          value={team.total_claims_completed}
          subtitle="Claims completed today"
          icon={<TrendingUp size={16} />}
          accentColor="#10b981"
          badge="ON TRACK"
        />
        <KpiCard
          title="Team AHT"
          value={`${team.team_aht_minutes}m`}
          subtitle="Target benchmark: 8.0m"
          icon={<Clock size={16} />}
          accentColor="#4f46e5"
        />
        <KpiCard
          title="NVA Time Lost"
          value={`${nva.total_nva_time_lost_hours}h`}
          subtitle="Estimated friction lost today"
          icon={<Flame size={16} />}
          accentColor="#dc2626"
          badge="ACTION REQUIRED"
        />
      </div>

      {/* Associates Performance Table */}
      <div className="glass-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 className="title-md">Associate Operational Matrix</h2>
            <p className="text-sub">Click any associate row to drill down into their individual workspace</p>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Sorted by {sortField} ({sortOrder})
          </span>
        </div>

        <table className="tms-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Associate <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Status <ArrowUpDown size={12} />
                </div>
              </th>
              <th>Current Claim</th>
              <th onClick={() => handleSort('completed_claims')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Claims Done <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('aht_minutes')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  AHT <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('idle_percentage')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Idle % <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('efficiency_score')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Efficiency <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('flags_count')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  NVA Flags <ArrowUpDown size={12} />
                </div>
              </th>
              <th>Drilldown</th>
            </tr>
          </thead>
          <tbody>
            {sortedAssociates.map((a, i) => (
              <tr
                key={i}
                onClick={() => onSelectAssociate && onSelectAssociate(a.associate_id)}
                style={{ cursor: onSelectAssociate ? 'pointer' : 'default' }}
                title="Click to view Associate Dashboard"
              >
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 26,
                      height: 26,
                      background: '#0f172a',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.6875rem',
                      fontWeight: 800
                    }}>
                      {a.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{a.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{a.associate_id}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    background: a.status === 'ACTIVE' ? '#f0fdf4' : a.status === 'IDLE' ? '#fffbeb' : '#f1f5f9',
                    color: a.status === 'ACTIVE' ? 'var(--accent-emerald)' : a.status === 'IDLE' ? 'var(--accent-amber)' : 'var(--text-dim)',
                    border: `1px solid ${a.status === 'ACTIVE' ? '#bbf7d0' : a.status === 'IDLE' ? '#fde68a' : '#e2e8f0'}`
                  }}>
                    ● {a.status}
                  </span>
                </td>
                <td>
                  <span className="mono" style={{ color: a.current_claim_id ? '#0f172a' : 'var(--text-dim)', fontWeight: 700 }}>
                    {a.current_claim_id || 'None'}
                  </span>
                </td>
                <td><strong>{a.completed_claims}</strong></td>
                <td>{a.aht_minutes}m</td>
                <td style={{ color: a.idle_percentage > 20 ? 'var(--accent-rose)' : 'inherit', fontWeight: a.idle_percentage > 20 ? 700 : 500 }}>
                  {a.idle_percentage}%
                </td>
                <td>
                  <strong style={{ color: a.efficiency_score >= 85 ? 'var(--accent-emerald)' : a.efficiency_score >= 75 ? 'var(--accent-amber)' : 'var(--accent-rose)' }}>
                    {a.efficiency_score}%
                  </strong>
                </td>
                <td>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    background: a.flags_count > 4 ? '#fef2f2' : '#f8fafc',
                    color: a.flags_count > 4 ? 'var(--accent-rose)' : 'var(--text-muted)',
                    border: `1px solid ${a.flags_count > 4 ? '#fecaca' : '#e2e8f0'}`
                  }}>
                    {a.flags_count} flags
                  </span>
                </td>
                <td>
                  <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: '0.75rem' }}>
                    <ArrowRight size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Non-Value-Added (NVA) Activity Category Breakdown */}
      <div className="glass-card" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <h2 className="title-md">Team NVA Friction Distribution</h2>
          <p className="text-sub">Breakdown of unproductive patterns detected across claims today</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ padding: 14, background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-emerald)', marginBottom: 6 }}>
              <FileSpreadsheet size={15} />
              <span style={{ fontSize: '0.6875rem', fontWeight: 800 }}>EXCEL OVERUSE</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {nva.excel_overuse_claims_count}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>claims exceeded 40% active time</div>
          </div>

          <div style={{ padding: 14, background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-indigo)', marginBottom: 6 }}>
              <Shuffle size={15} />
              <span style={{ fontSize: '0.6875rem', fontWeight: 800 }}>APP SWITCH SPIKES</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {nva.app_switching_spikes_count}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>claims with ≥ 8 toggles</div>
          </div>

          <div style={{ padding: 14, background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-amber)', marginBottom: 6 }}>
              <ShieldAlert size={15} />
              <span style={{ fontSize: '0.6875rem', fontWeight: 800 }}>LONG IDLE INCIDENTS</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {nva.long_idle_incidents_count}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>claims with ≥ 3m inactivity</div>
          </div>

          <div style={{ padding: 14, background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-rose)', marginBottom: 6 }}>
              <Flame size={15} />
              <span style={{ fontSize: '0.6875rem', fontWeight: 800 }}>OUTLIERS</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {nva.outlier_claims_count}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>claims exceeded 20 minutes</div>
          </div>

          <div style={{ padding: 14, background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0f766e', marginBottom: 6 }}>
              <Repeat size={15} />
              <span style={{ fontSize: '0.6875rem', fontWeight: 800 }}>REWORK TOUCHES</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {nva.rework_claims_count}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>multi-touch claims</div>
          </div>
        </div>
      </div>

      {/* AI Operational Insights & Coaching Recommendations */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28,
              height: 28,
              background: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={15} color="#ffffff" />
            </div>
            <div>
              <h2 className="title-md">AI Insights & Coaching Recommendations</h2>
              <p className="text-sub">Autonomous pattern detection synthesized by Gemini 2.5 Flash</p>
            </div>
          </div>

          <div style={{
            fontSize: '0.75rem',
            padding: '3px 8px',
            background: insights.is_ai_live ? '#f0fdf4' : '#f1f5f9',
            color: insights.is_ai_live ? 'var(--accent-emerald)' : 'var(--text-muted)',
            border: `1px solid ${insights.is_ai_live ? '#bbf7d0' : '#cbd5e1'}`,
            fontWeight: 700
          }}>
            {insights.is_ai_live ? '● Live Gemini Model' : '○ Curated Heuristic Engine'}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          {insights.insights.map(item => (
            <InsightCard key={item.id} insight={item} />
          ))}
        </div>
      </div>
    </div>
  )
}
