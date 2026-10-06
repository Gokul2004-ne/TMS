import React, { useState, useEffect } from 'react'
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
  Flame
} from 'lucide-react'
import { TeamOverviewData, NVASummaryData, InsightsResponse } from '../api/types'
import { api } from '../api/client'
import { KpiCard } from '../components/KpiCard'
import { InsightCard } from '../components/InsightCard'

export const SupervisorDashboard: React.FC = () => {
  const [team, setTeam] = useState<TeamOverviewData | null>(null)
  const [nva, setNva] = useState<NVASummaryData | null>(null)
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
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

  if (loading || !team || !nva || !insights) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading Supervisor Operations Dashboard...
      </div>
    )
  }

  return (
    <div>
      {/* Active Operational Alerts Banner */}
      {team.active_alerts && team.active_alerts.length > 0 && (
        <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {team.active_alerts.map((al, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 10,
                color: 'var(--accent-rose)',
                fontSize: '0.875rem'
              }}
            >
              <AlertTriangle size={18} />
              <div style={{ flex: 1 }}>
                <strong>{al.type}:</strong> {al.message}
              </div>
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
          icon={<Users size={18} />}
          accentColor="var(--accent-cyan)"
        />
        <KpiCard
          title="Team Output"
          value={team.total_claims_completed}
          subtitle="Claims completed today"
          icon={<TrendingUp size={18} />}
          accentColor="var(--accent-emerald)"
        />
        <KpiCard
          title="Team AHT"
          value={`${team.team_aht_minutes}m`}
          subtitle="Target AHT benchmark: 8.0m"
          icon={<Clock size={18} />}
          accentColor="var(--accent-indigo)"
        />
        <KpiCard
          title="NVA Time Lost"
          value={`${nva.total_nva_time_lost_hours}h`}
          subtitle="Estimated wasted effort today"
          icon={<Flame size={18} />}
          accentColor="var(--accent-rose)"
          badge="ACTION REQUIRED"
        />
      </div>

      {/* Associates Performance Table */}
      <div className="glass-card" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 className="title-md">Associate Operational Matrix</h2>
            <p className="text-sub">Real-time status, claim throughput, and efficiency scores</p>
          </div>
        </div>

        <table className="tms-table">
          <thead>
            <tr>
              <th>Associate</th>
              <th>Status</th>
              <th>Current Claim</th>
              <th>Claims Done</th>
              <th>AHT</th>
              <th>Idle %</th>
              <th>Efficiency</th>
              <th>NVA Flags</th>
            </tr>
          </thead>
          <tbody>
            {team.associates.map((a, i) => (
              <tr key={i}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--accent-cyan)'
                    }}>
                      {a.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{a.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{a.associate_id}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: a.status === 'ACTIVE' ? 'rgba(52, 211, 153, 0.15)' : a.status === 'IDLE' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                    color: a.status === 'ACTIVE' ? 'var(--accent-emerald)' : a.status === 'IDLE' ? 'var(--accent-amber)' : 'var(--text-dim)',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}>
                    ● {a.status}
                  </span>
                </td>
                <td>
                  <span className="mono" style={{ color: a.current_claim_id ? 'var(--accent-cyan)' : 'var(--text-dim)', fontWeight: 600 }}>
                    {a.current_claim_id || 'None'}
                  </span>
                </td>
                <td><strong>{a.completed_claims}</strong></td>
                <td>{a.aht_minutes}m</td>
                <td style={{ color: a.idle_percentage > 20 ? 'var(--accent-rose)' : 'inherit' }}>
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
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: a.flags_count > 4 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    color: a.flags_count > 4 ? 'var(--accent-rose)' : 'var(--text-muted)'
                  }}>
                    {a.flags_count} flags
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Non-Value-Added (NVA) Activity Category Breakdown */}
      <div className="glass-card" style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 16 }}>
          <h2 className="title-md">Team NVA Friction Distribution</h2>
          <p className="text-sub">Breakdown of unproductive patterns detected across claims today</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div style={{ padding: 14, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-emerald)', marginBottom: 6 }}>
              <FileSpreadsheet size={16} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>EXCEL OVERUSE</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{nva.excel_overuse_claims_count} claims</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>&gt;40% duration in Excel</div>
          </div>

          <div style={{ padding: 14, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-amber)', marginBottom: 6 }}>
              <Shuffle size={16} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>APP SWITCHING</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{nva.app_switching_spikes_count} claims</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>&gt;8 toggles per claim</div>
          </div>

          <div style={{ padding: 14, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-rose)', marginBottom: 6 }}>
              <Clock size={16} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>LONG IDLE</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{nva.long_idle_incidents_count} claims</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>&gt;3 mins inactive pause</div>
          </div>

          <div style={{ padding: 14, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-purple)', marginBottom: 6 }}>
              <ShieldAlert size={16} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>OUTLIERS</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{nva.outlier_claims_count} claims</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>&gt;20 mins handling time</div>
          </div>

          <div style={{ padding: 14, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-indigo)', marginBottom: 6 }}>
              <Repeat size={16} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>REWORK TOUCHES</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{nva.rework_claims_count} claims</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Multiple re-openings</div>
          </div>
        </div>
      </div>

      {/* AI Intelligence & Recommendations Feed */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Sparkles size={16} color="#fff" />
          </div>
          <div>
            <h2 className="title-md">Gemini AI Operational Recommendations</h2>
            <p className="text-sub">Automated root-cause analysis and actionable coaching insights</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {insights.insights.map((ins, i) => (
            <InsightCard key={i} insight={ins} />
          ))}
        </div>
      </div>
    </div>
  )
}
