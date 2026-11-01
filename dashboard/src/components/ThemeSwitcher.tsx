import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Flame } from 'lucide-react'

export type ThemeMode = 'fluenta' | 'ember'

interface ThemeSwitcherProps {
  theme: ThemeMode
  onToggleTheme: () => void
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ theme, onToggleTheme }) => {
  const isFluenta = theme === 'fluenta'

  return (
    <motion.button
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      onClick={onToggleTheme}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 18px',
        background: isFluenta ? '#18171c' : '#222023',
        color: '#ffffff',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 9999,
        cursor: 'pointer',
        boxShadow: isFluenta
          ? '0 10px 25px -3px rgba(124, 58, 237, 0.35), 0 4px 12px rgba(0,0,0,0.2)'
          : '0 10px 25px -3px rgba(224, 116, 70, 0.35), 0 4px 12px rgba(0,0,0,0.2)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: '0.8125rem',
        fontWeight: 700,
        transition: 'background 0.25s ease, box-shadow 0.25s ease'
      }}
      title={`Switch theme: Current is ${isFluenta ? 'Fluenta (Lilac Pastel)' : 'Ember (Warm Greige)'}`}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: isFluenta
            ? 'linear-gradient(135deg, #c2bcec 0%, #7c3aed 100%)'
            : 'linear-gradient(135deg, #f59e0b 0%, #e07446 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff'
        }}
      >
        {isFluenta ? <Sparkles size={13} /> : <Flame size={13} />}
      </div>

      <span style={{ letterSpacing: '0.02em' }}>
        {isFluenta ? 'Fluenta Theme' : 'Ember Theme'}
      </span>

      <span
        style={{
          fontSize: '0.625rem',
          padding: '2px 6px',
          borderRadius: 9999,
          background: 'rgba(255, 255, 255, 0.18)',
          color: '#ffffff',
          fontWeight: 700,
          textTransform: 'uppercase'
        }}
      >
        {isFluenta ? 'Lilac' : 'Warm'}
      </span>
    </motion.button>
  )
}

