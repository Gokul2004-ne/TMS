import { CONFIG } from '../config'
import {
  AssociateTodayData,
  ClaimTimelineItem,
  ClaimTimelineDetail,
  TeamOverviewData,
  NVASummaryData,
  InsightsResponse,
  PendingClaimItem
} from './types'
import {
  mockAssociateToday,
  mockClaimTimelineDetail,
  mockTeamOverview,
  mockNvaSummary,
  mockAiInsights,
  mockPendingClaims
} from './mock'

function getApiBases(): string[] {
  const bases = [CONFIG.API_BASE]
  if (CONFIG.API_BASE.includes('onrender.com') || CONFIG.API_BASE.includes('catalystappsail.in')) {
    bases.push('http://localhost:8000')
    bases.push('http://127.0.0.1:8000')
  } else if (CONFIG.API_BASE.includes('localhost') || CONFIG.API_BASE.includes('127.0.0.1')) {
    bases.push('https://tms-backend-50047231328.development.catalystappsail.in')
  }
  return bases
}

export const api = {
  async getAssociateToday(associateId: string = 'EMP101'): Promise<AssociateTodayData> {
    if (CONFIG.USE_MOCK) {
      return Promise.resolve(mockAssociateToday)
    }
    const bases = getApiBases()

    for (const base of bases) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3500)
        const res = await fetch(`${base}/api/associate/${associateId}/today`, { signal: controller.signal })
        clearTimeout(timeoutId)
        if (res.ok) {
          const json = await res.json()
          // Retain local active claim if newly activated in browser
          const stored = localStorage.getItem('tms_active_claim')
          if (stored && (!json.active_claim_id || json.active_claim_id === 'UNASSIGNED')) {
            try {
              const p = JSON.parse(stored)
              if (p.claim_id && (Date.now() - (p.timestamp || 0)) < 3600000) {
                json.active_claim_id = p.claim_id
                json.active_claim_type = p.action_type || json.active_claim_type
                json.active_target_minutes = p.target_minutes || json.active_target_minutes
                json.active_target_seconds = p.target_seconds || json.active_target_seconds
              }
            } catch {}
          }
          return json
        }
      } catch (err) {
        // try next endpoint
      }
    }

    console.warn('[API] Backend unreachable, falling back to resilient local fixtures.')
    const stored = localStorage.getItem('tms_active_claim')
    if (stored) {
      try {
        const p = JSON.parse(stored)
        if (p.claim_id) {
          mockAssociateToday.active_claim_id = p.claim_id
          mockAssociateToday.active_claim_type = p.action_type || mockAssociateToday.active_claim_type
          mockAssociateToday.active_target_minutes = p.target_minutes || mockAssociateToday.active_target_minutes
          mockAssociateToday.active_target_seconds = p.target_seconds || mockAssociateToday.active_target_seconds
        }
      } catch {}
    }
    return mockAssociateToday
  },

  async getAssociateClaims(associateId: string = 'EMP101'): Promise<ClaimTimelineItem[]> {
    if (CONFIG.USE_MOCK) {
      return Promise.resolve(mockAssociateToday.recent_claims)
    }
    const bases = getApiBases()
    for (const base of bases) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3500)
        const res = await fetch(`${base}/api/associate/${associateId}/claims`, { signal: controller.signal })
        clearTimeout(timeoutId)
        if (res.ok) {
          return await res.json()
        }
      } catch (err) {
        // try next endpoint
      }
    }
    return mockAssociateToday.recent_claims
  },

  async getClaimTimeline(associateId: string, claimId: string): Promise<ClaimTimelineDetail> {
    if (CONFIG.USE_MOCK) {
      return Promise.resolve({
        ...mockClaimTimelineDetail,
        claim_id: claimId,
        associate_id: associateId
      })
    }
    const bases = getApiBases()
    for (const base of bases) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3500)
        const res = await fetch(`${base}/api/associate/${associateId}/claims/${claimId}/timeline`, { signal: controller.signal })
        clearTimeout(timeoutId)
        if (res.ok) {
          return await res.json()
        }
      } catch (err) {
        // try next endpoint
      }
    }

    console.warn(`[API] Failed to fetch timeline for claim ${claimId} from all bases, using fallback.`)
    return {
      claim_id: claimId,
      associate_id: associateId,
      start_time: new Date().toISOString(),
      end_time: null,
      total_duration_seconds: 0,
      active_duration_seconds: 0,
      idle_duration_seconds: 0,
      app_switches_count: 0,
      status: 'IN_PROGRESS',
      action_type: 'CR - Call / IVR',
      target_minutes: 14,
      target_seconds: 840,
      variance_seconds: 840,
      nva_flags: [],
      app_breakdowns: [],
      raw_events: []
    }
  },

  async getTeamOverview(): Promise<TeamOverviewData> {
    if (CONFIG.USE_MOCK) {
      return Promise.resolve(mockTeamOverview)
    }
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/team/overview`)
      if (!res.ok) throw new Error('Network error')
      return await res.json()
    } catch (err) {
      return mockTeamOverview
    }
  },

  async getTeamNvaSummary(): Promise<NVASummaryData> {
    if (CONFIG.USE_MOCK) {
      return Promise.resolve(mockNvaSummary)
    }
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/team/nva-summary`)
      if (!res.ok) throw new Error('Network error')
      return await res.json()
    } catch (err) {
      return mockNvaSummary
    }
  },

  async getAiInsights(): Promise<InsightsResponse> {
    if (CONFIG.USE_MOCK) {
      return Promise.resolve(mockAiInsights)
    }
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/insights`)
      if (!res.ok) throw new Error('Network error')
      return await res.json()
    } catch (err) {
      return mockAiInsights
    }
  },

  async setActiveClaim(
    associateId: string = 'EMP101',
    claimId: string,
    actionTypeOrPatient?: string,
    targetMinutes?: number,
    targetSeconds?: number,
    patientName?: string
  ): Promise<{ associate_id: string; active_claim_id: string }> {
    // Robust polymorphic handling: if 3rd arg is patient name (e.g. from LiveSimulationModal)
    let actionType = actionTypeOrPatient
    let patient = patientName
    if (
      actionTypeOrPatient &&
      targetMinutes === undefined &&
      targetSeconds === undefined &&
      !actionTypeOrPatient.includes(' - ') &&
      !actionTypeOrPatient.includes('Call') &&
      !actionTypeOrPatient.includes('Appeals') &&
      !actionTypeOrPatient.includes('Denial')
    ) {
      patient = actionTypeOrPatient
      actionType = 'CR - Call / IVR'
    }

    try {
      localStorage.setItem('tms_active_claim', JSON.stringify({
        claim_id: claimId,
        action_type: actionType,
        target_minutes: targetMinutes,
        target_seconds: targetSeconds,
        timestamp: Date.now()
      }))
    } catch {}

    mockAssociateToday.active_claim_id = claimId
    mockAssociateToday.active_claim_type = actionType || 'CR - Call / IVR'
    mockAssociateToday.active_target_minutes = targetMinutes || 14
    mockAssociateToday.active_target_seconds = targetSeconds || (targetMinutes ? targetMinutes * 60 : 840)

    if (CONFIG.USE_MOCK) {
      return Promise.resolve({ associate_id: associateId, active_claim_id: claimId })
    }

    const bases = [CONFIG.API_BASE]
    if (CONFIG.API_BASE.includes('onrender.com') || CONFIG.API_BASE.includes('catalystappsail.in')) {
      bases.push('http://localhost:8000')
    } else if (CONFIG.API_BASE.includes('localhost') || CONFIG.API_BASE.includes('127.0.0.1')) {
      bases.push('https://tms-backend-50047231328.development.catalystappsail.in')
    }

    let successRes = null
    for (const base of bases) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        const res = await fetch(`${base}/api/associate/${associateId}/active-claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            claim_id: claimId,
            patient_name: patient,
            action_type: actionType || undefined,
            target_minutes: targetMinutes || undefined,
            target_seconds: targetSeconds || undefined,
            status: 'IN_PROGRESS'
          }),
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        if (res.ok) {
          successRes = await res.json()
          break
        }
      } catch (err) {}
    }

    return successRes || { associate_id: associateId, active_claim_id: claimId }
  },

  async resolveAlert(alertType: string, associateId: string): Promise<any> {
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/team/alerts/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: alertType, associate_id: associateId })
      })
      if (!res.ok) throw new Error('Failed to resolve alert')
      return await res.json()
    } catch (err) {
      console.warn('[API] resolveAlert failed:', err)
      return { status: 'fallback_resolved' }
    }
  },

  async ingestEvents(events: any[]): Promise<any> {
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events })
      })
      if (!res.ok) throw new Error('Failed to ingest events')
      return await res.json()
    } catch (err) {
      return { received: events.length, status: 'fallback_ok' }
    }
  },

  async completeClaim(associateId: string = 'EMP101', claimId: string): Promise<any> {
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/associate/${associateId}/claims/${claimId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED', export_excel: true })
      })
      if (!res.ok) throw new Error('Failed to complete claim on backend')
      return await res.json()
    } catch (err) {
      console.warn('[API] completeClaim fallback:', err)
      return { status: 'fallback_completed', claim_id: claimId }
    }
  },

  async updateClaimStatus(associateId: string = 'EMP101', claimId: string, status: string): Promise<any> {
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/associate/${associateId}/claims/${claimId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      if (!res.ok) throw new Error('Failed to update claim status')
      return await res.json()
    } catch (err) {
      console.warn('[API] updateClaimStatus fallback:', err)
      return { status: 'fallback_updated', claim_id: claimId, new_status: status }
    }
  },

  async getPendingClaims(associateId: string = 'EMP101'): Promise<PendingClaimItem[]> {
    if (CONFIG.USE_MOCK) return Promise.resolve(mockPendingClaims)
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/associate/pending-claims?employee_id=${associateId}`)
      if (!res.ok) throw new Error('Failed to fetch pending claims')
      return await res.json()
    } catch (err) {
      return mockPendingClaims
    }
  }
}
