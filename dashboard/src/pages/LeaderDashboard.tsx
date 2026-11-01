import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  Award,
  Users,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Download,
  DollarSign,
  Briefcase,
  CheckCircle2,
  Building,
  Target,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Filter
} from 'lucide-react'
import { KpiCard } from '../components/KpiCard'

interface LeaderDashboardProps {
  onSelectManager?: (managerId: string) => void
}

export const LeaderDashboard: React.FC<LeaderDashboardProps> = ({ onSelectManager }) => {
  const [timeframe, setTimeframe] = useState<'TODAY' | 'WTD' | 'MTD'>('TODAY')

  const teamComparison = [
    {
      teamName: 'Operations Team Alpha',
      supervisorId: 'MGR101',
      supervisorName: 'Sarah Jenkins',
      activeAssociates: 4,
      claimsCompleted: 138,
      targetClaims: 130,
      ahtMinutes: 5.4,
      efficiencyScore: 92,
      nvaLossHours: 3.2,
      status: 'EXCEEDING_TARGET',
      topPerformer: 'Priya Sharma (EMP101)'
    },
    {
      teamName: 'Operations Team Beta',
      supervisorId: 'MGR102',
      supervisorName: 'Robert Vance',
      activeAssociates: 4,
      claimsCompleted: 118,
      targetClaims: 125,
      ahtMinutes: 6.3,
      efficiencyScore: 86,
      nvaLossHours: 5.8,
      status: 'ON_TRACK',
      topPerformer: 'Marcus Chen (EMP102)'
    }
  ]

  const orgKpis = {
    totalClaims: 256,
    claimsTarget: 255,
    avgHandleTime: 5.8,
    orgEfficiency: 89.2,
    totalNvaLossHours: 9.0,
    dollarValueAdjudicated: 784250,
    costOfNvaPrevented: 14200
  }

  const handleExportBriefing = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Metric,Value\n' +
      `Total Claims Completed,${orgKpis.totalClaims}\n` +
      `Average Handle Time (min),${orgKpis.avgHandleTime}\n` +
      `Org Productive Efficiency (%),${orgKpis.orgEfficiency}\n` +
      `Claims Value Adjudicated ($),${orgKpis.dollarValueAdjudicated}\n` +
      `NVA Cost Saved ($),${orgKpis.costOfNvaPrevented}\n`

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `NovaArc_Executive_Summary_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#059669',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              Executive Oversight Live
            </span>
          </div>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-muted, #716e7d)',
              margin: '4px 0 0 0'
            }}
          >
            Cross-team transaction velocity, supervisor benchmarks & Non-Value-Add cost prevention
          </p>
        </div>

        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
              cursor: 'pointer',
              boxShadow: 'var(--shadow-xs, 0 1px 3px rgba(0,0,0,0.05))'
            }}
          >
            <Download size={15} />
            <span>Export Executive Briefing</span>
          </button>
        </div>
      </div>

      {/* Top Executive KPI Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16
        }}
      >
        <KpiCard
          title="Total Claims Adjudicated"
          value={orgKpis.totalClaims}
          benchmark={`Target: ${orgKpis.claimsTarget}`}
          status="optimal"
          subtext="+12% over forecasted run-rate"
          icon={<Briefcase size={18} />}
        />

        <KpiCard
          title="Org-Wide Avg Handle Time"
          value={`${orgKpis.avgHandleTime}m`}
          benchmark="SLA: < 6.5m"
          status="optimal"
          subtext="0.7m faster than enterprise threshold"
          icon={<Clock size={18} />}
        />

        <KpiCard
          title="Productive Effort Ratio"
          value={`${orgKpis.orgEfficiency}%`}
          benchmark="Target: 85%"
          status="optimal"
          subtext="High clinical engagement efficiency"
          icon={<Award size={18} />}
        />

        <KpiCard
          title="Total Claims Value Adjudicated"
          value={`$${(orgKpis.dollarValueAdjudicated / 1000).toFixed(1)}k`}
          benchmark="Recovery Pace: High"
          status="optimal"
          subtext="$14.2k NVA financial friction prevented"
          icon={<DollarSign size={18} />}
        />
      </div>

      {/* Cross-Manager Oversight Table */}
      <div
        style={{
          background: 'var(--bg-card, rgba(255, 255, 255, 0.75))',
          backdropFilter: 'blur(16px)',
          borderRadius: 24,
          padding: '24px',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.8))',
          boxShadow: 'var(--shadow-md, 0 10px 25px -5px rgba(0, 0, 0, 0.05))'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
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
                Cross-Manager Performance & Team Rollup
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #716e7d)' }}>
                Direct comparison between Operations Teams under active management
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
            2 Active Teams · 8 Specialists
          </span>
        </div>

        {/* Teams Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border-subtle, #e2e8f0)', fontSize: '0.75rem', color: 'var(--text-muted, #716e7d)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>TEAM & SUPERVISOR</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>ACTIVE STAFF</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>VOLUME TODAY</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>AVG HANDLE TIME</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>EFFICIENCY</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>NVA TIME LOST</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {teamComparison.map(team => (
                <tr
                  key={team.supervisorId}
                  style={{
                    borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                    fontSize: '0.875rem',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.015)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 800, color: 'var(--text-main, #18171c)' }}>{team.teamName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #716e7d)', marginTop: 2 }}>
                      Supervisor: <strong>{team.supervisorName}</strong> ({team.supervisorId})
                    </div>
                  </td>

                  <td style={{ padding: '16px', color: 'var(--text-main, #18171c)', fontWeight: 600 }}>
                    {team.activeAssociates} FTEs
                  </td>

                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-main, #18171c)' }}>
                      {team.claimsCompleted} / {team.targetClaims}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: team.claimsCompleted >= team.targetClaims ? '#059669' : '#d97706', fontWeight: 700 }}>
                      {Math.round((team.claimsCompleted / team.targetClaims) * 100)}% of goal
                    </div>
                  </td>

                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: team.ahtMinutes <= 6.0 ? '#059669' : '#d97706' }}>
                      {team.ahtMinutes} min
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #716e7d)' }}>Benchmark: 6.5m</div>
                  </td>

                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#7c3aed' }}>
                      {team.efficiencyScore}%
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #716e7d)' }}>Top: {team.topPerformer}</div>
                  </td>

                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 700, color: team.nvaLossHours <= 4 ? '#059669' : '#dc2626' }}>
                      {team.nvaLossHours} hrs
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #716e7d)' }}>Across 4 shifts</div>
                  </td>

                  <td style={{ padding: '16px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 9999,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: team.status === 'EXCEEDING_TARGET' ? '#ecfdf5' : '#fef3c7',
                        color: team.status === 'EXCEEDING_TARGET' ? '#065f46' : '#92400e',
                        border: `1px solid ${team.status === 'EXCEEDING_TARGET' ? '#a7f3d0' : '#fde68a'}`
                      }}
                    >
                      {team.status === 'EXCEEDING_TARGET' ? 'Exceeding SLA' : 'On Track'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Strategic Insights & Root Cause Analysis Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {/* NVA Root Cause Friction */}
        <div
          style={{
            background: 'var(--bg-card, rgba(255, 255, 255, 0.75))',
            backdropFilter: 'blur(16px)',
            borderRadius: 24,
            padding: '24px',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.8))',
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
                Departmental NVA Friction Breakdown
              </h3>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #716e7d)' }}>
                Where operational effort is lost across the revenue cycle
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Excel Crosswalk Overuse', pct: 42, color: '#16a34a', desc: 'Manual modifier lookup instead of NovaArc auto-scrub' },
              { label: 'Payer Portal App Switching', pct: 28, color: '#2563eb', desc: 'Frequent browser switching for eligibility re-checks' },
              { label: 'Post-Adjudication Rework', pct: 18, color: '#7c3aed', desc: 'Re-opened claims due to missing clinical documentation' },
              { label: 'Long System Idle Periods', pct: 12, color: '#d97706', desc: 'Latency waiting for Epic or Clearinghouse response' }
            ].map((item, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-main, #18171c)' }}>{item.label}</span>
                  <span style={{ fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: item.color }}>
                    {item.pct}%
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${item.pct}%`, height: '100%', background: item.color, borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #716e7d)', marginTop: 2 }}>
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Executive Action Directives */}
        <div
          style={{
            background: 'var(--bg-card, rgba(255, 255, 255, 0.75))',
            backdropFilter: 'blur(16px)',
            borderRadius: 24,
            padding: '24px',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.8))',
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
                  Executive Directives & AI Recommendations
                </h3>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #716e7d)' }}>
                  Actionable decisions calculated from today's telemetry
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: 'rgba(124, 58, 237, 0.06)',
                  border: '1px solid rgba(124, 58, 237, 0.15)'
                }}
              >
                <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#5b21b6' }}>
                  Enable Auto-Modifier Ingestion for BCBS &amp; UHC
                </div>
                <div style={{ fontSize: '0.75rem', color: '#4c1d95', marginTop: 3 }}>
                  Estimated to eliminate <strong>3.8 hours/day</strong> of Excel cross-referencing across Team Alpha &amp; Beta.
                </div>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: 'rgba(16, 185, 129, 0.06)',
                  border: '1px solid rgba(16, 185, 129, 0.15)'
                }}
              >
                <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#065f46' }}>
                  Deploy Denial Scripting Co-Pilot to Team Beta
                </div>
                <div style={{ fontSize: '0.75rem', color: '#047857', marginTop: 3 }}>
                  Team Beta AHT (6.3m) can be compressed to sub-5.5m by matching Team Alpha's co-pilot adoption.
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              paddingTop: 14,
              borderTop: '1px solid var(--border-subtle, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--text-muted, #716e7d)'
            }}
          >
            <span>Projected Monthly Savings: <strong>$42,800</strong></span>
            <span style={{ color: '#059669', fontWeight: 700 }}>+18.4% ROI</span>
          </div>
        </div>
      </div>
    </div>
  )
}

