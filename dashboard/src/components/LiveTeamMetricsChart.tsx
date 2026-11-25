import React, { useState } from 'react'
import { Activity, Clock, TrendingUp, AlertCircle } from 'lucide-react'
import { AssociateOverviewItem } from '../api/types'

interface LiveTeamMetricsChartProps {
  associates: AssociateOverviewItem[]
  title?: string
  subtitle?: string
  slaTargetMinutes?: number
  onSelectAssociate?: (associateId: string) => void
}

/**
 * Real-time SVG telemetry chart plotting live Associate AHT, Efficiency Index,
 * Idle %, and System Buffer across the workforce as data streams in asynchronously.
 */
export const LiveTeamMetricsChart: React.FC<LiveTeamMetricsChartProps> = ({
  associates,
  title = 'Live Workforce AHT & Efficiency Stream',
  subtitle = 'Real-time asynchronous comparison vs SLA benchmark',
  slaTargetMinutes = 9.0,
  onSelectAssociate
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [metricView, setMetricView] = useState<'EFFICIENCY' | 'AHT'>('EFFICIENCY')

  const items = (associates || [])
    .filter(a => a.status === 'ACTIVE' || a.completed_claims > 0 || (a.aht_minutes || 0) > 0)
    .slice(0, 10)

  const displayList = items.length > 0 ? items : (associates || []).slice(0, 8)

  if (displayList.length === 0) {
    return (
      <div
        style={{
          background: 'var(--bg-card, rgba(255, 255, 255, 0.78))',
          borderRadius: 20,
          padding: 24,
          border: '1px solid var(--border-subtle, #e2e8f0)',
          textAlign: 'center',
          color: 'var(--text-muted, #716e7d)',
          fontSize: '0.875rem'
        }}
      >
        Waiting for live team telemetry...
      </div>
    )
  }

  const maxAht = Math.max(...displayList.map(a => a.aht_minutes || 0), slaTargetMinutes + 2, 10)

  return (
    <div
      style={{
        background: 'var(--bg-card, rgba(255, 255, 255, 0.78))',
        backdropFilter: 'blur(16px)',
        borderRadius: 20,
        padding: 20,
        border: '1px solid var(--border-subtle, #e2e8f0)',
        boxShadow: 'var(--shadow-sm, 0 6px 20px rgba(0,0,0,0.04))',
        position: 'relative'
      }}
    >
      {/* Header & Metric Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'rgba(124, 58, 237, 0.1)',
              color: '#7c3aed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Activity size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
              {title}
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)' }}>{subtitle}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', padding: 3, borderRadius: 10 }}>
          <button
            type="button"
            onClick={() => setMetricView('EFFICIENCY')}
            style={{
              padding: '5px 10px',
              borderRadius: 7,
              border: 'none',
              background: metricView === 'EFFICIENCY' ? '#18171c' : 'transparent',
              color: metricView === 'EFFICIENCY' ? '#ffffff' : '#475569',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <TrendingUp size={12} />
            <span>Efficiency &amp; Idle</span>
          </button>
          <button
            type="button"
            onClick={() => setMetricView('AHT')}
            style={{
              padding: '5px 10px',
              borderRadius: 7,
              border: 'none',
              background: metricView === 'AHT' ? '#18171c' : 'transparent',
              color: metricView === 'AHT' ? '#ffffff' : '#475569',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Clock size={12} />
            <span>AHT vs {slaTargetMinutes}m SLA</span>
          </button>
        </div>
      </div>

      {/* Interactive Bar Stream */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {displayList.map((assoc, idx) => {
          const isActive = assoc.status === 'ACTIVE'
          const eff = Math.min(100, Math.max(0, assoc.efficiency_score || 0))
          const aht = assoc.aht_minutes || 0
          const idlePct = assoc.idle_percentage || 0
          const bufSec = assoc.system_buffer_seconds || 0
          const barPct = metricView === 'EFFICIENCY' ? eff : Math.min(100, Math.round((aht / maxAht) * 100))
          const barColor =
            metricView === 'EFFICIENCY'
              ? eff >= 90
                ? '#10b981'
                : eff >= 75
                  ? '#7c3aed'
                  : '#f59e0b'
              : aht <= slaTargetMinutes
                ? '#2563eb'
                : '#dc2626'

          const isHovered = hoveredIdx === idx

          return (
            <div
              key={assoc.associate_id}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => onSelectAssociate && onSelectAssociate(assoc.associate_id)}
              style={{
                cursor: onSelectAssociate ? 'pointer' : 'default',
                padding: '6px 8px',
                borderRadius: 10,
                background: isHovered ? 'rgba(124, 58, 237, 0.05)' : 'transparent',
                transition: 'background 0.12s ease'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  marginBottom: 4,
                  gap: 8
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: isActive ? '#10b981' : '#cbd5e1',
                      boxShadow: isActive ? '0 0 6px #10b981' : 'none',
                      flexShrink: 0
                    }}
                  />
                  <strong style={{ color: 'var(--text-main, #0f172a)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {assoc.associate_id}
                  </strong>
                  {assoc.current_claim_id && assoc.current_claim_id !== 'UNASSIGNED' && (
                    <span
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 6,
                        background: '#ecfdf5',
                        color: '#059669',
                        border: '1px solid #a7f3d0',
                        fontFamily: "'JetBrains Mono', monospace"
                      }}
                    >
                      {assoc.current_claim_id}
                    </span>
                  )}
                  <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                    {assoc.completed_claims} claims
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem' }}>
                  <span style={{ color: '#64748b' }}>AHT: <strong style={{ color: '#0f172a' }}>{aht}m</strong></span>
                  <span style={{ color: '#64748b' }}>Idle: <strong style={{ color: idlePct > 15 ? '#dc2626' : '#0f172a' }}>{idlePct}%</strong></span>
                  {bufSec > 0 && (
                    <span style={{ color: '#0891b2', fontWeight: 700 }}>
                      Buf: {Math.floor(bufSec / 60)}m {bufSec % 60}s
                    </span>
                  )}
                  <strong style={{ color: barColor, minWidth: 42, textAlign: 'right' }}>
                    {metricView === 'EFFICIENCY' ? `${eff}%` : `${aht}m`}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  position: 'relative',
                  height: 7,
                  borderRadius: 4,
                  background: '#e2e8f0',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    width: `${Math.max(3, barPct)}%`,
                    height: '100%',
                    background: barColor,
                    borderRadius: 4,
                    transition: 'width 0.35s ease'
                  }}
                />
                {metricView === 'AHT' && (
                  <div
                    title={`SLA Target ${slaTargetMinutes}m`}
                    style={{
                      position: 'absolute',
                      left: `${Math.min(98, (slaTargetMinutes / maxAht) * 100)}%`,
                      top: 0,
                      bottom: 0,
                      width: 2,
                      background: '#0f172a',
                      opacity: 0.7
                    }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          fontSize: '0.7rem',
          color: '#64748b'
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
          Live Active Agent
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <AlertCircle size={11} color="#0891b2" />
          System Buffer (&gt;10s load) tracked separately from AHT &amp; KPI
        </span>
      </div>
    </div>
  )
}
