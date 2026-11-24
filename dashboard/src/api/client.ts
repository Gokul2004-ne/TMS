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
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'

  // 1. Prioritize working cache
  if (cachedWorkingBase) {
    if (!isHttps || (cachedWorkingBase.startsWith('https://') && !cachedWorkingBase.includes('187.127.207.41'))) {
      list.push(cachedWorkingBase)
    }
  }

  if (isHttps) {
    // 2. Prioritize secure HTTPS backend on Hostinger VPS
    list.push('https://frccind.com/tms-api')
    if (CONFIG.API_BASE && CONFIG.API_BASE.startsWith('https://') && !CONFIG.API_BASE.includes('187.127.207.41')) {
      list.push(CONFIG.API_BASE)
    }
  } else {
    // 2. Direct Hostinger VPS backend (production reliable endpoint)
    if (CONFIG.API_BASE && !CONFIG.API_BASE.includes('onrender.com')) {
      list.push(CONFIG.API_BASE)
    }
    list.push('http://localhost:8000')
    list.push('http://127.0.0.1:8000')
    list.push('https://frccind.com/tms-api')
    list.push('http://187.127.207.41:8080')
  }

  return Array.from(new Set(list.filter(Boolean)))
}

export function cleanAssociateId(id?: string): string {
  if (!id) return 'EMP101'
  try {
    const unquoted = decodeURIComponent(id)
    const lines = unquoted.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    const token = lines[0] || unquoted.trim()
    return token.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase() || 'EMP101'
  } catch {
    return (id || 'EMP101').replace(/[^A-Za-z0-9_-]/g, '').toUpperCase() || 'EMP101'
  }
}

