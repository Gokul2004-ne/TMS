import React from 'react'
import { CONFIG } from '../config'

interface NvaBadgeProps {
  flag: string
}

export const NvaBadge: React.FC<NvaBadgeProps> = ({ flag }) => {
  const conf = CONFIG.NVA_CONFIG[flag] || {
    label: flag,
    color: '#334155',
    bg: '#f1f5f9'
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: '0.6875rem',
      fontWeight: 700,
      padding: '2px 6px',
      color: conf.color,
      backgroundColor: conf.bg,
      border: `1px solid ${conf.color}40`,
      letterSpacing: '0.02em',
      textTransform: 'uppercase'
    }}>
      <span style={{ width: 5, height: 5, background: conf.color }} />
      {conf.label}
    </span>
  )
}
