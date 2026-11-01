import React from 'react'

export interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  subtext?: string
  benchmark?: string
  status?: 'optimal' | 'warning' | 'alert' | string
  icon: React.ReactNode
  trend?: {
    value: string
    isPositive: boolean
  }
  badge?: string
  accentColor?: string
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  subtext,
  benchmark,
  status,
  icon,
  trend,
  badge,
  accentColor = '#7c3aed'
}) => {
  const displaySub = subtitle || subtext || benchmark

  const getStatusColor = () => {
    if (status === 'optimal') return '#059669'
    if (status === 'warning') return '#d97706'
    if (status === 'alert') return '#dc2626'
    return accentColor
  }

  return (
    <div
      className="kpi-card glass-card"
      style={{
        borderRadius: 20,
        padding: '20px 22px',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'default',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 12
      }}
    >
      {/* Top row: Label & Icon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--text-muted, #716e7d)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          {title}
        </span>

        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: 'var(--accent-tint, rgba(124, 58, 237, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: getStatusColor()
          }}
        >
          {icon}
        </div>
      </div>

      {/* Main value */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div
          style={{
            fontSize: '1.875rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            color: 'var(--text-main, #18171c)',
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)"
          }}
        >
          {value}
        </div>

        {badge && (
          <span
            style={{
              fontSize: '0.625rem',
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: 9999,
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#059669',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              letterSpacing: '0.03em'
            }}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Footer / Subtitle / Benchmark */}
      {displaySub && (
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted, #716e7d)',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span>{displaySub}</span>
          {trend && (
            <span
              style={{
                color: trend.isPositive ? '#059669' : '#dc2626',
                fontWeight: 700,
                fontSize: '0.6875rem'
              }}
            >
              {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
