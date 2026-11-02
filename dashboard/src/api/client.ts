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

let cachedWorkingBase: string | null = null
let lastWorkingBaseCheck = 0

function getApiBases(): string[] {
  const list: string[] = []
  const now = Date.now()

  // 1. If we have a cached working base that worked recently, prioritize it
  if (cachedWorkingBase && (now - lastWorkingBaseCheck < 60000)) {
    list.push(cachedWorkingBase)
  }

  // 2. Localhost endpoints for ultra-low latency (<5ms) when running local agent / backend
  const isLocalHost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  
  if (isLocalHost) {
    list.push('http://localhost:8000')
    list.push('http://127.0.0.1:8000')
  }

  // 3. Configured base
  if (CONFIG.API_BASE && !CONFIG.API_BASE.includes('onrender.com')) {
    list.push(CONFIG.API_BASE)
  }

  // 4. Cloud catalyst backend
  const catalyst = 'https://tms-backend-50047231328.development.catalystappsail.in'
  list.push(catalyst)

  // 5. Always include localhost fallbacks
  list.push('http://localhost:8000')
  list.push('http://127.0.0.1:8000')

  return Array.from(new Set(list.filter(Boolean)))
}

async function fetchWithFallback(path: string, options: RequestInit = {}, timeoutMs: number = 2500): Promise<Response> {
  const bases = getApiBases()
  for (const base of bases) {
    try {
      const isLocal = base.includes('localhost') || base.includes('127.0.0.1')
      const effTimeout = isLocal ? Math.min(timeoutMs, 1000) : timeoutMs
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), effTimeout)
      const res = await fetch(`${base}${path}`, {
        ...options,
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      if (res.ok) {
        cachedWorkingBase = base
        lastWorkingBaseCheck = Date.now()
        return res
      }
    } catch {
      if (cachedWorkingBase === base) {
        cachedWorkingBase = null
      }
    }
  }
  throw new Error(`Failed to fetch ${path} from all backend bases`)
}

