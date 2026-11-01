import React from 'react'
import { motion } from 'framer-motion'
import {
  User,
  Users,
  Compass,
  Activity,
  Layers,
  Sparkles,
  PieChart,
  ShieldCheck
} from 'lucide-react'
import { UserRole } from '../context/AuthContext'

interface FloatingSidebarProps {
  currentView: 'associate' | 'supervisor' | 'leader' | 'claim'
  setCurrentView: (v: 'associate' | 'supervisor' | 'leader' | 'claim') => void
  userRole?: UserRole
  onOpenSimulation?: () => void
}

export const FloatingSidebar: React.FC<FloatingSidebarProps> = ({
  currentView,
  setCurrentView,
  userRole,
  onOpenSimulation
}) => {
  const navItems = [
    {
      id: 'associate' as const,
      label: 'Associate Workspace',
      shortLabel: 'Desk',
      icon: <User size={18} />
    },
    {
      id: 'supervisor' as const,
      label: 'Supervisor Oversight',
      shortLabel: 'Team',
      icon: <Users size={18} />
    },
    {
      id: 'leader' as const,
      label: 'Leader Executive',
      shortLabel: 'Exec',
      icon: <PieChart size={18} />
    },
    {
      id: 'claim' as const,
      label: 'Claim Deep Dive',
      shortLabel: 'Audit',
      icon: <Compass size={18} />
    }
  ]

  return (
    <motion.aside
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'fixed',
        left: 20,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '12px 8px',
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 24,
        border: '1px solid rgba(255, 255, 255, 0.9)',
        boxShadow: '0 12px 35px -8px rgba(76, 29, 149, 0.15), 0 4px 12px rgba(0, 0, 0, 0.05)'
      }}
    >
      {/* Brand Mini Mark */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 14,
          background: 'linear-gradient(135deg, #18171c 0%, #312e38 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          marginBottom: 6,
          boxShadow: '0 4px 12px rgba(24, 23, 28, 0.2)'
        }}
        title="NovaArc TMS Navigation"
      >
        <ShieldCheck size={20} />
      </div>

      <div style={{ width: 24, height: 1, background: 'rgba(216, 208, 247, 0.8)', margin: '2px 0 6px 0' }} />

      {/* Nav Buttons */}
      {navItems.map(item => {
        const isActive = currentView === item.id
        return (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            title={item.label}
            style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              border: 'none',
              background: isActive ? '#18171c' : 'transparent',
              color: isActive ? '#ffffff' : '#5b5866',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              position: 'relative'
            }}
            onMouseEnter={e => {
              if (!isActive) {
                e.currentTarget.style.background = 'rgba(238, 234, 250, 0.85)'
                e.currentTarget.style.color = '#18171c'
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#5b5866'
              }
            }}
          >
            {item.icon}
            <span
              style={{
                fontSize: '0.5625rem',
                fontWeight: 700,
                marginTop: 2,
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              {item.shortLabel}
            </span>

            {/* Active glowing indicator pill */}
            {isActive && (
              <motion.div
                layoutId="activeSidebarIndicator"
                style={{
                  position: 'absolute',
                  right: -4,
                  width: 4,
                  height: 18,
                  borderRadius: 2,
                  background: '#7c3aed'
                }}
              />
            )}
          </button>
        )
      })}

      {/* Optional Simulation Launcher Button */}
      {onOpenSimulation && (
        <>
          <div style={{ width: 24, height: 1, background: 'rgba(216, 208, 247, 0.8)', margin: '6px 0 2px 0' }} />
          <button
            onClick={onOpenSimulation}
            title="Launch Real-Time Claim Simulation"
            style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              border: 'none',
              background: 'linear-gradient(135deg, #ede9fe 0%, #f3e8ff 100%)',
              color: '#7c3aed',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(124, 58, 237, 0.15)'
            }}
          >
            <Activity size={16} />
            <span style={{ fontSize: '0.5625rem', fontWeight: 800, marginTop: 2 }}>SIM</span>
          </button>
        </>
      )}
    </motion.aside>
  )
}

