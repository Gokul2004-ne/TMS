import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck,
  User,
  Users,
  Compass,
  ArrowRight,
  Lock,
  KeyRound,
  CheckCircle2,
  Sparkles,
  Zap,
  Building2,
  ExternalLink
} from 'lucide-react'
import { useAuth, UserRole, PRESET_USERS } from '../context/AuthContext'

interface LoginPageProps {
  onSuccess?: () => void
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const { login } = useAuth()
  const [selectedRole, setSelectedRole] = useState<UserRole>('employee')
  const [userId, setUserId] = useState('EMP101')
  const [password, setPassword] = useState('demo1234')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTabPreset, setActiveTabPreset] = useState<string>('EMP101')

  const rolePresets: Record<UserRole, string[]> = {
    employee: ['EMP101', 'EMP102', 'EMP103', 'EMP104'],
    manager: ['MGR101', 'MGR102'],
    leader: ['LEADER01']
  }

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role)
    const defaultUser = rolePresets[role][0]
    setActiveTabPreset(defaultUser)
    setUserId(defaultUser)
  }

  const handleSelectPreset = (id: string) => {
    setActiveTabPreset(id)
    setUserId(id)
  }

  const handleStandardSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId.trim()) return

    setIsSubmitting(true)
    try {
      await login(userId, selectedRole, password)
      if (onSuccess) onSuccess()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSsoDemoLogin = async (customId?: string) => {
    setIsSubmitting(true)
    const targetId = customId || activeTabPreset
    try {
      await login(targetId, selectedRole, 'demo1234')
      if (onSuccess) onSuccess()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: 'linear-gradient(135deg, #e4defa 0%, #ded7f8 40%, #d8d0f7 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Plus Jakarta Sans', sans-serif"
      }}
    >
      {/* Decorative ambient gradient orbs */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-5%',
          width: '45vw',
          height: '45vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(194, 188, 236, 0.45) 0%, rgba(222, 218, 245, 0) 70%)',
          pointerEvents: 'none',
          filter: 'blur(40px)',
          zIndex: 0
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-15%',
          right: '-5%',
          width: '50vw',
          height: '50vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(167, 139, 250, 0.25) 0%, rgba(216, 208, 247, 0) 70%)',
          pointerEvents: 'none',
          filter: 'blur(50px)',
          zIndex: 0
        }}
      />

      {/* Floating Top-Right "Systems Active" pill badge */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{
          position: 'absolute',
          top: 24,
          right: 28,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(12px)',
          borderRadius: 9999,
          border: '1px solid rgba(255, 255, 255, 0.9)',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)'
        }}
      >
        <span
          style={{
            position: 'relative',
            display: 'flex',
            width: 8,
            height: 8
          }}
        >
          <span
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: '#10b981',
              opacity: 0.75,
              animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
            }}
          />
          <span
            style={{
              position: 'relative',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#059669'
            }}
          />
        </span>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#065f46',
            letterSpacing: '0.04em',
            textTransform: 'uppercase'
          }}
        >
          Systems Active · v1.0 Live
        </span>
      </motion.div>

      {/* Main Glass Login Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'rgba(255, 255, 255, 0.82)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 24,
          padding: '36px 32px',
          border: '1px solid rgba(255, 255, 255, 0.9)',
          boxShadow: '0 20px 45px -10px rgba(76, 29, 149, 0.12), 0 8px 16px -6px rgba(0, 0, 0, 0.04)',
          position: 'relative',
          zIndex: 10
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #18171c 0%, #312e38 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
              boxShadow: '0 8px 18px rgba(24, 23, 28, 0.25)'
            }}
          >
            <ShieldCheck size={26} color="#ffffff" strokeWidth={2.2} />
          </div>

          <h1
            style={{
              fontSize: '1.625rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#18171c',
              margin: '0 0 6px 0'
            }}
          >
            NovaArc TMS
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              color: '#5b5866',
              margin: 0,
              fontWeight: 500
            }}
          >
            Accounts Receivable & Transaction Intelligence Platform
          </p>
        </div>

        {/* 3-Tab Role Selector */}
        <div
          style={{
            background: 'rgba(238, 234, 250, 0.8)',
            padding: 4,
            borderRadius: 14,
            display: 'flex',
            position: 'relative',
            marginBottom: 24,
            border: '1px solid rgba(216, 208, 247, 0.7)'
          }}
        >
          {(
            [
              { id: 'employee', label: 'Employee', icon: <User size={14} /> },
              { id: 'manager',  label: 'Manager',  icon: <Users size={14} /> },
              { id: 'leader',   label: 'Leader',   icon: <Compass size={14} /> }
            ] as const
          ).map(tab => {
            const isSelected = selectedRole === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleRoleChange(tab.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: 'none',
                  background: isSelected ? '#18171c' : 'transparent',
                  color: isSelected ? '#ffffff' : '#5b5866',
                  fontWeight: isSelected ? 700 : 600,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                  zIndex: 2
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* 1-Click SSO Demo Quick Login Banner */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => handleSsoDemoLogin()}
          style={{
            background: 'linear-gradient(135deg, #ede9fe 0%, #f3e8ff 100%)',
            border: '1px solid rgba(167, 139, 250, 0.45)',
            borderRadius: 16,
            padding: '14px 16px',
            marginBottom: 22,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0
              }}
            >
              <Zap size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#4c1d95', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>1-Click SSO Demo Login</span>
                <span style={{ fontSize: '0.625rem', padding: '1px 6px', background: '#7c3aed', color: '#fff', borderRadius: 9999 }}>FAST</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6d28d9', marginTop: 1 }}>
                Continue as <strong>{PRESET_USERS[activeTabPreset]?.name || activeTabPreset}</strong> ({selectedRole.toUpperCase()})
              </div>
            </div>
          </div>
          <ArrowRight size={16} color="#7c3aed" />
        </motion.div>

        {/* Preset Profiles Picker Chips */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#716e7d',
              marginBottom: 8
            }}
          >
            Quick Select Preset Profile
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {rolePresets[selectedRole].map(pid => {
              const u = PRESET_USERS[pid]
              const isSelected = activeTabPreset === pid
              return (
                <button
                  key={pid}
                  type="button"
                  onClick={() => handleSelectPreset(pid)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 9999,
                    border: isSelected ? '1.5px solid #18171c' : '1px solid rgba(216, 208, 247, 0.8)',
                    background: isSelected ? '#18171c' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#322f3b',
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 700,
                      opacity: isSelected ? 0.9 : 0.6
                    }}
                  >
                    {pid}
                  </span>
                  <span>{u?.name.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Standard Credentials Form */}
        <form onSubmit={handleStandardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#322f3b',
                marginBottom: 6
              }}
            >
              Employee ID
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={userId}
                onChange={e => setUserId(e.target.value.toUpperCase())}
                placeholder="e.g. EMP101"
                required
                style={{
                  width: '100%',
                  padding: '11px 14px 11px 36px',
                  borderRadius: 12,
                  border: '1.5px solid #d4cbf2',
                  background: '#ffffff',
                  fontSize: '0.875rem',
                  color: '#18171c',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease'
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#7c3aed')}
                onBlur={e => (e.currentTarget.style.borderColor = '#d4cbf2')}
              />
              <KeyRound
                size={16}
                color="#716e7d"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#322f3b',
                marginBottom: 6
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  padding: '11px 14px 11px 36px',
                  borderRadius: 12,
                  border: '1.5px solid #d4cbf2',
                  background: '#ffffff',
                  fontSize: '0.875rem',
                  color: '#18171c',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease'
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#7c3aed')}
                onBlur={e => (e.currentTarget.style.borderColor = '#d4cbf2')}
              />
              <Lock
                size={16}
                color="#716e7d"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              marginTop: 6,
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              border: 'none',
              background: '#18171c',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 6px 16px rgba(24, 23, 28, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <span>{isSubmitting ? 'Authenticating...' : `Enter ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Portal`}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        {/* Footer info */}
        <div
          style={{
            marginTop: 24,
            paddingTop: 18,
            borderTop: '1px solid rgba(216, 208, 247, 0.6)',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: '#716e7d'
          }}
        >
          Protected by Enterprise Zero-Trust · NovaArc RCM Engine
        </div>
      </motion.div>
    </div>
  )
}

