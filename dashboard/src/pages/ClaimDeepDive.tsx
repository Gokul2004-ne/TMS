import React, { useState, useEffect } from 'react'
import { Search, Compass, ArrowLeft } from 'lucide-react'
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
    loadTimeline(claimId)
  }, [claimId])

  const loadTimeline = async (cid: string) => {
    setLoading(true)
    try {
      const data = await api.getClaimTimeline('EMP101', cid)
      setTimeline(data)
    } finally {
      setLoading(false)
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
        marginBottom: 24
      }}>
        <button className="btn-ghost" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Workspace</span>
        </button>

        <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center'
          }}>
            <Search size={16} style={{ position: 'absolute', left: 12, color: 'var(--text-dim)' }} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search Claim ID (e.g. CLM1026)"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                padding: '8px 12px 8px 36px',
                color: 'var(--text-main)',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-mono)',
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
          <span className="text-dim">Quick Presets:</span>
          {presetClaims.map((p) => (
            <button
              key={p}
              onClick={() => {
                setSearchInput(p)
                setClaimId(p)
              }}
              style={{
                background: claimId === p ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${claimId === p ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                color: claimId === p ? 'var(--accent-cyan)' : 'var(--text-muted)',
                borderRadius: 6,
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading || !timeline ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Retrieving timeline telemetry for {claimId}...
        </div>
      ) : (
        <ClaimTimelineView timeline={timeline} />
      )}
    </div>
  )
}
