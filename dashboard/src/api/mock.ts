import {
  AssociateTodayData,
  ClaimTimelineItem,
  ClaimTimelineDetail,
  TeamOverviewData,
  NVASummaryData,
  InsightsResponse
} from './types'

export const mockAssociateToday: AssociateTodayData = {
  associate_id: 'EMP101',
  associate_name: 'Priya Sharma',
  session_id: 'sess-alpha-001',
  is_active: true,
  target_claims: 40,
  completed_claims_count: 27,
  aht_minutes: 7.4,
  total_work_seconds: 19440,
  total_active_seconds: 17200,
  total_idle_seconds: 2240,
  idle_percentage: 11.5,
  efficiency_score: 88.5,
  active_claim_id: 'CLM1028',
  app_distribution: [
    { app_name: 'ClaimPlatform', duration_seconds: 7800, percentage: 45.3, color: '#8b5cf6' },
    { app_name: 'Chrome', duration_seconds: 5100, percentage: 29.7, color: '#38bdf8' },
    { app_name: 'Excel', duration_seconds: 3200, percentage: 18.6, color: '#10b981' },
    { app_name: 'BillingPortal', duration_seconds: 1100, percentage: 6.4, color: '#6366f1' }
  ],
  recent_claims: [
    {
      claim_id: 'CLM1028',
      associate_id: 'EMP101',
      session_id: 'sess-alpha-001',
      start_time: '2026-10-06T14:55:00Z',
      end_time: null,
      total_duration_seconds: 380,
      active_duration_seconds: 360,
      idle_duration_seconds: 20,
      app_switches_count: 3,
      status: 'IN_PROGRESS',
      nva_flags: [],
      app_breakdown: { ClaimPlatform: 240, Chrome: 120 }
    },
    {
      claim_id: 'CLM1027',
      associate_id: 'EMP101',
      session_id: 'sess-alpha-001',
      start_time: '2026-10-06T14:45:00Z',
      end_time: '2026-10-06T14:52:10Z',
      total_duration_seconds: 430,
      active_duration_seconds: 410,
      idle_duration_seconds: 20,
      app_switches_count: 4,
      status: 'COMPLETED',
      nva_flags: [],
      app_breakdown: { ClaimPlatform: 260, Chrome: 150 }
    },
    {
      claim_id: 'CLM1026',
      associate_id: 'EMP101',
      session_id: 'sess-alpha-001',
      start_time: '2026-10-06T14:28:00Z',
      end_time: '2026-10-06T14:43:00Z',
      total_duration_seconds: 900,
      active_duration_seconds: 750,
      idle_duration_seconds: 150,
      app_switches_count: 12,
      status: 'COMPLETED',
      nva_flags: ['EXCEL_OVERUSE', 'APP_SWITCHING'],
      app_breakdown: { ClaimPlatform: 310, Excel: 390, Chrome: 50 }
    },
    {
      claim_id: 'CLM1025',
      associate_id: 'EMP101',
      session_id: 'sess-alpha-001',
      start_time: '2026-10-06T14:15:00Z',
      end_time: '2026-10-06T14:25:00Z',
      total_duration_seconds: 600,
      active_duration_seconds: 580,
      idle_duration_seconds: 20,
      app_switches_count: 5,
      status: 'COMPLETED',
      nva_flags: [],
      app_breakdown: { ClaimPlatform: 350, Chrome: 230 }
    },
    {
      claim_id: 'CLM1024',
      associate_id: 'EMP101',
      session_id: 'sess-alpha-001',
      start_time: '2026-10-06T13:45:00Z',
      end_time: '2026-10-06T14:10:00Z',
      total_duration_seconds: 1500,
      active_duration_seconds: 1200,
      idle_duration_seconds: 300,
      app_switches_count: 16,
      status: 'COMPLETED',
      nva_flags: ['OUTLIER', 'LONG_IDLE', 'APP_SWITCHING'],
      app_breakdown: { ClaimPlatform: 500, Chrome: 450, Excel: 250 }
    }
  ]
}

export const mockClaimTimelineDetail: ClaimTimelineDetail = {
  claim_id: 'CLM1026',
  associate_id: 'EMP101',
  start_time: '2026-10-06T14:28:00Z',
  end_time: '2026-10-06T14:43:00Z',
  total_duration_seconds: 900,
  active_duration_seconds: 750,
  idle_duration_seconds: 150,
  app_switches_count: 12,
  status: 'COMPLETED',
  nva_flags: ['EXCEL_OVERUSE', 'APP_SWITCHING'],
  app_breakdowns: [
    { app_name: 'Excel', duration_seconds: 390, percentage: 43.3, color: '#10b981' },
    { app_name: 'ClaimPlatform', duration_seconds: 310, percentage: 34.4, color: '#8b5cf6' },
    { app_name: 'Chrome', duration_seconds: 50, percentage: 5.6, color: '#38bdf8' }
  ],
  raw_events: [
    {
      id: 101,
      event_type: 'CLAIM_DETECTED',
      app_name: 'ClaimPlatform',
      window_title: 'ClaimPlatform - Claim #CLM1026 Review',
      timestamp: '2026-10-06T14:28:00Z',
      is_idle: false
    },
    {
      id: 102,
      event_type: 'APP_SWITCH',
      app_name: 'Excel',
      window_title: 'Payer_Fee_Schedule_2026.xlsx - Excel',
      timestamp: '2026-10-06T14:30:15Z',
      is_idle: false
    },
    {
      id: 103,
      event_type: 'APP_SWITCH',
      app_name: 'ClaimPlatform',
      window_title: 'ClaimPlatform - Claim #CLM1026 Review',
      timestamp: '2026-10-06T14:36:45Z',
      is_idle: false
    },
    {
      id: 104,
      event_type: 'CLAIM_CLOSED',
      app_name: 'ClaimPlatform',
      window_title: 'ClaimPlatform - Submission Success',
      timestamp: '2026-10-06T14:43:00Z',
      is_idle: false
    }
  ]
}

