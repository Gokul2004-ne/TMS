import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Activity
} from 'lucide-react'

interface LiveSimulationModalProps {
  isOpen: boolean
  onClose: () => void
  associateId?: string
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
  }
]

export const LiveSimulationModal: React.FC<LiveSimulationModalProps> = ({
  isOpen,
  onClose,
  associateId = 'EMP101',
  claimId = 'CLM-9021',
  onCompleteSimulation
}) => {
  const [isRunning, setIsRunning] = useState(false)
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [speedMultiplier, setSpeedMultiplier] = useState(2)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [logs, setLogs] = useState<Array<{ time: string; app: string; text: string; isNva?: boolean }>>([])
  const [nvaAlerts, setNvaAlerts] = useState<string[]>([])
  const [isCompleted, setIsCompleted] = useState(false)

  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setIsRunning(false)
      setCurrentStepIdx(0)
      setElapsedSeconds(0)
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
      }, 1000 / speedMultiplier)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRunning, speedMultiplier, isCompleted])

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

              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Current Operator Action
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>
                  {currentStep.action}
                </div>
              </div>

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
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
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

            {/* Playback Controls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 8
              }}
            >
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
