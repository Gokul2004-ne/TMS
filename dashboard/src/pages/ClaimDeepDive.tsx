import React, { useState, useEffect } from 'react'
import { Search, ArrowLeft } from 'lucide-react'
import { ClaimTimelineDetail } from '../api/types'
import { api } from '../api/client'
import { ClaimTimelineView } from '../components/ClaimTimelineView'

interface ClaimDeepDiveProps {
  initialClaimId?: string
  onBack: () => void
}

export const ClaimDeepDive: React.FC<ClaimDeepDiveProps> = ({
  initialClaimId = 'CLM1026',
  onBack
}) => {
  const [claimId, setClaimId] = useState(initialClaimId)
  const [searchInput, setSearchInput] = useState(initialClaimId)
  const [timeline, setTimeline] = useState<ClaimTimelineDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTimeline(claimId, true)
    const interval = setInterval(() => {
      loadTimeline(claimId, false)
    }, 5000)
    return () => clearInterval(interval)
  }, [claimId])

  const loadTimeline = async (cid: string, showLoading: boolean = false) => {
    if (showLoading) setLoading(true)
    try {
      const data = await api.getClaimTimeline('EMP101', cid)
      setTimeline(data)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim()) {
      setClaimId(searchInput.trim().toUpperCase())
    }
  }

  const presetClaims = ['CLM1026', 'CLM1024', 'CLM1027', 'CLM1028']

  return (
    <div>
      {/* Top search & nav bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 20
      }}>
        <button className="btn-ghost" onClick={onBack}>
          <ArrowLeft size={15} />
          <span>Back to Workspace</span>
        </button>

        <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center'
          }}>
            <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search Claim ID (e.g. CLM1026)"
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '7px 12px 7px 32px',
                color: 'var(--text-main)',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                outline: 'none',
                width: 240
              }}
            />
          </div>
          <button type="submit" className="btn-primary">
            Analyze
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Quick Presets:</span>
          {presetClaims.map((p) => (
            <button
              key={p}
              onClick={() => {
                setSearchInput(p)
                setClaimId(p)
              }}
              style={{
                background: claimId === p ? '#0f172a' : '#ffffff',
                border: `1px solid ${claimId === p ? '#0f172a' : '#cbd5e1'}`,
                color: claimId === p ? '#ffffff' : 'var(--text-main)',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading || !timeline ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
          Retrieving timeline telemetry for {claimId}...
        </div>
      ) : (
        <ClaimTimelineView timeline={timeline} />
      )}
    </div>
  )
}
