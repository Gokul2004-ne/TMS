import React, { useState, useEffect } from 'react'
import {
  CheckCircle2,
  Clock,
  Zap,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Layers,
  ArrowRight
} from 'lucide-react'
import { AssociateTodayData } from '../api/types'
import { api } from '../api/client'
import { KpiCard } from '../components/KpiCard'
import { AppBreakdownBar } from '../components/AppBreakdownBar'
import { NvaBadge } from '../components/NvaBadge'

interface AssociateDashboardProps {
  onSelectClaim: (claimId: string) => void
}

export const AssociateDashboard: React.FC<AssociateDashboardProps> = ({ onSelectClaim }) => {
  const [data, setData] = useState<AssociateTodayData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await api.getAssociateToday('EMP101')
      setData(res)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading Associate Workspace...
      </div>
    )
  }

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60)
    return `${mins}m ${sec % 60}s`
  }

  return (
    <div>
      {/* Active Claim Context Banner */}
      <div className="glass-card" style={{
        background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)',
        borderColor: 'rgba(56, 189, 248, 0.3)',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(56, 189, 248, 0.4)'
          }}>
            <Zap size={24} color="#031120" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>
                Active Claim Context
              </span>
              <span className="pulse-dot"></span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
              {data.active_claim_id || 'IDLE / UNASSIGNED'}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              All foreground activity across Excel, Chrome & ClaimPlatform is actively tracked under this context.
            </div>
          </div>
        </div>

        {data.active_claim_id && (
          <button
            className="btn-primary"
            onClick={() => onSelectClaim(data.active_claim_id!)}
          >
            <span>Inspect Live Timeline</span>
            <ArrowRight size={16} />
          </button>
        )}
      </div>

      {/* KPI Cards Row */}
      <div className="kpi-grid">
        <KpiCard
          title="Claims Processed"
          value={`${data.completed_claims_count} / ${data.target_claims}`}
          subtitle={`Target Progress: ${Math.round((data.completed_claims_count / data.target_claims) * 100)}%`}
          icon={<CheckCircle2 size={18} />}
          accentColor="var(--accent-emerald)"
          badge="ON TRACK"
        />
        <KpiCard
          title="Average Handling Time"
          value={`${data.aht_minutes}m`}
          subtitle="Target Benchmark: 8.0m"
          icon={<Clock size={18} />}
          accentColor="var(--accent-cyan)"
          trend={{ value: '0.6m faster', isPositive: true }}
        />
        <KpiCard
          title="Idle Time Ratio"
          value={`${data.idle_percentage}%`}
          subtitle={`${Math.round(data.total_idle_seconds / 60)} mins accumulated idle`}
          icon={<AlertCircle size={18} />}
          accentColor="var(--accent-amber)"
        />
        <KpiCard
          title="Efficiency Score"
          value={`${data.efficiency_score}%`}
          subtitle="Quality & Effort composite"
          icon={<TrendingUp size={18} />}
          accentColor="var(--accent-indigo)"
          badge="OPTIMAL"
        />
      </div>

      {/* Main Content 2-Column Grid */}
      <div className="two-col-grid">
        {/* Left Column: Recent Claims Table */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 className="title-md">Today's Claim Activity Log</h2>
              <p className="text-sub">Chronological list of claims processed in this shift</p>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>
              {data.recent_claims.length} claims recorded
            </span>
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
              {data.recent_claims.map((c, i) => (
                <tr key={i} onClick={() => onSelectClaim(c.claim_id)}>
                  <td>
                    <span className="mono" style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
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
                      borderRadius: 4,
                      background: c.status === 'COMPLETED' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                      color: c.status === 'COMPLETED' ? 'var(--accent-emerald)' : 'var(--accent-cyan)'
                    }}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                      <ExternalLink size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right Column: Application Time Distribution */}
        <div className="glass-card">
          <div style={{ marginBottom: 16 }}>
            <h2 className="title-md">Application Time Share</h2>
            <p className="text-sub">Where time was spent across today's shift</p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <AppBreakdownBar items={data.app_distribution} height={16} showLegend={false} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.app_distribution.map((app, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.04)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: app.color }} />
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {app.app_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      {Math.round(app.duration_seconds / 60)} minutes
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {app.percentage}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
