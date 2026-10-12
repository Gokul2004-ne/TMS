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
  claim_id: 'CLM1001',
  associate_id: 'EMP101',
  start_time: '2026-10-12T09:00:00Z',
  end_time: '2026-10-12T09:12:30Z',
  total_duration_seconds: 750,
  active_duration_seconds: 680,
  idle_duration_seconds: 70,
  app_switches_count: 5,
  status: 'COMPLETED',
  nva_flags: ['EXCEL_OVERUSE'],
  app_breakdowns: [
    { app_name: 'NovaArc RCM', duration_seconds: 350, percentage: 46.7, color: '#4338ca' },
    { app_name: 'Microsoft Excel', duration_seconds: 300, percentage: 40.0, color: '#107c41' },
    { app_name: 'Availity Essentials', duration_seconds: 100, percentage: 13.3, color: '#0284c7' }
  ],
  raw_events: [
    {
      id: 1,
      event_type: 'CLAIM_DETECTED',
      app_name: 'NovaArc RCM',
      window_title: 'NovaArc RCM - Claims Queue - Claim #CLM1001',
      url: 'https://novaarc.local/claims',
      page_header: 'Claims Management & Adjudication',
      used_for: 'Claim Adjudication',
      timestamp: '2026-10-12T09:00:00Z',
      is_idle: false
    },
    {
      id: 2,
      event_type: 'APP_SWITCH',
      app_name: 'Microsoft Excel',
      window_title: 'Payer_Fee_Schedule_2026.xlsx - Excel',
      url: 'Payer_Fee_Schedule_2026.xlsx',
      page_header: 'Payer Fee Schedule Worksheet',
      used_for: 'Rate Lookup',
      timestamp: '2026-10-12T09:03:15Z',
      is_idle: false
    },
    {
      id: 3,
      event_type: 'APP_SWITCH',
      app_name: 'Availity Essentials',
      window_title: 'Availity - Patient Insurance Eligibility Inquiry',
      url: 'https://availity.com/eligibility',
      page_header: 'Eligibility & Benefits / Claim Status',
      used_for: 'Payer Clearinghouse',
      timestamp: '2026-10-12T09:07:45Z',
      is_idle: false
    },
    {
      id: 4,
      event_type: 'CLAIM_CLOSED',
      app_name: 'NovaArc RCM',
      window_title: 'NovaArc RCM - Claims Queue - Claim #CLM1001',
      url: 'https://novaarc.local/claims',
      page_header: 'Claim Resolution & Closure',
      used_for: 'Claim Adjudication',
      timestamp: '2026-10-12T09:12:30Z',
      is_idle: false
    }
  ]
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
