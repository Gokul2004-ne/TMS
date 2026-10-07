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
  initialClaimId = '',
  onBack
}) => {
  const [claimId, setClaimId] = useState(initialClaimId)
  const [searchInput, setSearchInput] = useState(initialClaimId)
  const [presetClaims, setPresetClaims] = useState<string[]>([])
  const [timeline, setTimeline] = useState<ClaimTimelineDetail | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch available claims from live backend
  useEffect(() => {
    api.getAssociateClaims('EMP101').then((claims) => {
      const ids = Array.from(new Set(claims.map(c => c.claim_id).filter(Boolean)))
      setPresetClaims(ids)
      if (!claimId && ids.length > 0) {
        setClaimId(ids[0])
        setSearchInput(ids[0])
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!claimId) return
    loadTimeline(claimId, true)
    const interval = setInterval(() => {
      loadTimeline(claimId, false)
    }, 5000)
    return () => clearInterval(interval)
  }, [claimId])

  const loadTimeline = async (cid: string, showLoading: boolean = false) => {
    if (!cid) return
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
              placeholder="Search Claim ID..."
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

        {presetClaims.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Quick Presets:</span>
            {presetClaims.slice(0, 6).map((p) => (
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
        )}
      </div>

      {!claimId ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', background: '#ffffff', border: '1px solid #e2e8f0' }}>
          No claim selected. Search a Claim ID above or click a claim in the workspace to inspect its timeline.
        </div>
      ) : loading || !timeline ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', background: '#ffffff', border: '1px solid #e2e8f0' }}>
          Retrieving timeline telemetry for {claimId}...
        </div>
      ) : (
        <ClaimTimelineView timeline={timeline} />
      )}
    </div>
  )
}
