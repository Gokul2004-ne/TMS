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
let cachedBufferByAssociate: Record<string, number> = {}
let lastBufferHydrationMs = 0

function getApiBases(): string[] {
  const list: string[] = []
  const now = Date.now()
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
  const isPagesDev = typeof window !== 'undefined' && window.location.hostname.endsWith('.pages.dev')

  // 1. If we have a cached working base that worked recently, prioritize it
  if (cachedWorkingBase && (now - lastWorkingBaseCheck < 60000)) {
    if (!isHttps || (cachedWorkingBase.startsWith('https://') && !cachedWorkingBase.includes('187.127.207.41'))) {
      list.push(cachedWorkingBase)
    }
  }

  if (isHttps) {
    // Same-origin Cloudflare Pages Function proxy (/tms-api -> Hostinger) bypasses Hostinger CORS restrictions
    if (isPagesDev && typeof window !== 'undefined') {
      list.push(`${window.location.origin}/tms-api`)
    }
    if (CONFIG.API_BASE && CONFIG.API_BASE.startsWith('https://') && !CONFIG.API_BASE.includes('187.127.207.41')) {
      list.push(CONFIG.API_BASE)
    }
    list.push('https://frccind.com/tms-api')
  } else {
    // Localhost endpoints for ultra-low latency (<5ms) when running local agent / backend
    const isLocalHost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    
    if (isLocalHost && typeof window !== 'undefined') {
      // Proxy locally via Vite /tms-api -> Live Hostinger Cloud DB so localhost also uses Live DB
      list.push(`${window.location.origin}/tms-api`)
    }

    if (CONFIG.API_BASE && !CONFIG.API_BASE.includes('onrender.com') && !CONFIG.API_BASE.includes('catalystappsail') && !CONFIG.API_BASE.includes('localhost') && !CONFIG.API_BASE.includes('127.0.0.1')) {
      list.push(CONFIG.API_BASE)
    }

    list.push('https://frccind.com/tms-api')
    list.push('http://187.127.207.41:8080')
  }

  return Array.from(new Set(list.filter(Boolean)))
}

async function fetchWithFallback(endpoint: string, options: RequestInit = {}, timeoutMs: number = 3000): Promise<Response> {
  const bases = getApiBases()
  let lastError: any = null

  for (const base of bases) {
    const url = `${base}${endpoint}`
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      const res = await fetch(url, {
        ...options,
        signal: controller.signal
      })
      clearTimeout(timer)

      if (res.ok || res.status === 404 || res.status === 400 || res.status === 401 || res.status === 409 || res.status === 422) {
        cachedWorkingBase = base
        lastWorkingBaseCheck = Date.now()
        return res
      }
    } catch (err: any) {
      lastError = err
    }
  }

  throw lastError || new Error(`All backend candidates failed for ${endpoint}`)
}

export interface WorkstationLockStatus {
  locked: boolean
  ownerDevice?: string
  activeClaimId?: string | null
  existingSameDeviceSessionId?: string
  reason?: string
}

function parseSessionWorkstationTag(sessionId?: string | null): { device?: string; epochSec?: number } {
  if (!sessionId) return {}
  const m = sessionId.toLowerCase().match(/-d([a-z0-9]{6,12})-t(\d{9,13})/)
  if (!m) return {}
  const epochSec = Number(m[2])
  return {
    device: m[1],
    epochSec: Number.isFinite(epochSec) ? epochSec : undefined
  }
}

