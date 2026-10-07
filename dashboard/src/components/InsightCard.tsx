import React from 'react'
import { Clock, Layers, Sparkles } from 'lucide-react'
import { InsightCard as InsightCardType } from '../api/types'

interface InsightCardProps {
  insight: InsightCardType
}

export const InsightCard: React.FC<InsightCardProps> = ({ insight }) => {
  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case 'HIGH':
        return { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' }
      case 'MEDIUM':
        return { color: '#b45309', bg: '#fffbeb', border: '#fde68a' }
      default:
        return { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' }
    }
  }

  const sevStyle = getSeverityStyle(insight.severity)

  return (
    <div className="glass-card" style={{
      borderLeft: `4px solid ${sevStyle.color}`,
      background: '#ffffff'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: '0.6875rem',
            fontWeight: 800,
            padding: '2px 6px',
            background: sevStyle.bg,
            color: sevStyle.color,
            border: `1px solid ${sevStyle.border}`
          }}>
            {insight.severity} IMPACT
          </span>
          <span style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            {insight.category}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Layers size={13} color="#4338ca" />
            <strong style={{ color: 'var(--text-main)' }}>{insight.impact_claim_count}</strong> claims
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={13} color="#b45309" />
            <strong style={{ color: 'var(--text-main)' }}>~{insight.estimated_time_loss_mins}m</strong> loss
          </span>
        </div>
      </div>

      {/* Title & Description */}
      <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 6 }}>
        {insight.title}
      </h3>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
        {insight.description}
      </p>

      {/* Tactical Recommendation Box */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        padding: '10px 12px',
        marginBottom: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: '#0f172a', fontSize: '0.6875rem', fontWeight: 800 }}>
          <Sparkles size={13} />
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
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span style={{ color: '#0f172a' }}>▪</span>
              <span>{ev}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
