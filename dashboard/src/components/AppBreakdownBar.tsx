import React from 'react'
import { AppBreakdown } from '../api/types'
import { CONFIG } from '../config'

interface AppBreakdownBarProps {
  items: AppBreakdown[]
  showLegend?: boolean
  height?: number
}

const VIBRANT_FALLBACKS = [
  '#2563eb', '#10b981', '#f97316', '#8b5cf6', '#ec4899',
  '#06b6d4', '#84cc16', '#f43f5e', '#6366f1', '#14b8a6',
  '#a855f7', '#0284c7', '#059669', '#d97706', '#dc2626'
]

function resolveColor(name: string, idx: number, color?: string): string {
  if (CONFIG.APP_COLORS[name]) return CONFIG.APP_COLORS[name]
  const isGrey = !color || ['#94a3b8', '#64748b', '#6b7280', '#9ca3af', '#334155', '#475569'].includes(color.toLowerCase())
  if (!isGrey) return color!
  let h = 0
  for (let i = 0; i < name.length; i++) h += name.charCodeAt(i) * (i + 1)
  return VIBRANT_FALLBACKS[(h + idx) % VIBRANT_FALLBACKS.length]
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
          const color = resolveColor(it.app_name, idx, it.color)
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
            const color = resolveColor(it.app_name, idx, it.color)
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