export const api = {
  async getAssociateToday(associateId: string = 'EMP101'): Promise<AssociateTodayData> {
    if (CONFIG.USE_MOCK) {
      return Promise.resolve(mockAssociateToday)
    }

    try {
      const res = await fetchWithFallback(`/api/associate/${associateId}/today`, {}, 2500)
      if (res.ok) {
        const json = await res.json()
        const storageKey = `tms_active_claim_${associateId}`
        if (!json.active_claim_id || json.active_claim_id === 'UNASSIGNED') {
          try {
            localStorage.removeItem(storageKey)
            localStorage.removeItem('tms_active_claim')
          } catch {}
        } else {
          try {
            localStorage.setItem(storageKey, JSON.stringify({
              claim_id: json.active_claim_id,
              action_type: json.active_claim_type,
              target_minutes: json.active_target_minutes,
              target_seconds: json.active_target_seconds,
              timestamp: Date.now()
            }))
          } catch {}
        }
        return json
      }
    } catch (err) {}

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
    try {
      const res = await fetchWithFallback(`/api/associate/${associateId}/claims`, {}, 2500)
      if (res.ok) {
        return await res.json()
      }
    } catch {}
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

    try {
      const res = await fetchWithFallback(`/api/associate/${associateId}/claims/${claimId}/timeline`, {}, 2000)
      if (res.ok) {
        return await res.json()
      }
    } catch {}

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
      const res = await fetchWithFallback(`/api/team/overview`, {}, 2500)
      if (res.ok) return await res.json()
    } catch {}
    return mockTeamOverview
  },

  async getTeamNvaSummary(): Promise<NVASummaryData> {
    if (CONFIG.USE_MOCK) {
      return Promise.resolve(mockNvaSummary)
    }
    try {
      const res = await fetchWithFallback(`/api/team/nva-summary`, {}, 2500)
      if (res.ok) return await res.json()
    } catch {}
    return mockNvaSummary
  },

  async getAiInsights(): Promise<InsightsResponse> {
    if (CONFIG.USE_MOCK) {
      return Promise.resolve(mockAiInsights)
    }
    try {
      const res = await fetchWithFallback(`/api/insights`, {}, 2500)
      if (res.ok) return await res.json()
    } catch {}
    return mockAiInsights
  },

  async setActiveClaim(
    associateId: string = 'EMP101',
    claimId: string,
    actionTypeOrPatient?: string,
    targetMinutes?: number,
    targetSeconds?: number,
    patientName?: string
  ): Promise<{ associate_id: string; active_claim_id: string }> {
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

    const storageKey = `tms_active_claim_${associateId}`
    try {
      if (claimId === 'UNASSIGNED') {
        localStorage.removeItem(storageKey)
        localStorage.removeItem('tms_active_claim')
      } else {
        localStorage.setItem(storageKey, JSON.stringify({
          claim_id: claimId,
          action_type: actionType,
          target_minutes: targetMinutes,
          target_seconds: targetSeconds,
          timestamp: Date.now()
        }))
      }
    } catch {}

    mockAssociateToday.active_claim_id = claimId
    mockAssociateToday.active_claim_type = actionType || 'CR - Call / IVR'
    mockAssociateToday.active_target_minutes = targetMinutes || 14
    mockAssociateToday.active_target_seconds = targetSeconds || (targetMinutes ? targetMinutes * 60 : 840)

    if (CONFIG.USE_MOCK) {
      return Promise.resolve({ associate_id: associateId, active_claim_id: claimId })
    }

    try {
      const res = await fetchWithFallback(`/api/associate/${associateId}/active-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_id: claimId,
          patient_name: patient,
          action_type: actionType || undefined,
          target_minutes: targetMinutes || undefined,
          target_seconds: targetSeconds || undefined,
          status: 'IN_PROGRESS'
        })
      }, 2500)
      if (res.ok) {
        return await res.json()
      }
    } catch {}

    return { associate_id: associateId, active_claim_id: claimId }
  },

  async resolveAlert(alertType: string, associateId: string): Promise<any> {
    try {
      const res = await fetchWithFallback(`/api/team/alerts/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: alertType, associate_id: associateId })
      }, 2500)
      if (res.ok) return await res.json()
    } catch (err) {
      console.warn('[API] resolveAlert failed:', err)
    }
    return { status: 'fallback_resolved' }
  },

  async ingestEvents(events: any[]): Promise<any> {
    try {
      const res = await fetchWithFallback(`/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events })
      }, 2500)
      if (res.ok) return await res.json()
    } catch (err) {
      return { received: events.length, status: 'fallback_ok' }
    }
    return { received: events.length, status: 'fallback_ok' }
  },

  async completeClaim(associateId: string = 'EMP101', claimId: string): Promise<any> {
    try {
      const res = await fetchWithFallback(`/api/associate/${associateId}/claims/${claimId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED', export_excel: true })
      }, 3000)
      if (res.ok) return await res.json()
    } catch (err) {
      console.warn('[API] completeClaim fallback:', err)
    }
    return { status: 'fallback_completed', claim_id: claimId }
  },

  async updateClaimStatus(associateId: string = 'EMP101', claimId: string, status: string): Promise<any> {
    try {
      const res = await fetchWithFallback(`/api/associate/${associateId}/claims/${claimId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      }, 3000)
      if (res.ok) return await res.json()
    } catch (err) {
      console.warn('[API] updateClaimStatus fallback:', err)
    }
    return { status: 'fallback_updated', claim_id: claimId, new_status: status }
  },

  async getPendingClaims(associateId: string = 'EMP101'): Promise<PendingClaimItem[]> {
    if (CONFIG.USE_MOCK) return Promise.resolve([])
    try {
      const res = await fetchWithFallback(`/api/associate/${associateId}/pending-claims?employee_id=${associateId}`, {}, 2500)
      if (res.ok) {
        return await res.json()
      }
    } catch (err) {
      console.warn('[API] getPendingClaims failed, returning empty list:', err)
    }
    return []
  }
}
