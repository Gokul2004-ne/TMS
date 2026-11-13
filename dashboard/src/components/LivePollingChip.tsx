import React, { useState, useEffect } from 'react'
import { Pause, Play, RefreshCw } from 'lucide-react'

interface LivePollingChipProps {
  isPolling: boolean
  intervalSec?: number
  onToggle: () => void
  onRefresh: () => void | Promise<void>
}

export const LivePollingChip: React.FC<LivePollingChipProps> = ({
  isPolling,
  intervalSec = 3,
  onToggle,
  onRefresh
}) => {
  const [countdown, setCountdown] = useState<number>(intervalSec)
  const [isSpinning, setIsSpinning] = useState<boolean>(false)

  useEffect(() => {
    setCountdown(intervalSec)
  }, [intervalSec])

  useEffect(() => {
    if (!isPolling) return
    const timer = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? intervalSec : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [isPolling, intervalSec])

  const handleRefresh = async () => {
    setIsSpinning(true)
    setCountdown(intervalSec)
    try {
      await onRefresh()
    } finally {
      setTimeout(() => setIsSpinning(false), 400)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: isPolling ? '#f0fdf4' : '#f8fafc',
        border: isPolling ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
        fontSize: '0.75rem',
        fontWeight: 700,
        color: isPolling ? 'var(--accent-emerald)' : 'var(--text-dim)',
        userSelect: 'none'
      }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: isPolling ? '#15803d' : '#94a3b8',
          boxShadow: isPolling ? '0 0 6px #22c55e' : 'none'
        }} />
        {isPolling ? `Live Polling (${countdown}s)` : 'Polling Paused'}
      </div>

      <button
        onClick={onToggle}
        className="btn-ghost"
        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
        title={isPolling ? 'Pause Polling' : 'Resume Polling'}
        type="button"
      >
        {isPolling ? <Pause size={12} /> : <Play size={12} />}
      </button>

      <button
        onClick={handleRefresh}
        className="btn-ghost"
        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
        title="Refresh now"
        type="button"
      >
        <RefreshCw size={12} style={{ animation: isSpinning ? 'spin 0.6s linear infinite' : 'none' }} />
      </button>
    </div>
  )
}