export const mockTeamOverview: TeamOverviewData = {
  date: '2026-10-06',
  total_associates: 4,
  active_associates_count: 3,
  total_claims_completed: 89,
  team_aht_minutes: 8.2,
  team_idle_percentage: 13.8,
  team_efficiency_score: 84.6,
  associates: [
    {
      associate_id: 'EMP101',
      name: 'Priya Sharma',
      status: 'ACTIVE',
      current_claim_id: 'CLM1028',
      completed_claims: 27,
      aht_minutes: 7.4,
      idle_percentage: 11.5,
      efficiency_score: 88.5,
      flags_count: 3
    },
    {
      associate_id: 'EMP102',
      name: 'Rahul Verma',
      status: 'ACTIVE',
      current_claim_id: 'CLM1044',
      completed_claims: 22,
      aht_minutes: 8.9,
      idle_percentage: 15.2,
      efficiency_score: 82.0,
      flags_count: 6
    },
    {
      associate_id: 'EMP103',
      name: 'Ananya Iyer',
      status: 'ACTIVE',
      current_claim_id: 'CLM1051',
      completed_claims: 25,
      aht_minutes: 7.8,
      idle_percentage: 12.0,
      efficiency_score: 86.4,
      flags_count: 2
    },
    {
      associate_id: 'EMP104',
      name: 'Karthik Raja',
      status: 'IDLE',
      current_claim_id: null,
      completed_claims: 15,
      aht_minutes: 10.4,
      idle_percentage: 24.8,
      efficiency_score: 71.5,
      flags_count: 8
    }
  ],
  active_alerts: [
    {
      associate_id: 'EMP104',
      associate_name: 'Karthik Raja',
      type: 'HIGH_IDLE',
      message: 'Karthik Raja has exceeded 24% idle time with no active claim in last 18 minutes.'
    },
    {
      associate_id: 'EMP102',
      associate_name: 'Rahul Verma',
      type: 'NVA_SPIKE',
      message: 'Rahul Verma logged 6 NVA flags (predominantly manual Excel modifier lookups).'
    }
  ]
}

export const mockNvaSummary: NVASummaryData = {
  date: '2026-10-06',
  excel_overuse_claims_count: 21,
  app_switching_spikes_count: 17,
  long_idle_incidents_count: 9,
  outlier_claims_count: 5,
  rework_claims_count: 4,
  total_nva_time_lost_hours: 14.8,
  top_nva_category: 'EXCEL_OVERUSE',
  breakdown_by_category: {
    EXCEL_OVERUSE: 21,
    APP_SWITCHING: 17,
    LONG_IDLE: 9,
    OUTLIER: 5,
    REWORK: 4
  }
}

export const mockAiInsights: InsightsResponse = {
  timestamp: '2026-10-06T15:00:00Z',
  is_ai_live: true,
  insights: [
    {
      id: 'ins-001',
      title: 'High Excel Bottleneck in Charge Review',
      category: 'BOTTLENECK',
      severity: 'HIGH',
      impact_claim_count: 18,
      estimated_time_loss_mins: 72,
      description: 'Associates are spending over 44% of their active claim time manually looking up code modifiers in external spreadsheets.',
      recommendation: 'Integrate standard fee schedule and modifier lookup tables directly into ClaimPlatform UI to eliminate offline sheet lookups.',
      evidence: [
        'Claims CLM1003, CLM1012, CLM1024 spent >5.5 minutes in Excel.exe each',
        'Average app switches between ClaimPlatform and Excel exceeded 11 touches per claim'
      ]
    },
    {
      id: 'ins-002',
      title: 'Rapid Window Toggling Pattern Detected',
      category: 'BEHAVIOR',
      severity: 'MEDIUM',
      impact_claim_count: 14,
      estimated_time_loss_mins: 45,
      description: 'Frequent alternating focus between Payer Portal (Chrome) and Internal Billing Tool indicates copy-pasting of patient authorization numbers.',
      recommendation: 'Enable dual-monitor layout or implement browser auto-fill extension for verified eligibility verification numbers.',
      evidence: [
        'Chrome to BillingPortal toggles occur within 4-second intervals',
        'Observed across 3 associates handling commercial payers'
      ]
    },
    {
      id: 'ins-003',
      title: 'Unusually Long Handling Time Outliers in Payer Denial Claims',
      category: 'REWORK',
      severity: 'HIGH',
      impact_claim_count: 6,
      estimated_time_loss_mins: 95,
      description: 'Denial code CO-16 claims show handling times 2.8x higher than team average due to repeated document downloads and re-checks.',
      recommendation: 'Schedule targeted coaching session on CO-16 denial resolution workflows and establish clear escalation criteria after 12 minutes.',
      evidence: [
        'Average handling time for CO-16 claims: 24.2 mins vs Team AHT of 8.6 mins',
        'Multiple re-opens within the same work session'
      ]
    }
  ]
}
