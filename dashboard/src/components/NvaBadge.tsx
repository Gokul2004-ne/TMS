import React from 'react'
import { CONFIG } from '../config'

interface NvaBadgeProps {
  flag: string
}

export const NvaBadge: React.FC<NvaBadgeProps> = ({ flag }) => {
  const conf = CONFIG.NVA_CONFIG[flag] || {
    label: flag,
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.15)'
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: '0.6875rem',
      fontWeight: 700,
      padding: '2px 8px',
      borderRadius: 999,
      color: conf.color,
      backgroundColor: conf.bg,
      border: `1px solid ${conf.color}33`,
      letterSpacing: '0.02em',
      textTransform: 'uppercase'
    }}>
      ● {conf.label}
    </span>
  )
}
