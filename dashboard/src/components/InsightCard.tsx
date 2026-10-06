import React from 'react'
import { AlertTriangle, Clock, Layers, Sparkles, CheckCircle2 } from 'lucide-react'
import { InsightCard as InsightCardType } from '../api/types'

interface InsightCardProps {
  insight: InsightCardType
}

export const InsightCard: React.FC<InsightCardProps> = ({ insight }) => {
  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case 'HIGH':
        return { color: 'var(--accent-rose)', bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.3)' }
      case 'MEDIUM':
        return { color: 'var(--accent-amber)', bg: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.3)' }
      default:
        return { color: 'var(--accent-cyan)', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.3)' }
    }
  }

  const sevStyle = getSeverityStyle(insight.severity)

  return (
    <div className="glass-card" style={{
      borderLeft: `4px solid ${sevStyle.color}`,
      background: 'rgba(15, 23, 42, 0.65)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: '0.6875rem',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: 6,
            background: sevStyle.bg,
            color: sevStyle.color,
            border: `1px solid ${sevStyle.border}`
          }}>
            {insight.severity} IMPACT
          </span>
          <span style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            {insight.category}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Layers size={13} color="var(--accent-indigo)" />
            <strong>{insight.impact_claim_count}</strong> claims
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={13} color="var(--accent-amber)" />
            <strong>~{insight.estimated_time_loss_mins}m</strong> loss
          </span>
        </div>
      </div>

      {/* Title & Description */}
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
        {insight.title}
      </h3>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
        {insight.description}
      </p>

      {/* Tactical Recommendation Box */}
      <div style={{
        background: 'rgba(56, 189, 248, 0.05)',
        border: '1px solid rgba(56, 189, 248, 0.15)',
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: 'var(--accent-cyan)', fontSize: '0.75rem', fontWeight: 700 }}>
          <Sparkles size={14} />
          <span>RECOMMENDED ACTION</span>
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-main)', fontWeight: 500 }}>
          {insight.recommendation}
        </div>
      </div>

      {/* Evidence bullets */}
      {insight.evidence && insight.evidence.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {insight.evidence.map((ev, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              <span style={{ color: 'var(--accent-indigo)' }}>•</span>
              <span>{ev}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