async function fetchWithFallback(path: string, options: RequestInit = {}, timeoutMs: number = 10000): Promise<Response> {
  const bases = getApiBases()
  for (const base of bases) {
    try {
      const isLocal = base.includes('localhost') || base.includes('127.0.0.1')
      const effTimeout = isLocal ? Math.min(timeoutMs, 1000) : timeoutMs
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), effTimeout)
      const res = await fetch(`${base}${path}`, {
        mode: 'cors',
        ...options,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          ...(options.headers || {})
        }
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

// In-flight request deduplication and Stale-While-Revalidate (SWR) caching layer
const inFlightRequests = new Map<string, Promise<any>>()
const responseCache = new Map<string, { data: any; timestamp: number }>()

export async function dedupeFetch<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 3000
): Promise<T> {
  const now = Date.now()
  const cached = responseCache.get(cacheKey)

  // In-flight deduplication
  if (inFlightRequests.has(cacheKey)) {
    if (cached) {
      return cached.data
    }
    return inFlightRequests.get(cacheKey)!
  }

  // Fresh cache hit
  if (cached && (now - cached.timestamp < ttlMs)) {
    return cached.data
  }

  // Stale-While-Revalidate: Return stale data immediately to prevent blank/zero flickers, revalidate in background
  if (cached) {
    const revalidatePromise = (async () => {
      try {
        const freshData = await fetcher()
        responseCache.set(cacheKey, { data: freshData, timestamp: Date.now() })
        return freshData
      } catch {
        return cached.data
      } finally {
        inFlightRequests.delete(cacheKey)
      }
    })()
    inFlightRequests.set(cacheKey, revalidatePromise)
    return cached.data
  }

  // Cold fetch
  const promise = (async () => {
    try {
      const data = await fetcher()
      responseCache.set(cacheKey, { data, timestamp: Date.now() })
      return data
    } finally {
      inFlightRequests.delete(cacheKey)
    }
  })()

  inFlightRequests.set(cacheKey, promise)
  return promise
}

export function invalidateApiCache(pattern?: string) {
  if (!pattern) {
    responseCache.clear()
    return
  }
  for (const key of responseCache.keys()) {
    if (key.includes(pattern)) {
      responseCache.delete(key)
    }
  }
}

export const api = {
  async getAssociateToday(associateId: string = 'EMP101'): Promise<AssociateTodayData> {
    const cleanId = cleanAssociateId(associateId)
    if (CONFIG.USE_MOCK) {
      return Promise.resolve(mockAssociateToday)
    }

    return dedupeFetch(`associate_today_${cleanId}`, async () => {
      try {
        const res = await fetchWithFallback(`/api/associate/${cleanId}/today`, {}, 4000)
        if (res.ok) {
          const json = await res.json()
          const storageKey = `tms_active_claim_${cleanId}`
          if (!json.active_claim_id || json.active_claim_id === 'UNASSIGNED') {
            try {
              localStorage.removeItem(storageKey)
              localStorage.removeItem('tms_active_claim')
            } catch { }
          } else {
            try {
              localStorage.setItem(storageKey, JSON.stringify({
                claim_id: json.active_claim_id,
                action_type: json.active_claim_type,
                target_minutes: json.active_target_minutes,
                target_seconds: json.active_target_seconds,
                timestamp: Date.now()
              }))
            } catch { }
          }
          return json
        }
      } catch (err) { }

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
        } catch { }
      }
      return mockAssociateToday
    }, 1000)
  },

  async getAssociateClaims(associateId: string = 'EMP101'): Promise<ClaimTimelineItem[]> {
    associateId = cleanAssociateId(associateId)
    if (CONFIG.USE_MOCK) {
      return Promise.resolve(mockAssociateToday.recent_claims)
    }
    return dedupeFetch(`associate_claims_${associateId}`, async () => {
      try {
        const res = await fetchWithFallback(`/api/associate/${associateId}/claims`, {}, 8000)
        if (res.ok) {
          return await res.json()
        }
      } catch { }
      return mockAssociateToday.recent_claims
    }, 5000)
  },

  async getClaimTimeline(associateId: string, claimId: string): Promise<ClaimTimelineDetail> {
    associateId = cleanAssociateId(associateId)
    const cleanCid = (claimId || '').trim().toUpperCase()
    if (CONFIG.USE_MOCK) {
      return Promise.resolve({
        ...mockClaimTimelineDetail,
        claim_id: cleanCid,
        associate_id: associateId
      })
    }

    return dedupeFetch(`claim_timeline_${associateId}_${cleanCid}`, async () => {
      try {
        const res = await fetchWithFallback(`/api/associate/${associateId}/claims/${cleanCid}/timeline`, {}, 8000)
        if (res.ok) {
          return await res.json()
        }
      } catch { }

      console.warn(`[API] Failed to fetch timeline for claim ${cleanCid} from all bases, using fallback.`)
      return {
        claim_id: cleanCid,
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
    }, 8000)
  },

  async getTeamOverview(retries = 2): Promise<TeamOverviewData> {
    if (CONFIG.USE_MOCK) {
      return Promise.resolve(mockTeamOverview)
    }
    return dedupeFetch('team_overview', async () => {
      let lastErr: any = null
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const timeoutMs = 6000 + (attempt * 2000)
          const res = await fetchWithFallback(`/api/team/overview`, {}, timeoutMs)
          if (res.ok) return await res.json()
        } catch (err) {
          lastErr = err
          if (attempt < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 600))
          }
        }
      }
      console.warn('[API] getTeamOverview failed after retries, falling back to resilient state:', lastErr)
      return mockTeamOverview
    }, 10000)
  },

  async getTeamNvaSummary(retries = 2): Promise<NVASummaryData> {
    if (CONFIG.USE_MOCK) {
      return Promise.resolve(mockNvaSummary)
    }
    return dedupeFetch('team_nva_summary', async () => {
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const timeoutMs = 5000 + (attempt * 2000)
          const res = await fetchWithFallback(`/api/team/nva-summary`, {}, timeoutMs)
          if (res.ok) return await res.json()
        } catch {
          if (attempt < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }
      }
      return mockNvaSummary
    }, 10000)
  },

  async getAiInsights(): Promise<InsightsResponse> {
    if (CONFIG.USE_MOCK) {
      return Promise.resolve(mockAiInsights)
    }
    return dedupeFetch('ai_insights', async () => {
      try {
        const res = await fetchWithFallback(`/api/insights`, {}, 4000)
        if (res.ok) return await res.json()
      } catch { }
      return mockAiInsights
    }, 15000)
  },

  async setActiveClaim(
    associateId: string = 'EMP101',
    claimId: string,
    actionTypeOrPatient?: string,
    targetMinutes?: number,
    targetSeconds?: number,
    patientName?: string
  ): Promise<{ associate_id: string; active_claim_id: string }> {
    associateId = cleanAssociateId(associateId)
    invalidateApiCache(associateId)
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
    } catch { }

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
    } catch { }

    return { associate_id: associateId, active_claim_id: claimId }
  },

  async resolveAlert(alertType: string, associateId: string): Promise<any> {
    associateId = cleanAssociateId(associateId)
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
    associateId = cleanAssociateId(associateId)
    invalidateApiCache(associateId)
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
    associateId = cleanAssociateId(associateId)
    invalidateApiCache(associateId)
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

  async getPendingClaims(associateId: string = 'EMP101', retries = 2): Promise<PendingClaimItem[]> {
    associateId = cleanAssociateId(associateId)
    if (CONFIG.USE_MOCK) return Promise.resolve([])
    return dedupeFetch(`pending_claims_${associateId}`, async () => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const timeoutMs = 8000 + (attempt * 2000)
          const res = await fetchWithFallback(`/api/associate/${associateId}/pending-claims?employee_id=${associateId}`, {}, timeoutMs)
          if (res.ok) {
            return await res.json()
          }
        } catch (err) {
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 500))
          } else {
            console.warn('[API] getPendingClaims failed, returning empty list:', err)
          }
        }
      }
      return []
    }, 5000)
  }
}
