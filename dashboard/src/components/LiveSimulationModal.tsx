import React, { useState, useEffect, useRef } from 'react'
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

interface LiveSimulationModalProps {
  isOpen: boolean
  onClose: () => void
  associateId?: string
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
  }
]

export const LiveSimulationModal: React.FC<LiveSimulationModalProps> = ({
  isOpen,
  onClose,
  associateId = 'EMP101',
  onCompleteSimulation
}) => {
  const [isRunning, setIsRunning] = useState(false)
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
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
      await api.setActiveClaim(associateId, claimId, 'Robert Vance')
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
                {isRunning ? '● LIVE DEMO' : isCompleted ? 'COMPLETED' : 'STANDBY'}
              </span>
              <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                CLM-8821
              </span>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                (Patient: Robert Vance · Aetna PPO)
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
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
