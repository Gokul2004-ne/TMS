import React from 'react'
import { Clock, RefreshCw, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react'
import { ClaimTimelineDetail } from '../api/types'
import { AppBreakdownBar } from './AppBreakdownBar'
import { NvaBadge } from './NvaBadge'

interface ClaimTimelineViewProps {
  timeline: ClaimTimelineDetail
}

export const ClaimTimelineView: React.FC<ClaimTimelineViewProps> = ({ timeline }) => {
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      return isoString
    }
  }

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60)
    const rem = sec % 60
    return `${mins}m ${rem}s`
  }

  return (
    <div className="glass-card" style={{ marginBottom: 24 }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        paddingBottom: 16,
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            color: 'var(--accent-cyan)'
          }}>
            {timeline.claim_id}
          </div>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 6,
            background: timeline.status === 'COMPLETED' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(56, 189, 248, 0.15)',
            color: timeline.status === 'COMPLETED' ? 'var(--accent-emerald)' : 'var(--accent-cyan)'
          }}>
            {timeline.status}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {timeline.nva_flags.map((f, i) => (
              <NvaBadge key={i} flag={f} />
            ))}
          </div>
        </div>

        {/* Quick summary stats */}
        <div style={{ display: 'flex', gap: 20, fontSize: '0.8125rem' }}>
          <div>
            <span className="text-dim">Total Duration: </span>
            <strong style={{ color: 'var(--text-main)' }}>{formatDuration(timeline.total_duration_seconds)}</strong>
          </div>
          <div>
            <span className="text-dim">Active: </span>
            <strong style={{ color: 'var(--accent-cyan)' }}>{formatDuration(timeline.active_duration_seconds)}</strong>
          </div>
          <div>
            <span className="text-dim">Idle: </span>
            <strong style={{ color: 'var(--accent-amber)' }}>{formatDuration(timeline.idle_duration_seconds)}</strong>
          </div>
          <div>
            <span className="text-dim">App Switches: </span>
            <strong style={{ color: 'var(--accent-indigo)' }}>{timeline.app_switches_count}</strong>
          </div>
        </div>
      </div>

      {/* App Breakdown Bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
          Application Time Distribution
        </div>
        <AppBreakdownBar items={timeline.app_breakdowns} height={14} />
      </div>

      {/* Event Stream Timeline */}
      <div>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 14 }}>
          Chronological Event Sequence ({timeline.raw_events.length} captured events)
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {timeline.raw_events.map((ev, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.04)',
                fontSize: '0.8125rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  {formatTime(ev.timestamp)}
                </span>
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: ev.event_type.includes('IDLE') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(129, 140, 248, 0.15)',
                  color: ev.event_type.includes('IDLE') ? 'var(--accent-rose)' : 'var(--accent-indigo)'
                }}>
                  {ev.event_type}
                </span>
                <strong style={{ color: 'var(--text-main)' }}>{ev.app_name}</strong>
                <span style={{ color: 'var(--text-dim)', maxWidth: 450, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ev.window_title}
                </span>
              </div>

              {ev.is_idle && (
                <span style={{ fontSize: '0.6875rem', color: 'var(--accent-amber)', fontWeight: 600 }}>
                  IDLE DETECTED
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
