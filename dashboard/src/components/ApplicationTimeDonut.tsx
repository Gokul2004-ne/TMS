import React, { useState, useMemo } from 'react'

export interface AppBreakdownItem {
  app_name: string
  duration_seconds: number
  percentage: number
  color?: string
}

interface ApplicationTimeDonutProps {
  items: AppBreakdownItem[]
  activeClaimId?: string
  width?: number
  height?: number
}

// Curated high-contrast executive analytical palette matching user reference image
const DISTINCT_COLORS = [
  '#2563eb', // Royal Blue
  '#f97316', // Vibrant Orange
  '#64748b', // Slate Neutral
  '#eab308', // Warm Amber
  '#0ea5e9', // Sky Blue
  '#16a34a', // Emerald Green
  '#8b5cf6', // Violet
  '#ec4899', // Magenta Pink
  '#0d9488', // Teal
  '#f43f5e', // Rose Red
  '#6366f1', // Indigo
  '#84cc16', // Lime
  '#d97706', // Ochre
  '#0284c7', // Cerulean
  '#a855f7', // Purple
  '#059669', // Forest Green
  '#334155', // Navy Slate
  '#dc2626', // Crimson
  '#ca8a04', // Gold
  '#4f46e5', // Deep Indigo
]

function getAppColor(appName: string, index: number, overrideColor?: string): string {
  if (overrideColor && overrideColor !== '#6b7280' && overrideColor !== '#9ca3af') {
    return overrideColor
  }
  // Deterministic mapping by index / name hash
  return DISTINCT_COLORS[index % DISTINCT_COLORS.length]
}

function formatMinutes(seconds: number): string {
  const mins = Math.round(seconds / 60)
  if (mins <= 1 && seconds < 60) {
    return `${Math.max(1, seconds)} seconds`
  }
  return mins === 1 ? '1 minute' : `${mins} minutes`
}

