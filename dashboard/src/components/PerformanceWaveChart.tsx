import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Clock, AlertTriangle, CheckCircle2, Target } from 'lucide-react'
import { ClaimTimelineItem } from '../api/types'

interface PerformanceWaveChartProps {
  claims: ClaimTimelineItem[]
  benchmarkMinutes?: number
  onSelectClaim?: (claimId: string) => void
}

export const PerformanceWaveChart: React.FC<PerformanceWaveChartProps> = ({
  claims,
  benchmarkMinutes = 6.5,
  onSelectClaim
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (claims.length === 0) {
    return (
      <div className="glass-card" style={{ borderRadius: 24, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main, #18171c)', margin: 0 }}>
              Performance Wave Trend
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #716e7d)' }}>
              Handle time vs target SLA ({benchmarkMinutes}m)
            </span>
          </div>
        </div>
        <div style={{
          height: 180,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          border: '1.5px dashed var(--border-subtle, #e2e8f0)',
          borderRadius: 16,
          background: 'rgba(255,255,255,0.4)',
          gap: 8
        }}>
          <Target size={24} color="#94a3b8" />
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main, #18171c)' }}>
            No Claims Processed Today
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #716e7d)', maxWidth: 280 }}>
            Active claim handle times and SLA benchmark curves will appear here as you work.
          </div>
        </div>
      </div>
    )
  }

  const dataPoints = claims.slice(-10).map((c, i) => ({
    id: c.claim_id,
    durationMinutes: Math.max(1.2, +(c.total_duration_seconds / 60).toFixed(1)),
    isNva: c.nva_flags.length > 0,
    status: c.status,
    flags: c.nva_flags,
    label: `C${i + 1}`
  }))

  const maxVal = Math.max(...dataPoints.map(d => d.durationMinutes), benchmarkMinutes + 2)
  const minVal = Math.min(...dataPoints.map(d => d.durationMinutes), 2)

  // SVG dimensions
  const svgWidth = 600
  const svgHeight = 180
  const paddingX = 40
  const paddingY = 30
  const chartWidth = svgWidth - paddingX * 2
  const chartHeight = svgHeight - paddingY * 2

  const getX = (idx: number) => {
    if (dataPoints.length <= 1) return paddingX + chartWidth / 2
    return paddingX + (idx / (dataPoints.length - 1)) * chartWidth
  }

  const getY = (val: number) => {
    const norm = (val - minVal) / (maxVal - minVal || 1)
    return svgHeight - paddingY - norm * chartHeight
  }

  // Build smooth bezier path
  const points = dataPoints.map((d, i) => ({ x: getX(i), y: getY(d.durationMinutes) }))

  let pathD = ''
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i]
      const p1 = points[i + 1]
      const cx = (p0.x + p1.x) / 2
      pathD += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`
    }
  }

  const areaD = pathD
    ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
    : ''

  const benchmarkY = getY(benchmarkMinutes)

  // Metrics
  const avgDuration = (dataPoints.reduce((acc, d) => acc + d.durationMinutes, 0) / (dataPoints.length || 1)).toFixed(1)
  const bestDuration = Math.min(...dataPoints.map(d => d.durationMinutes)).toFixed(1)
  const withinBenchmarkCount = dataPoints.filter(d => d.durationMinutes <= benchmarkMinutes).length
  const complianceRate = Math.round((withinBenchmarkCount / (dataPoints.length || 1)) * 100)

  return (
    <div
      style={{
        background: 'var(--bg-card, rgba(255, 255, 255, 0.75))',
        backdropFilter: 'blur(16px)',
        borderRadius: 24,
        padding: '24px',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.8))',
        boxShadow: 'var(--shadow-md, 0 10px 25px -5px rgba(0, 0, 0, 0.05))',
        position: 'relative'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background: 'var(--accent-tint, rgba(124, 58, 237, 0.1))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary, #7c3aed)'
            }}
          >
            <TrendingUp size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main, #18171c)' }}>
              Handle Time Performance Wave
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #716e7d)' }}>
              Real-time claim cycle velocity vs 6.5m SLA benchmark
            </span>
          </div>
        </div>

        {/* Quick stat pill badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              padding: '4px 10px',
              borderRadius: 9999,
              background: complianceRate >= 75 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
              border: `1px solid ${complianceRate >= 75 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: complianceRate >= 75 ? '#059669' : '#d97706',
              display: 'flex',
              alignItems: 'center',
              gap: 5
            }}
          >
            <Target size={12} />
            <span>{complianceRate}% Under SLA</span>
          </div>
        </div>
      </div>

      {/* SVG Wave Chart Container */}
      <div style={{ width: '100%', overflowX: 'auto', position: 'relative' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: '100%', height: 'auto', minWidth: 380, display: 'block' }}
        >
          <defs>
            <linearGradient id="waveGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.32" />
              <stop offset="85%" stopColor="#7c3aed" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#7c3aed" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* SLA Benchmark Reference Line */}
          <line
            x1={paddingX}
            y1={benchmarkY}
            x2={svgWidth - paddingX}
            y2={benchmarkY}
            stroke="#ef4444"
            strokeDasharray="4 4"
            strokeWidth="1.5"
            opacity="0.7"
          />
          <text
            x={svgWidth - paddingX - 4}
            y={benchmarkY - 6}
            textAnchor="end"
            fontSize="9"
            fontWeight="700"
            fill="#ef4444"
            fontFamily="'JetBrains Mono', monospace"
          >
            SLA Target {benchmarkMinutes}m
          </text>

          {/* Area Fill */}
          {areaD && <path d={areaD} fill="url(#waveGradient)" />}

          {/* Wave Line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="var(--accent-primary, #7c3aed)"
              strokeWidth="2.75"
              strokeLinecap="round"
              filter="url(#glow)"
            />
          )}

          {/* Data Points */}
          {dataPoints.map((dp, idx) => {
            const x = getX(idx)
            const y = getY(dp.durationMinutes)
            const isHovered = hoveredIndex === idx
            const isNva = dp.isNva

            return (
              <g
                key={dp.id}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => onSelectClaim && onSelectClaim(dp.id)}
              >
                {/* Outer ring */}
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 7 : isNva ? 5.5 : 4.5}
                  fill={isNva ? '#ef4444' : '#ffffff'}
                  stroke={isNva ? '#dc2626' : 'var(--accent-primary, #7c3aed)'}
                  strokeWidth={isHovered ? 3 : 2}
                  style={{ transition: 'all 0.15s ease' }}
                />

                {/* X axis claim label */}
                <text
                  x={x}
                  y={svgHeight - 10}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight={isHovered ? '800' : '600'}
                  fill={isHovered ? '#18171c' : '#716e7d'}
                  fontFamily="'JetBrains Mono', monospace"
                >
                  {dp.id.replace('CLM-', '#')}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredIndex !== null && dataPoints[hoveredIndex] && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              position: 'absolute',
              top: 8,
              right: 12,
              background: '#18171c',
              color: '#ffffff',
              padding: '8px 14px',
              borderRadius: 12,
              fontSize: '0.75rem',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              pointerEvents: 'none',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#c4b5fd' }}>
                {dataPoints[hoveredIndex].id}
              </div>
              <div style={{ color: '#a1a1aa', fontSize: '0.6875rem' }}>
                Duration: <strong style={{ color: '#fff' }}>{dataPoints[hoveredIndex].durationMinutes}m</strong>
              </div>
            </div>
            {dataPoints[hoveredIndex].isNva && (
              <span
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: 6,
                  fontSize: '0.625rem',
                  fontWeight: 700
                }}
              >
                NVA FLAGGED
              </span>
            )}
          </motion.div>
        )}
      </div>

      {/* Summary Footer */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginTop: 14,
          paddingTop: 14,
          borderTop: '1px solid var(--border-subtle, rgba(0,0,0,0.06))'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #716e7d)', textTransform: 'uppercase', fontWeight: 600 }}>
            Average Handle Time
          </div>
          <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-main, #18171c)', fontFamily: "'JetBrains Mono', monospace" }}>
            {avgDuration}m
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #716e7d)', textTransform: 'uppercase', fontWeight: 600 }}>
            Fastest Resolution
          </div>
          <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#059669', fontFamily: "'JetBrains Mono', monospace" }}>
            {bestDuration}m
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #716e7d)', textTransform: 'uppercase', fontWeight: 600 }}>
            Under SLA (&lt;6.5m)
          </div>
          <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--accent-primary, #7c3aed)', fontFamily: "'JetBrains Mono', monospace" }}>
            {withinBenchmarkCount}/{dataPoints.length}
          </div>
        </div>
      </div>
    </div>
  )
}

