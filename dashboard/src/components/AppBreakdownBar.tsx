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
  height = 12
}) => {
  if (!items || items.length === 0) {
    return (
      <div style={{ height, background: '#f1f5f9', border: '1px solid #e2e8f0' }} />
    )
  }

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60)
    return mins > 0 ? `${mins}m` : `${sec}s`
  }

  return (
    <div>
      {/* Horizontal Stacked Bar with Sharp Edges */}
      <div style={{
        display: 'flex',
        height,
        background: '#f1f5f9',
        border: '1px solid #cbd5e1',
        width: '100%'
      }}>
        {items.map((it, idx) => {
          const color = it.color || CONFIG.APP_COLORS[it.app_name] || '#475569'
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

      {/* Legend */}
      {showLegend && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          marginTop: 10
        }}>
          {items.map((it, idx) => {
            const color = it.color || CONFIG.APP_COLORS[it.app_name] || '#475569'
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
                <span style={{ width: 8, height: 8, background: color }} />
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
