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
  accentColor = '#0f172a'
}) => {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #ebebeb',
        padding: '18px 20px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
        cursor: 'default'
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = '#0f172a'
        el.style.transform = 'translateY(-1px)'
        el.style.boxShadow = '0 4px 12px rgba(15,23,42,.08)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = '#ebebeb'
        el.style.transform = 'translateY(0)'
        el.style.boxShadow = 'none'
      }}
    >
      {/* Top accent line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: accentColor
        }}
      />

      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 14
        }}
      >
        <span
          style={{
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            fontSize: '0.6875rem',
            color: '#64748b',
            lineHeight: 1.4,
            paddingTop: 2
          }}
        >
          {title}
        </span>
        <div
          style={{
            width: 34,
            height: 34,
            background: `${accentColor}12`,
            border: `1px solid ${accentColor}28`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accentColor,
            flexShrink: 0
          }}
        >
          {icon}
        </div>
      </div>

      {/* Value row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span
          style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            fontFeatureSettings: "'tnum' on"
          }}
        >
          {value}
        </span>
        {badge && (
          <span
            style={{
              fontSize: '0.625rem',
              fontWeight: 800,
              padding: '2px 7px',
              background: `${accentColor}12`,
              border: `1px solid ${accentColor}35`,
              color: accentColor,
              letterSpacing: '0.04em',
              textTransform: 'uppercase'
            }}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Footer row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.8125rem'
        }}
      >
        {subtitle && (
          <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>
            {subtitle}
          </span>
        )}
        {trend && (
          <span
            style={{
              fontWeight: 700,
              fontSize: '0.75rem',
              color: trend.isPositive ? '#059669' : '#dc2626',
              display: 'flex',
              alignItems: 'center',
              gap: 2
            }}
          >
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>

      {/* Subtle bottom rule that matches accent */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `${accentColor}18`
        }}
      />
    </div>
  )
}
