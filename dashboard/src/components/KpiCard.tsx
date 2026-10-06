import React from 'react'

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
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
  icon,
  trend,
  badge,
  accentColor = 'var(--accent-cyan)'
}) => {
  return (
    <div className="glass-card" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Subtle accent glow line at top */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: `linear-gradient(90deg, ${accentColor} 0%, transparent 100%)`
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="text-sub" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.75rem' }}>
          {title}
        </span>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'rgba(255, 255, 255, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: accentColor
        }}>
          {icon}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
          {value}
        </span>
        {badge && (
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 6,
            background: 'rgba(56, 189, 248, 0.12)',
            color: 'var(--accent-cyan)'
          }}>
            {badge}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {subtitle && (
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
            {subtitle}
          </span>
        )}
        {trend && (
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: trend.isPositive ? 'var(--accent-emerald)' : 'var(--accent-rose)'
          }}>
            {trend.value}
          </span>
        )}
      </div>
    </div>
  )
}
