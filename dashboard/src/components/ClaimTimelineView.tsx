import React from 'react'
import { ClaimTimelineDetail } from '../api/types'
import { AppBreakdownBar } from './AppBreakdownBar'
import { NvaBadge } from './NvaBadge'

interface ClaimTimelineViewProps {
  timeline: ClaimTimelineDetail
}

export const ClaimTimelineView: React.FC<ClaimTimelineViewProps> = ({ timeline }) => {
  const formatTime = (isoString: string) => {
    try {
      let s = (isoString || '').trim()
      if (!s) return '--:--:--'
      // Ensure UTC timezone marker if missing so JavaScript correctly computes IST (+05:30)
      if (!s.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(s)) {
        s += 'Z'
      }
      const d = new Date(s)
      return d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      })
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
    <div className="glass-card" style={{ marginBottom: 24, background: '#ffffff' }}>
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
            color: 'var(--text-main)'
          }}>
            {timeline.claim_id}
          </div>
          <span style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            padding: '2px 8px',
            background: timeline.status === 'COMPLETED' ? '#f0fdf4' : '#fffbeb',
            color: timeline.status === 'COMPLETED' ? 'var(--accent-emerald)' : 'var(--accent-amber)',
            border: `1px solid ${timeline.status === 'COMPLETED' ? '#bbf7d0' : '#fde68a'}`
          }}>
            {timeline.status}
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {timeline.nva_flags.map((f, i) => (
              <NvaBadge key={i} flag={f} />
            ))}
          </div>
        </div>

        {/* Quick summary stats */}
        <div style={{ display: 'flex', gap: 20, fontSize: '0.8125rem' }}>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Total Duration: </span>
            <strong style={{ color: 'var(--text-main)' }}>{formatDuration(timeline.total_duration_seconds)}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Active: </span>
            <strong style={{ color: 'var(--accent-emerald)' }}>{formatDuration(timeline.active_duration_seconds)}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Idle: </span>
            <strong style={{ color: 'var(--accent-amber)' }}>{formatDuration(timeline.idle_duration_seconds)}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>App Switches: </span>
            <strong style={{ color: '#4338ca' }}>{timeline.app_switches_count}</strong>
          </div>
        </div>
      </div>

      {/* App Breakdown Bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>
          Application Time Distribution
        </div>
        <AppBreakdownBar items={timeline.app_breakdowns} height={12} />
      </div>

      {/* Event Stream Timeline */}
      <div>
        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 14 }}>
          Chronological Event Sequence ({timeline.raw_events.length} captured events)
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {timeline.raw_events.length === 0 ? (
            <div style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.8125rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0'
            }}>
              No events recorded for this claim yet.
            </div>
          ) : (
            timeline.raw_events.map((ev, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.8125rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    {formatTime(ev.timestamp)}
                  </span>
                  <span style={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    background: ev.event_type.includes('IDLE') ? '#fef2f2' : '#eef2ff',
                    color: ev.event_type.includes('IDLE') ? 'var(--accent-rose)' : '#4338ca',
                    border: `1px solid ${ev.event_type.includes('IDLE') ? '#fecaca' : '#c7d2fe'}`
                  }}>
                    {ev.event_type}
                  </span>
                  <strong style={{ color: 'var(--text-main)' }}>{ev.app_name}</strong>
                  <span style={{ color: 'var(--text-muted)', maxWidth: 450, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ev.window_title}
                  </span>
                </div>

                {ev.is_idle && (
                  <span style={{ fontSize: '0.6875rem', color: 'var(--accent-amber)', fontWeight: 700 }}>
                    IDLE DETECTED
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
