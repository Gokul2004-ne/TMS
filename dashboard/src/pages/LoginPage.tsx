import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ShieldCheck,
  User,
  Users,
  Compass,
  ArrowRight,
  Lock,
  KeyRound,
  AlertCircle
} from 'lucide-react'
import { useAuth, UserRole } from '../context/AuthContext'

interface LoginPageProps {
  onSuccess?: () => void
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const { login } = useAuth()
  const [selectedRole, setSelectedRole] = useState<UserRole>('employee')
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role)
    setErrorMessage(null)
  }

  const handleStandardSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId.trim()) {
      setErrorMessage('Please enter your User ID')
      return
    }
    if (!password.trim()) {
      setErrorMessage('Please enter your Password')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      const ok = await login(userId.trim().toUpperCase(), selectedRole, password)
      if (ok) {
        if (onSuccess) onSuccess()
      } else {
        setErrorMessage('Authentication failed. Please verify your credentials.')
      }
    } catch {
      setErrorMessage('Network or server error. Please try again.')
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
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b' }}>
          Systems Active
        </span>
      </motion.div>

      {/* Main Glassmorphic Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 28,
          padding: '36px 32px',
          boxShadow: '0 20px 50px rgba(79, 70, 229, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.9)',
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
            Accounts Receivable &amp; Transaction Intelligence Platform
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

        {/* Error notification if any */}
        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 12,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '0.8125rem',
              marginBottom: 16
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleStandardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
              User ID
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={userId}
                onChange={e => setUserId(e.target.value.toUpperCase())}
                placeholder="Enter your User ID"
                required
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 38px',
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
                placeholder="Enter your password"
                required
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 38px',
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
              marginTop: 8,
              width: '100%',
              padding: '13px 16px',
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
            <span>{isSubmitting ? 'Authenticating...' : `Sign In to ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Portal`}</span>
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