export const ApplicationTimeDonut: React.FC<ApplicationTimeDonutProps> = ({
  items,
  activeClaimId = 'CLM1003',
  width = 280,
  height = 280
}) => {
  const [hoveredApp, setHoveredApp] = useState<AppBreakdownItem | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)

  const validItems = useMemo(() => {
    const list = (items || []).filter(item => item.duration_seconds > 0 || item.percentage > 0)
    if (list.length === 0) {
      return [{
        app_name: 'NovaArc RCM',
        duration_seconds: 60,
        percentage: 100,
        color: '#2563eb'
      }]
    }
    return list
  }, [items])

  const totalDuration = useMemo(() => {
    return validItems.reduce((acc, curr) => acc + curr.duration_seconds, 0)
  }, [validItems])

  // Donut geometry constants
  const cx = width / 2
  const cy = height / 2
  const outerR = 112
  const innerR = 68
  const hoveredOuterR = 120

  // Calculate slice angles (starting from -90 deg / top)
  const slices = useMemo(() => {
    let currentAngle = -Math.PI / 2

    return validItems.map((item, idx) => {
      const share = totalDuration > 0
        ? (item.duration_seconds / totalDuration)
        : (item.percentage / 100)

      const sliceAngle = Math.max(share * 2 * Math.PI, 0.001)
      const startAngle = currentAngle
      const endAngle = currentAngle + sliceAngle
      currentAngle = endAngle

      const color = getAppColor(item.app_name, idx, item.color)

      return {
        item,
        startAngle,
        endAngle,
        color,
        share
      }
    })
  }, [validItems, totalDuration])

  // Helper to create donut arc SVG path string
  const createArcPath = (start: number, end: number, rOut: number, rIn: number) => {
    // If slice covers virtually the full 360 deg, split slightly to prevent SVG arc degenerate zero-point
    const span = end - start
    const isFull = span >= 2 * Math.PI - 0.001

    if (isFull) {
      const mid = start + Math.PI
      const x1 = cx + rOut * Math.cos(start)
      const y1 = cy + rOut * Math.sin(start)
      const xMidOut = cx + rOut * Math.cos(mid)
      const yMidOut = cy + rOut * Math.sin(mid)
      const xMidIn = cx + rIn * Math.cos(mid)
      const yMidIn = cy + rIn * Math.sin(mid)
      const x4 = cx + rIn * Math.cos(start)
      const y4 = cy + rIn * Math.sin(start)

      return `
        M ${x1} ${y1}
        A ${rOut} ${rOut} 0 0 1 ${xMidOut} ${yMidOut}
        A ${rOut} ${rOut} 0 0 1 ${x1} ${y1}
        M ${x4} ${y4}
        A ${rIn} ${rIn} 0 0 0 ${xMidIn} ${yMidIn}
        A ${rIn} ${rIn} 0 0 0 ${x4} ${y4}
        Z
      `
    }

    const largeArcFlag = span > Math.PI ? 1 : 0

    const x1 = cx + rOut * Math.cos(start)
    const y1 = cy + rOut * Math.sin(start)
    const x2 = cx + rOut * Math.cos(end)
    const y2 = cy + rOut * Math.sin(end)

    const x3 = cx + rIn * Math.cos(end)
    const y3 = cy + rIn * Math.sin(end)
    const x4 = cx + rIn * Math.cos(start)
    const y4 = cy + rIn * Math.sin(start)

    return `
      M ${x1} ${y1}
      A ${rOut} ${rOut} 0 ${largeArcFlag} 1 ${x2} ${y2}
      L ${x3} ${y3}
      A ${rIn} ${rIn} 0 ${largeArcFlag} 0 ${x4} ${y4}
      Z
    `
  }

  const displayClaimId = activeClaimId && activeClaimId !== 'UNASSIGNED' ? activeClaimId : 'NO CLAIM'

  return (
    <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Donut Chart Container */}
      <div
        style={{ position: 'relative', width, height }}
        onMouseLeave={() => {
          setHoveredApp(null)
          setMousePos(null)
        }}
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ overflow: 'visible', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.06))' }}
        >
          {/* Slices */}
          {slices.map((slice, i) => {
            const isHovered = hoveredApp?.app_name === slice.item.app_name
            const rOut = isHovered ? hoveredOuterR : outerR
            const d = createArcPath(slice.startAngle, slice.endAngle, rOut, innerR)

            return (
              <path
                key={i}
                d={d}
                fill={slice.color}
                stroke="#ffffff"
                strokeWidth={2}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-out',
                  opacity: hoveredApp && !isHovered ? 0.75 : 1
                }}
                onMouseEnter={(e) => {
                  setHoveredApp(slice.item)
                  const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
                  if (rect) {
                    setMousePos({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top
                    })
                  }
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
                  if (rect) {
                    setMousePos({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top
                    })
                  }
                }}
              />
            )
          })}

          {/* Hollow Center Circle */}
          <circle
            cx={cx}
            cy={cy}
            r={innerR - 1}
            fill="#ffffff"
            stroke="#f1f5f9"
            strokeWidth={1}
          />

          {/* Center Text: Claim ID Big & Clearly Visible */}
          <text
            x={cx}
            y={cy - 12}
            textAnchor="middle"
            fill="#64748b"
            style={{
              fontSize: '0.6875rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              userSelect: 'none'
            }}
          >
            ACTIVE CLAIM
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            fill="#0f172a"
            style={{
              fontSize: '1.25rem',
              fontWeight: 900,
              fontFamily: 'var(--font-mono, monospace)',
              letterSpacing: '-0.02em',
              userSelect: 'none'
            }}
          >
            {displayClaimId}
          </text>
        </svg>

        {/* Hover Tooltip: Shows App Name with time spent in brackets */}
        {hoveredApp && (
          <div
            style={{
              position: 'absolute',
              top: mousePos ? Math.max(8, mousePos.y - 42) : 10,
              left: mousePos ? Math.min(width - 40, Math.max(10, mousePos.x)) : width / 2,
              transform: 'translateX(-50%)',
              background: '#0f172a',
              color: '#ffffff',
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 30,
              border: '1px solid #334155',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}
          >
            {hoveredApp.app_name} ({formatMinutes(hoveredApp.duration_seconds)})
          </div>
        )}
      </div>

      {/* Analytical View Legend / Breakdown List */}
      <div style={{ width: '100%', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {validItems.map((app, idx) => {
          const color = getAppColor(app.app_name, idx, app.color)
          const isHovered = hoveredApp?.app_name === app.app_name

          return (
            <div
              key={idx}
              onMouseEnter={() => setHoveredApp(app)}
              onMouseLeave={() => setHoveredApp(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 10px',
                background: isHovered ? '#f1f5f9' : '#ffffff',
                border: isHovered ? '1px solid #0f172a' : '1px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.1s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 10, height: 10, background: color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>
                  {app.app_name}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  ({formatMinutes(app.duration_seconds)})
                </span>
              </div>
              <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0f172a' }}>
                {app.percentage}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