export const api = {
  // --- Auth & Per-Workstation Lock APIs ---
  async login(userId: string, password: string = 'demo1234', role?: string, deviceId?: string): Promise<any> {
    if (CONFIG.USE_MOCK) {
      return null
    }
    try {
      const res = await fetchWithFallback(`/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, password, role, device_id: deviceId })
      }, 3000)
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}))
        const err: any = new Error(body.detail || `Employee ${userId} is already logged in on another workstation.`)
        err.isLockConflict = true
        throw err
      }
      if (res.status === 401) {
        const err: any = new Error('Invalid credentials.')
        err.isAuthError = true
        throw err
      }
      if (res.ok) {
        return await res.json()
      }
    } catch (err: any) {
      if (err?.isLockConflict || err?.isAuthError) {
        throw err
      }
      console.warn('[API] login network call unavailable, checking session lock fallback:', err)
    }
    return null
  },

  async checkWorkstationLock(associateId: string, myDeviceId: string): Promise<WorkstationLockStatus> {
    if (CONFIG.USE_MOCK) {
      return { locked: false }
    }
    const cleanId = associateId.trim().toUpperCase()
    const cleanDev = myDeviceId.trim().toLowerCase()

    // 1. Optional backend auth lock-status endpoint (succeeds when updated backend is live)
    try {
      const rLock = await fetchWithFallback(`/api/auth/lock-status/${cleanId}?device_id=${encodeURIComponent(cleanDev)}`, {}, 2000)
      if (rLock.ok) {
        const data = await rLock.json()
        if (data.locked) {
          const owner = String(data.owner_device || 'OTHER').toUpperCase()
          return {
            locked: true,
            ownerDevice: owner,
            reason: `Employee ${cleanId} is already signed in on workstation DEV-${owner}. Concurrent logins for the same Employee ID are blocked.`
          }
        }
      }
    } catch {
      // Fall through to live Hostinger session/team inspection
    }

    // 2. Live Hostinger compatible lock detection via /today + /team/overview
    try {
      const [todayRes, teamRes] = await Promise.all([
        fetchWithFallback(`/api/associate/${cleanId}/today?employee_id=${cleanId}`, {}, 3500).catch(() => null),
        fetchWithFallback(`/api/team/overview`, {}, 3500).catch(() => null)
      ])

      const todayData: any = todayRes && todayRes.ok ? await todayRes.json() : null
      const teamData: any = teamRes && teamRes.ok ? await teamRes.json() : null
      const teamRow = (teamData?.associates || []).find(
        (a: any) => String(a.associate_id || '').trim().toUpperCase() === cleanId
      )
      const teamStatus = String(teamRow?.status || 'OFFLINE').toUpperCase()

      if (todayData) {
        const sessId = String(todayData.session_id || '')
        const isActiveSess = Boolean(todayData.is_active)
        const activeClaim = todayData.active_claim_id && todayData.active_claim_id !== 'UNASSIGNED' ? String(todayData.active_claim_id) : null
        const parsed = parseSessionWorkstationTag(sessId)

        if (parsed.device) {
          if (parsed.device.toLowerCase() === cleanDev) {
            return {
              locked: false,
              existingSameDeviceSessionId: isActiveSess ? sessId : undefined
            }
          }
          const ageSec = parsed.epochSec ? Math.max(0, Math.floor(Date.now() / 1000) - parsed.epochSec) : 999999
          const isLiveOther =
            isActiveSess &&
            (teamStatus === 'ACTIVE' || teamStatus === 'IDLE' || ageSec < 900 || Boolean(activeClaim))

          if (isLiveOther) {
            const ownerUpper = parsed.device.toUpperCase()
            return {
              locked: true,
              ownerDevice: ownerUpper,
              activeClaimId: activeClaim,
              reason: `Employee ${cleanId} is already signed in on workstation DEV-${ownerUpper}${activeClaim ? ` (tracking ${activeClaim})` : ''}. Sign out there first or choose a different Employee ID.`
            }
          }
        } else if (teamStatus === 'ACTIVE' || teamStatus === 'IDLE') {
          return {
            locked: true,
            ownerDevice: 'ACTIVE-PC',
            activeClaimId: activeClaim || teamRow?.current_claim_id || null,
            reason: `Employee ${cleanId} is currently active on another workstation. Sign out or stop the desktop agent on that PC first.`
          }
        }
      }
    } catch (err) {
      console.warn('[API] checkWorkstationLock fallback:', err)
    }

    return { locked: false }
  },

  async startWorkstationSession(associateId: string, sessionId: string, deviceId: string): Promise<void> {
    if (CONFIG.USE_MOCK) return
    const res = await fetchWithFallback(`/api/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        associate_id: associateId,
        session_id: sessionId,
        device_id: deviceId
      })
    }, 3500)
    if (res.status === 409) {
      const body = await res.json().catch(() => ({}))
      const err: any = new Error(body.detail || `Employee ${associateId} is already logged in on another workstation.`)
      err.isLockConflict = true
      throw err
    }
  },

  async sendWorkstationHeartbeat(associateId: string, sessionId: string, deviceId: string): Promise<void> {
    if (CONFIG.USE_MOCK) return
    try {
      await fetchWithFallback(`/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: [{
            associate_id: associateId,
            session_id: sessionId,
            claim_id: 'UNASSIGNED',
            event_type: 'HEARTBEAT',
            app_name: 'TMS Dashboard',
            window_title: `Workstation Sign-In (${associateId} · DEV-${deviceId.toUpperCase()})`,
            url: '',
            page_header: 'Workstation Lock',
            used_for: `device:${deviceId}`,
            timestamp: new Date().toISOString(),
            is_idle: false,
            is_buffer: false,
            agent_version: '1.0.3'
          }]
        })
      }, 2500)
    } catch {
      // best effort heartbeat
    }
  },

  async endWorkstationSession(associateId: string, sessionId?: string | null, deviceId?: string): Promise<void> {
    if (CONFIG.USE_MOCK) return
    const cleanId = associateId.trim().toUpperCase()
    const ops: Promise<any>[] = [
      fetchWithFallback(`/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: cleanId, session_id: sessionId, device_id: deviceId })
      }, 2000).catch(() => null),
      fetchWithFallback(`/api/associate/${cleanId}/active-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim_id: 'UNASSIGNED', status: 'LOGGED_OUT' })
      }, 2500).catch(() => null)
    ]
    if (sessionId) {
      ops.push(
        fetchWithFallback(`/api/sessions/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, associate_id: cleanId, device_id: deviceId })
        }, 2500).catch(() => null)
      )
    }
    await Promise.all(ops)
  },

  async getMe(token?: string, userId?: string): Promise<any> {
    try {
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      if (userId) headers['X-User-Id'] = userId
      const res = await fetchWithFallback(`/api/auth/me`, { headers }, 2500)
      if (res.ok) return await res.json()
    } catch (err) {
      console.warn('[API] getMe fallback:', err)
    }
    return null
  },

  async getUsers(): Promise<any[]> {
    try {
      const res = await fetchWithFallback(`/api/auth/users`, {}, 2500)
      if (res.ok) return await res.json()
    } catch (err) {
      console.warn('[API] getUsers fallback:', err)
    }
    return []
  },

  // --- Associate & Claims APIs ---
  async getAssociateToday(associateId: string = 'EMP101'): Promise<AssociateTodayData> {
    if (CONFIG.USE_MOCK) {
      return Promise.resolve(mockAssociateToday)
    }
    try {
      const res = await fetchWithFallback(`/api/associate/${associateId}/today?employee_id=${associateId}`)
      if (res.ok) {
        return await res.json()
      }
    } catch (err) {
      console.warn(`[API] getAssociateToday failed for ${associateId}, falling back to mock fixtures:`, err)
    }
    return {
      ...mockAssociateToday,
      associate_id: associateId,
      associate_name: `Associate ${associateId}`
    }
  },

  async getAssociateClaims(associateId: string = 'EMP101'): Promise<ClaimTimelineItem[]> {
    if (CONFIG.USE_MOCK) {
      return Promise.resolve(mockAssociateToday.recent_claims)
    }
    try {
      const res = await fetchWithFallback(`/api/associate/${associateId}/claims?employee_id=${associateId}`)
      if (res.ok) {
        return await res.json()
      }
    } catch (err) {
      console.warn(`[API] getAssociateClaims failed for ${associateId}:`, err)
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
    try {
      const res = await fetchWithFallback(`/api/associate/${associateId}/claims/${claimId}/timeline?employee_id=${associateId}`)
      if (res.ok) {
        return await res.json()
      }
    } catch (err) {
      console.warn(`[API] getClaimTimeline failed for ${claimId}:`, err)
    }
    return {
      ...mockClaimTimelineDetail,
      claim_id: claimId,
      associate_id: associateId
    }
  },

  async getTeamOverview(): Promise<TeamOverviewData> {
    if (CONFIG.USE_MOCK) {
      return Promise.resolve(mockTeamOverview)
    }
    try {
      const res = await fetchWithFallback(`/api/team/overview`)
      if (res.ok) {
        return await res.json()
      }
    } catch (err) {
      console.warn('[API] getTeamOverview failed:', err)
    }
    return mockTeamOverview
  },

  async getEnrichedTeamOverview(): Promise<TeamOverviewData> {
    const team = await this.getTeamOverview()
    if (CONFIG.USE_MOCK || !team?.associates?.length) {
      return team
    }

    const nowMs = Date.now()
    const needsHydration = team.associates.some(
      a => a.system_buffer_seconds === undefined && (a.status === 'ACTIVE' || a.completed_claims > 0)
    )
    if (needsHydration && (nowMs - lastBufferHydrationMs > 3000 || Object.keys(cachedBufferByAssociate).length === 0)) {
      lastBufferHydrationMs = nowMs
      const candidates = team.associates
        .filter(a => a.status === 'ACTIVE' || a.completed_claims > 0)
        .slice(0, 8)
      await Promise.allSettled(
        candidates.map(async a => {
          try {
            const detail = await this.getAssociateToday(a.associate_id)
            const buf = detail.total_system_buffer_seconds ?? detail.system_buffer_seconds
            if (typeof buf === 'number') {
              cachedBufferByAssociate[a.associate_id] = buf
            }
          } catch {}
        })
      )
    }

    const mergedAssociates = team.associates.map(a => ({
      ...a,
      system_buffer_seconds: a.system_buffer_seconds ?? cachedBufferByAssociate[a.associate_id] ?? 0
    }))
    const totalBuf =
      team.team_system_buffer_seconds ??
      mergedAssociates.reduce((acc, a) => acc + (a.system_buffer_seconds || 0), 0)

    return {
      ...team,
      team_system_buffer_seconds: totalBuf,
      associates: mergedAssociates
    }
  },

  async getTeamNvaSummary(): Promise<NVASummaryData> {
    if (CONFIG.USE_MOCK) {
      return Promise.resolve(mockNvaSummary)
    }
    try {
      const res = await fetchWithFallback(`/api/team/nva-summary`)
      if (res.ok) {
        return await res.json()
      }
    } catch (err) {
      console.warn('[API] getTeamNvaSummary failed:', err)
    }
    return mockNvaSummary
  },

  async getAiInsights(): Promise<InsightsResponse> {
    if (CONFIG.USE_MOCK) {
      return Promise.resolve(mockAiInsights)
    }
    try {
      const res = await fetchWithFallback(`/api/insights`)
      if (res.ok) {
        return await res.json()
      }
    } catch (err) {
      console.warn('[API] getAiInsights failed:', err)
    }
    return mockAiInsights
  },

  async setActiveClaim(
    associateId: string = 'EMP101',
    claimId: string,
    patientName?: string,
    actionType: string = "CR - Call / IVR",
    targetMinutes: number = 14,
    targetSeconds: number = 840
  ): Promise<any> {
    try {
      const res = await fetchWithFallback(`/api/associate/${associateId}/active-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_id: claimId,
          patient_name: patientName || '',
          status: 'IN_PROGRESS',
          action_type: actionType,
          target_minutes: targetMinutes,
          target_seconds: targetSeconds
        })
      }, 2500)
      if (res.ok) return await res.json()
    } catch (err) {
      console.warn('[API] setActiveClaim fallback:', err)
    }
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
    if (CONFIG.USE_MOCK) return Promise.resolve(mockPendingClaims)
    try {
      const res = await fetchWithFallback(`/api/associate/${associateId}/pending-claims?employee_id=${associateId}`, {}, 2500)
      if (res.ok) {
        return await res.json()
      }
    } catch (err) {
      console.warn('[API] getPendingClaims failed, returning fallback list:', err)
    }
    return mockPendingClaims
  }
}
