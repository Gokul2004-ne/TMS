import {
  AssociateTodayData,
  ClaimTimelineDetail,
  TeamOverviewData,
  NVASummaryData,
  InsightsResponse
} from './types'

export const mockAssociateToday: AssociateTodayData = {
  associate_id: 'EMP101',
  associate_name: 'Associate EMP101',
  session_id: null,
  is_active: false,
  target_claims: 0,
  completed_claims_count: 0,
  aht_minutes: 0,
  total_work_seconds: 0,
  total_active_seconds: 0,
  total_idle_seconds: 0,
  idle_percentage: 0,
  efficiency_score: 100,
  active_claim_id: null,
  app_distribution: [],
  recent_claims: []
}

export const mockClaimTimelineDetail: ClaimTimelineDetail = {
  claim_id: '',
  associate_id: 'EMP101',
  start_time: '',
  end_time: null,
  total_duration_seconds: 0,
  active_duration_seconds: 0,
  idle_duration_seconds: 0,
  app_switches_count: 0,
  status: 'IN_PROGRESS',
  nva_flags: [],
  app_breakdowns: [],
  raw_events: []
}

export const mockTeamOverview: TeamOverviewData = {
  date: new Date().toISOString().split('T')[0],
  total_associates: 0,
  active_associates_count: 0,
  total_claims_completed: 0,
  team_aht_minutes: 0,
  team_idle_percentage: 0,
  team_efficiency_score: 100,
  associates: [],
  active_alerts: []
}

export const mockNvaSummary: NVASummaryData = {
  date: new Date().toISOString().split('T')[0],
  excel_overuse_claims_count: 0,
  app_switching_spikes_count: 0,
  long_idle_incidents_count: 0,
  outlier_claims_count: 0,
  rework_claims_count: 0,
  total_nva_time_lost_hours: 0,
  top_nva_category: 'NONE',
  breakdown_by_category: {
    EXCEL_OVERUSE: 0,
    APP_SWITCHING: 0,
    LONG_IDLE: 0,
    OUTLIER: 0,
    REWORK: 0
  }
}

export const mockAiInsights: InsightsResponse = {
  timestamp: new Date().toISOString(),
  is_ai_live: true,
  insights: []
}
