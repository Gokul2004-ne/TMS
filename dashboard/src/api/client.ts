import { CONFIG } from '../config'
import {
  AssociateTodayData,
  ClaimTimelineItem,
  ClaimTimelineDetail,
  TeamOverviewData,
  NVASummaryData,
  InsightsResponse
} from './types'
import {
  mockAssociateToday,
  mockClaimTimelineDetail,
  mockTeamOverview,
  mockNvaSummary,
  mockAiInsights
} from './mock'

export const api = {
  async getAssociateToday(associateId: string = 'EMP101'): Promise<AssociateTodayData> {
    if (CONFIG.USE_MOCK) {
      return Promise.resolve(mockAssociateToday)
    }
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/associate/${associateId}/today`)
      if (!res.ok) throw new Error('Network error')
      return await res.json()
    } catch (err) {
      console.warn('[API] Backend unreachable, falling back to mock fixtures.', err)
      return mockAssociateToday
    }
  },

  async getAssociateClaims(associateId: string = 'EMP101'): Promise<ClaimTimelineItem[]> {
    if (CONFIG.USE_MOCK) {
      return Promise.resolve(mockAssociateToday.recent_claims)
    }
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/associate/${associateId}/claims`)
      if (!res.ok) throw new Error('Network error')
      return await res.json()
    } catch (err) {
      return mockAssociateToday.recent_claims
    }
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
      const res = await fetch(`${CONFIG.API_BASE}/api/associate/${associateId}/claims/${claimId}/timeline`)
      if (!res.ok) throw new Error('Network error')
      return await res.json()
    } catch (err) {
      return {
        ...mockClaimTimelineDetail,
        claim_id: claimId,
        associate_id: associateId
      }
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
  }
}
