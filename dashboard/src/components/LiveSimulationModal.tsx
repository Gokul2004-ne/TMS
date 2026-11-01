import React, { useState, useEffect, useRef } from 'react'
<<<<<<< HEAD
import {
  X,
  Play,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowRight,
  Download,
  Activity,
  Terminal,
  ExternalLink,
  ShieldCheck,
  Zap
} from 'lucide-react'
import { api } from '../api/client'
import { CONFIG } from '../config'
=======
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Activity,
  Layers,
  Sparkles,
  ArrowRight
} from 'lucide-react'
>>>>>>> ebecadb (frontend changed)

interface LiveSimulationModalProps {
  isOpen: boolean
  onClose: () => void
  associateId?: string
<<<<<<< HEAD
  onCompleteSimulation: () => void
}

interface SimulationStep {
  title: string
  app: string
  windowTitle: string
  durationSec: number
  description: string
  isNva?: boolean
  nvaReason?: string
}

const DEMO_SCENARIO: SimulationStep[] = [
  {
    title: '1. Associate Logged into NovaArc RCM',
    app: 'NovaArc RCM',
    windowTitle: 'NovaArc RCM - Active Worklist | Claim CLM-8821',
    durationSec: 4,
    description: 'Associate opened NovaArc portal. Agent detected claim CLM-8821 and triggered the desktop HUD.'
  },
  {
    title: '2. Reviewing Claim EOB & Adjudication Rules',
    app: 'NovaArc RCM',
    windowTitle: 'NovaArc RCM - Claim Adjudication | Patient: Robert Vance',
    durationSec: 6,
    description: 'Analyzing denial code PR-204 and cross-referencing patient coverage records.'
  },
  {
    title: '3. Cross-Checking Fee Schedule Table',
    app: 'Excel',
    windowTitle: 'Fee_Schedule_2026_Q4.xlsx - Microsoft Excel',
    durationSec: 5,
    description: 'Switched to Excel spreadsheet to retrieve allowed billing amounts and contractual write-offs.'
  },
  {
    title: '4. Checking Payer Guidelines in Browser',
    app: 'Chrome',
    windowTitle: 'BlueCross BlueShield Provider Portal - Claims Inquiry',
    durationSec: 5,
    description: 'Verifying timely filing limit and contractual appeal deadlines.'
  },
  {
    title: '5. Applying Adjustment Code & Completing Claim',
    app: 'NovaArc RCM',
    windowTitle: 'NovaArc RCM - Final Settlement & Submission',
    durationSec: 4,
    description: 'Applied adjustment code CO-45, re-billed balance, and closed claim successfully.'
=======
  claimId?: string
  onCompleteSimulation?: (claimId: string) => void
}

interface SimStep {
  app: string
  window: string
  action: string
  durationSec: number
  isNva: boolean
  nvaType?: string
  color: string
}

const SIMULATION_SCRIPT: SimStep[] = [
  {
    app: 'Epic Hyperspace',
    window: 'Claim Adjudication Workqueue - Account #883921',
    action: 'Reviewing denial reason CO-16 (Missing clinical notes)',
    durationSec: 15,
    isNva: false,
    color: '#2563eb'
  },
  {
    app: 'Excel',
    window: 'Payer_Denial_Crosswalk_2026.xlsx - Sheet 1',
    action: 'Cross-referencing denial override modifier (Manual Lookup)',
    durationSec: 45,
    isNva: true,
    nvaType: 'EXCEL_OVERUSE',
    color: '#16a34a'
  },
  {
    app: 'Chrome',
    window: 'Availity Payer Portal - Real-time Eligibility Verification',
    action: 'Verifying active coverage date and primary payer coordination',
    durationSec: 25,
    isNva: false,
    color: '#0284c7'
  },
  {
    app: 'Epic Hyperspace',
    window: 'Billing Workspace - Corrected Claim Editor',
    action: 'Attaching clinical records and updating secondary diagnosis code',
    durationSec: 30,
    isNva: true,
    nvaType: 'APP_SWITCHING',
    color: '#2563eb'
  },
  {
    app: 'NovaArc RCM',
    window: 'Electronic Claim Submission Engine',
    action: 'Validating scrubbing rules and transmitting corrected 837 claim',
    durationSec: 20,
    isNva: false,
    color: '#4f46e5'
>>>>>>> ebecadb (frontend changed)
  }
]

export const LiveSimulationModal: React.FC<LiveSimulationModalProps> = ({
  isOpen,
  onClose,
  associateId = 'EMP101',
<<<<<<< HEAD
=======
  claimId = 'CLM-9021',
>>>>>>> ebecadb (frontend changed)
  onCompleteSimulation
}) => {
  const [isRunning, setIsRunning] = useState(false)
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
<<<<<<< HEAD
  const [stepSecondsLeft, setStepSecondsLeft] = useState(0)
  const [totalSecondsElapsed, setTotalSecondsElapsed] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string>('Ready to begin demonstration.')
  const [claimId] = useState('CLM-8821')

  const timerRef = useRef<any>(null)

  useEffect(() => {
    if (!isOpen) {
      handleReset()
    }
  }, [isOpen])

  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setIsRunning(false)
    setCurrentStepIdx(0)
    setStepSecondsLeft(0)
    setTotalSecondsElapsed(0)
    setIsCompleted(false)
    setStatusMessage('Ready to begin demonstration.')
  }

  const startSimulation = async () => {
    setIsRunning(true)
    setIsCompleted(false)
    setCurrentStepIdx(0)
    setTotalSecondsElapsed(0)

    try {
      setStatusMessage('Registering live session and detecting claim CLM-8821...')
      await api.setActiveClaim(associateId, claimId, 'CR - Call / IVR', 14, 840, 'Robert Vance')
    } catch (e) {
      console.warn('Simulation local dispatch mode:', e)
    }

    runStep(0)
  }

  const runStep = (idx: number) => {
    if (idx >= DEMO_SCENARIO.length) {
      finishSimulation()
      return
    }

    const step = DEMO_SCENARIO[idx]
    setCurrentStepIdx(idx)
    setStepSecondsLeft(step.durationSec)
    setStatusMessage(`Active in ${step.app}: ${step.title}`)

    // Dispatch live event to backend
    api.ingestEvents([
      {
        session_id: `sess-demo-${associateId}`,
        associate_id: associateId,
        claim_id: claimId,
        event_type: 'APP_FOCUS',
        app_name: step.app,
        window_title: step.windowTitle,
        timestamp: new Date().toISOString(),
        is_idle: false,
        agent_version: '1.0.0'
      }
    ]).catch(() => {})

    let sec = step.durationSec
    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      sec -= 1
      setStepSecondsLeft(sec)
      setTotalSecondsElapsed(prev => prev + 1)

      if (sec <= 0) {
        if (timerRef.current) clearInterval(timerRef.current)
        runStep(idx + 1)
      }
    }, 1000)
  }

  const finishSimulation = async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setIsRunning(false)
    setIsCompleted(true)
    setStatusMessage('Claim CLM-8821 successfully adjudicated and saved to Supabase!')

    try {
      await api.completeClaim(associateId, claimId)
    } catch (e) {
      console.warn('Completed locally:', e)
    }

    onCompleteSimulation()
  }

  if (!isOpen) return null

  const currentStep = DEMO_SCENARIO[currentStepIdx] || DEMO_SCENARIO[0]
  const progressPercent = Math.min(100, Math.round(((currentStepIdx + 1) / DEMO_SCENARIO.length) * 100))

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
      onClick={e => {
        if (e.target === e.currentTarget && !isRunning) onClose()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 680,
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #e2e8f0'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Zap size={20} color="#60a5fa" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
                Interactive Live Claim Demo
              </h2>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                Test the complete Transaction Intelligence workflow in your browser
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: 24 }}>
          {/* Active Claim Badge & Timer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              marginBottom: 20
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '4px 8px',
                  borderRadius: 6,
                  background: isRunning ? '#ecfdf5' : '#f1f5f9',
                  color: isRunning ? '#059669' : '#64748b',
                  border: isRunning ? '1px solid #a7f3d0' : '1px solid #cbd5e1'
                }}
              >
                {isRunning ? 'LIVE DEMO' : isCompleted ? 'COMPLETED' : 'STANDBY'}
              </span>
              <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                CLM-8821
              </span>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                (Patient: Robert Vance | Aetna PPO)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', fontWeight: 700 }}>
              <Activity size={16} color="#3b82f6" />
              <span>Elapsed: {totalSecondsElapsed}s</span>
            </div>
          </div>

          {/* Current Step Display Card */}
          <div
            style={{
              padding: 18,
              borderRadius: 12,
              background: isCompleted ? '#f0fdf4' : '#ffffff',
              border: isCompleted ? '1px solid #86efac' : '1px solid #cbd5e1',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              marginBottom: 20
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: currentStep.app === 'NovaArc RCM' ? '#4f46e5' : currentStep.app === 'Excel' ? '#16a34a' : '#2563eb',
                    color: '#ffffff'
                  }}
                >
                  {isCompleted ? 'NovaArc Finalized' : currentStep.app}
                </span>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
                  {isCompleted ? 'Claim Successfully Adjudicated & Synced' : currentStep.title}
                </span>
              </div>

              {isRunning && (
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#3b82f6' }}>
                  Next in: {stepSecondsLeft}s
                </span>
              )}
            </div>

            <p style={{ fontSize: '0.8125rem', color: '#475569', margin: '6px 0 12px 0', lineHeight: 1.5 }}>
              {isCompleted
                ? 'All tracking events, window durations, and fee schedule cross-checks were recorded. The dashboard KPIs, average handling time, and donut charts have been refreshed.'
                : currentStep.description}
            </p>

            {/* Progress Bar */}
            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${isCompleted ? 100 : progressPercent}%`,
                  background: isCompleted ? '#22c55e' : 'linear-gradient(90deg, #3b82f6, #6366f1)',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
          </div>

          {/* Stepper Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {DEMO_SCENARIO.map((step, idx) => {
              const isPast = idx < currentStepIdx || isCompleted
              const isCurrent = idx === currentStepIdx && isRunning

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: isCurrent ? '#eff6ff' : isPast ? '#f8fafc' : '#ffffff',
                    border: isCurrent ? '1px solid #bfdbfe' : '1px solid #f1f5f9'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {isPast ? (
                      <CheckCircle2 size={16} color="#16a34a" />
                    ) : isCurrent ? (
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          border: '2px solid #3b82f6',
                          borderTopColor: 'transparent',
                          animation: 'spin 1s linear infinite'
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: '#e2e8f0',
                          fontSize: 10,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#64748b'
                        }}
                      >
                        {idx + 1}
                      </span>
                    )}
                    <span style={{ fontSize: '0.8125rem', fontWeight: isCurrent ? 700 : 500, color: '#1e293b' }}>
                      {step.title}
                    </span>
                  </div>

                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                    {step.durationSec}s
                  </span>
                </div>
              )
            })}
          </div>

          {/* Status Message */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: isCompleted ? '#f0fdf4' : '#f8fafc',
              border: isCompleted ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
              fontSize: '0.8rem',
              color: isCompleted ? '#15803d' : '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 20
            }}
          >
            <Sparkles size={16} color={isCompleted ? '#16a34a' : '#3b82f6'} />
            <span style={{ fontWeight: 600 }}>{statusMessage}</span>
          </div>

          {/* Controls & Executable Download */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {!isRunning && !isCompleted && (
                <button
                  onClick={startSimulation}
                  style={{
                    padding: '10px 22px',
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  <Play size={16} fill="#ffffff" />
                  <span>Start Live Simulation</span>
                </button>
              )}

              {isCompleted && (
                <button
                  onClick={handleReset}
                  style={{
                    padding: '10px 20px',
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
=======
  const [speedMultiplier, setSpeedMultiplier] = useState(2) // 1x, 2x, 5x
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [activeSeconds, setActiveSeconds] = useState(0)
  const [idleSeconds, setIdleSeconds] = useState(0)
  const [logs, setLogs] = useState<Array<{ time: string; app: string; text: string; isNva?: boolean }>>([])
  const [nvaAlerts, setNvaAlerts] = useState<string[]>([])
  const [isCompleted, setIsCompleted] = useState(false)

  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setIsRunning(false)
      setCurrentStepIdx(0)
      setElapsedSeconds(0)
      setActiveSeconds(0)
      setIdleSeconds(0)
      setLogs([])
      setNvaAlerts([])
      setIsCompleted(false)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isOpen])

  useEffect(() => {
    if (isRunning && !isCompleted) {
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds(prev => prev + 1)
        setActiveSeconds(prev => prev + 1)
      }, 1000 / speedMultiplier)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRunning, speedMultiplier, isCompleted])

  // Step sequencer
  useEffect(() => {
    if (!isRunning || isCompleted) return

    const currentStep = SIMULATION_SCRIPT[currentStepIdx]
    if (!currentStep) {
      setIsCompleted(true)
      setIsRunning(false)
      return
    }

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs(prev => [
      {
        time: nowStr,
        app: currentStep.app,
        text: currentStep.action,
        isNva: currentStep.isNva
      },
      ...prev.slice(0, 15)
    ])

    if (currentStep.isNva && currentStep.nvaType && !nvaAlerts.includes(currentStep.nvaType)) {
      setNvaAlerts(prev => [...prev, currentStep.nvaType!])
    }

    const stepDurationMs = (currentStep.durationSec * 1000) / speedMultiplier
    const timeout = setTimeout(() => {
      if (currentStepIdx < SIMULATION_SCRIPT.length - 1) {
        setCurrentStepIdx(prev => prev + 1)
      } else {
        setIsCompleted(true)
        setIsRunning(false)
      }
    }, stepDurationMs)

    return () => clearTimeout(timeout)
  }, [isRunning, currentStepIdx, speedMultiplier, isCompleted])

  if (!isOpen) return null

  const currentStep = SIMULATION_SCRIPT[currentStepIdx] || SIMULATION_SCRIPT[SIMULATION_SCRIPT.length - 1]

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${mins}m ${secs.toString().padStart(2, '0')}s`
  }

  const handleFinish = () => {
    if (onCompleteSimulation) {
      onCompleteSimulation(claimId)
    }
    onClose()
  }

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(8px)'
          }}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 780,
            background: '#ffffff',
            borderRadius: 24,
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 10
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#fafafa'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #18171c 0%, #312e38 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff'
                }}
              >
                <Activity size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: '#18171c' }}>
                  Live Desktop Agent Claim Simulation
                </h2>
                <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: 2 }}>
                  Simulating associate <strong>{associateId}</strong> actively adjudicating <strong>{claimId}</strong>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 'none',
                background: '#f1f5f9',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Simulation Viewport & Controls */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Live Metrics Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
                background: '#f8fafc',
                padding: '12px 16px',
                borderRadius: 16,
                border: '1px solid #e2e8f0'
              }}
            >
              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Elapsed Sim Time
                </div>
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: '#18171c'
                  }}
                >
                  {formatSec(elapsedSeconds)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Current Application
                </div>
                <div
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 800,
                    color: currentStep.color,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {currentStep.app}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Progress
                </div>
                <div
                  style={{
                    fontSize: '1.125rem',
                    fontWeight: 800,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: '#4f46e5'
                  }}
                >
                  Step {currentStepIdx + 1} of {SIMULATION_SCRIPT.length}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  NVA Detections
                </div>
                <div
                  style={{
                    fontSize: '1.125rem',
                    fontWeight: 800,
                    color: nvaAlerts.length > 0 ? '#dc2626' : '#16a34a'
                  }}
                >
                  {nvaAlerts.length > 0 ? `${nvaAlerts.length} Flagged` : 'Clean Stream'}
                </div>
              </div>
            </div>

            {/* Virtual Screen Active Window Box */}
            <div
              style={{
                borderRadius: 16,
                border: '1.5px solid #0f172a',
                background: '#0f172a',
                color: '#ffffff',
                padding: '16px 20px',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Fake Window Titlebar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: 12,
                  borderBottom: '1px solid rgba(255,255,255,0.15)',
                  marginBottom: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      color: '#94a3b8',
                      marginLeft: 8
                    }}
                  >
                    {currentStep.app} · {currentStep.window}
                  </span>
                </div>

                {isRunning && (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '0.6875rem',
                      color: '#4ade80',
                      fontWeight: 700
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
                    EVENT STREAM LIVE
                  </span>
                )}
              </div>

              {/* Action Activity */}
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Current Operator Action
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>
                  {currentStep.action}
                </div>
              </div>

              {/* Instant NVA Banner inside screen */}
              {currentStep.isNva && (
                <div
                  style={{
                    marginTop: 12,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#fca5a5',
                    fontSize: '0.75rem',
                    fontWeight: 700,
>>>>>>> ebecadb (frontend changed)
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
<<<<<<< HEAD
                  <RotateCcw size={16} />
                  <span>Run Again</span>
                </button>
              )}

              {isRunning && (
                <button
                  onClick={finishSimulation}
                  style={{
                    padding: '10px 18px',
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                  }}
                >
                  Skip to Finish
                </button>
              )}
            </div>

            {/* Desktop Agent Info Box */}
=======
                  <AlertTriangle size={16} color="#ef4444" />
                  <span>NVA Rule Triggered: {currentStep.nvaType}</span>
                </div>
              )}
            </div>

            {/* Live Ticker Logs */}
            <div
              style={{
                height: 120,
                overflowY: 'auto',
                background: '#f8fafc',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                padding: '10px 14px',
                fontSize: '0.75rem',
                fontFamily: "'JetBrains Mono', monospace"
              }}
            >
              {logs.length === 0 ? (
                <div style={{ color: '#94a3b8', textAlign: 'center', padding: '30px 0' }}>
                  Click "Start Simulation" below to stream live claim telemetry events.
                </div>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 6,
                      color: log.isNva ? '#dc2626' : '#334155'
                    }}
                  >
                    <span style={{ color: '#94a3b8' }}>[{log.time}]</span>
                    <strong style={{ color: '#18171c' }}>{log.app}:</strong>
                    <span>{log.text}</span>
                  </div>
                ))
              )}
            </div>

            {/* Action Bar & Simulation Playback Controls */}
