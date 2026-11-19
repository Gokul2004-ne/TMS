import React from 'react'
import { motion } from 'framer-motion'
import { Zap, Target, Award } from 'lucide-react'

interface SpeedometerGaugeProps {
  score: number // 0 to 100
  targetScore?: number
  label?: string
  sublabel?: string
}

export const SpeedometerGauge: React.FC<SpeedometerGaugeProps> = ({
  score = 88,
  targetScore = 85,
  label = 'Productive Effort Score',
  sublabel = 'Active clinical & billing touch time ratio'
}) => {
  // Clamp score
  const safeScore = Math.min(100, Math.max(0, score))

  // Arc calculation for semi-circle gauge (180 degrees)
  // Radius = 80, Center = (100, 100)
  const radius = 70
  const circumference = Math.PI * radius // ~219.9
  const strokeDashoffset = circumference - (safeScore / 100) * circumference

  // Color determination
  const getColor = (s: number) => {
    if (s >= 80) return { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.15)', text: '#059669', badge: 'Optimal Zone' }
    if (s >= 65) return { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.15)', text: '#d97706', badge: 'Moderate Zone' }
    return { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.15)', text: '#dc2626', badge: 'Attention Needed' }
  }

  const { stroke, fill, text, badge } = getColor(safeScore)

  // Angle in degrees for needle: from -180 (left) to 0 (right)
  const angle = -180 + (safeScore / 100) * 180

  return (
    <div
      style={{
        background: 'var(--bg-card, rgba(255, 255, 255, 0.75))',
        backdropFilter: 'blur(16px)',
        borderRadius: 24,
        padding: '24px',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.8))',
        boxShadow: 'var(--shadow-md, 0 10px 25px -5px rgba(0, 0, 0, 0.05))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative'
      }}
    >
      {/* Top Header */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'var(--accent-tint, rgba(124, 58, 237, 0.1))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary, #7c3aed)'
            }}
          >
            <Zap size={16} />
          </div>
          <span style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-main, #18171c)' }}>
            {label}
          </span>
        </div>

        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 9999,
            background: fill,
            color: text,
            letterSpacing: '0.02em'
          }}
        >
          {badge}
        </span>
      </div>

      {/* Speedometer SVG */}
      <div style={{ position: 'relative', width: 200, height: 115, marginTop: 10 }}>
        <svg viewBox="0 0 200 120" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {/* Background Track Arc */}
          <path
            d="M 30 100 A 70 70 0 0 1 170 100"
            fill="none"
            stroke="rgba(0, 0, 0, 0.08)"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Active Value Arc */}
          <path
            d="M 30 100 A 70 70 0 0 1 170 100"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />

          {/* Center Hub */}
          <circle cx="100" cy="100" r="6" fill="#18171c" />
        </svg>

        {/* Center Digital Reading */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              fontSize: '1.875rem',
              fontWeight: 800,
              color: 'var(--text-main, #18171c)',
              fontFamily: "'JetBrains Mono', monospace",
              lineHeight: 1
            }}
          >
            {safeScore}%
          </div>
          <div
            style={{
              fontSize: '0.6875rem',
              color: 'var(--text-muted, #716e7d)',
              fontWeight: 600,
              marginTop: 4
            }}
          >
            Target: {targetScore}%
          </div>
        </div>
      </div>

      {/* Sublabel / Comparison */}
      <div
        style={{
          fontSize: '0.75rem',
          color: 'var(--text-muted, #716e7d)',
          textAlign: 'center',
          marginTop: 10
        }}
      >
        {sublabel}
      </div>
    </div>
  )
}

