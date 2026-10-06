import React from 'react'
import { AppBreakdown } from '../api/types'
import { CONFIG } from '../config'

interface AppBreakdownBarProps {
  items: AppBreakdown[]
  showLegend?: boolean
  height?: number
}

export const AppBreakdownBar: React.FC<AppBreakdownBarProps> = ({
  items,
  showLegend = true,
  height = 10
}) => {
  if (!items || items.length === 0) {
    return (
      <div style={{ height, background: 'rgba(255, 255, 255, 0.05)', borderRadius: height / 2 }} />
    )
  }

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60)
    return mins > 0 ? `${mins}m` : `${sec}s`
  }

  return (
    <div>
      {/* Horizontal Stacked Bar */}
      <div style={{
        display: 'flex',
        height,
        borderRadius: height / 2,
        overflow: 'hidden',
        background: 'rgba(255, 255, 255, 0.05)',
        width: '100%',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)'
      }}>
        {items.map((it, idx) => {
          const color = it.color || CONFIG.APP_COLORS[it.app_name] || '#94a3b8'
          return (
            <div
              key={idx}
              style={{
                width: `${it.percentage}%`,
                background: color,
                transition: 'width 0.3s ease'
              }}
              title={`${it.app_name}: ${it.percentage}% (${formatDuration(it.duration_seconds)})`}
            />
          )
        })}
      </div>

      {/* Optional Legend */}
      {showLegend && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          marginTop: 12
        }}>
          {items.map((it, idx) => {
            const color = it.color || CONFIG.APP_COLORS[it.app_name] || '#94a3b8'
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{it.app_name}</span>
                <span style={{ color: 'var(--text-dim)' }}>{it.percentage}%</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