>>>>>>> ebecadb (frontend changed)
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
<<<<<<< HEAD
                gap: 8,
                fontSize: '0.75rem',
                color: '#64748b'
              }}
            >
              <ShieldCheck size={16} color="#10b981" />
              <span>For Windows users: Run <strong>Start-Agent.bat</strong> or <strong>TMS-Agent.exe</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
=======
                justifyContent: 'space-between',
                paddingTop: 8
              }}
            >
              {/* Playback buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setIsRunning(!isRunning)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 10,
                    border: 'none',
                    background: isRunning ? '#d97706' : '#18171c',
                    color: '#ffffff',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {isRunning ? <Pause size={16} /> : <Play size={16} />}
                  <span>{isRunning ? 'Pause' : 'Start Simulation'}</span>
                </button>

                <button
                  onClick={() => {
                    setIsRunning(false)
                    setCurrentStepIdx(0)
                    setElapsedSeconds(0)
                    setLogs([])
                    setNvaAlerts([])
                    setIsCompleted(false)
                  }}
                  style={{
                    padding: '9px 14px',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <RotateCcw size={14} />
                  <span>Reset</span>
                </button>

                {/* Speed selector */}
                <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                  {[1, 2, 5].map(speed => (
                    <button
                      key={speed}
                      onClick={() => setSpeedMultiplier(speed)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: speedMultiplier === speed ? '1px solid #18171c' : '1px solid #e2e8f0',
                        background: speedMultiplier === speed ? '#18171c' : '#ffffff',
                        color: speedMultiplier === speed ? '#ffffff' : '#64748b',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Complete / Done button */}
              {isCompleted ? (
                <button
                  onClick={handleFinish}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#16a34a',
                    color: '#ffffff',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>Save &amp; Complete Claim</span>
                </button>
              ) : (
                <button
                  onClick={onClose}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#64748b',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

>>>>>>> ebecadb (frontend changed)
