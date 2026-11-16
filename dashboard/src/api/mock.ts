import {
  AssociateTodayData,
  ClaimTimelineDetail,
  TeamOverviewData,
  NVASummaryData,
  InsightsResponse,
  PendingClaimItem
} from './types'

export const mockAssociateToday: AssociateTodayData = {
  associate_id: 'EMP101',
  associate_name: 'Priya Sharma',
  session_id: 'sess-demo-active',
  is_active: true,
  target_claims: 40,
  completed_claims_count: 28,
  aht_minutes: 5.4,
  total_work_seconds: 9072,
  total_active_seconds: 8312,
  total_idle_seconds: 760,
  idle_percentage: 8.4,
  efficiency_score: 92.5,
  active_claim_id: 'CLM-9021',
  active_claim_type: 'CR - Call / IVR',
  active_target_minutes: 14,
  active_target_seconds: 840,
  active_elapsed_seconds: 312,
  c01_performance_index: 94.2,
  performance_band: 'Optimal',
  status_label: 'Working Claim',
  occupancy_percentage: 91.6,
  utilisation_percentage: 88.4,
  productive_percentage: 86.2,
  nva_percentage: 5.6,
  expected_output: 30,
  output_attainment: 93.3,
  app_distribution: [
    { app_name: 'NovaArc RCM', duration_seconds: 4620, percentage: 51, color: '#4f46e5' },
    { app_name: 'Chrome', duration_seconds: 1980, percentage: 22, color: '#2563eb' },
    { app_name: 'Excel', duration_seconds: 1712, percentage: 19, color: '#16a34a' },
    { app_name: 'Idle', duration_seconds: 760, percentage: 8, color: '#d97706' }
  ],
  recent_claims: [
    {
      claim_id: 'CLM-8901',
      associate_id: 'EMP101',
      session_id: 'sess-demo-1',
      start_time: new Date(Date.now() - 3600000).toISOString(),
      end_time: new Date(Date.now() - 3288000).toISOString(),
      total_duration_seconds: 312,
      active_duration_seconds: 290,
      idle_duration_seconds: 22,
      app_switches_count: 4,
      status: 'COMPLETED',
      action_type: 'CR - Call / IVR',
      target_minutes: 14,
      target_seconds: 840,
      variance_seconds: -528,
      nva_flags: [],
      app_breakdown: { 'NovaArc RCM': 180, 'Chrome': 110, 'Idle': 22 }
    },
    {
      claim_id: 'CLM-8902',
      associate_id: 'EMP101',
      session_id: 'sess-demo-1',
      start_time: new Date(Date.now() - 3200000).toISOString(),
      end_time: new Date(Date.now() - 2732000).toISOString(),
      total_duration_seconds: 468,
      active_duration_seconds: 420,
      idle_duration_seconds: 48,
      app_switches_count: 12,
      status: 'COMPLETED',
      action_type: 'DM - Clinical / Auth',
      target_minutes: 13,
      target_seconds: 780,
      variance_seconds: -312,
      nva_flags: ['APP_SWITCHING'],
      app_breakdown: { 'Epic Hyperspace': 240, 'Excel': 120, 'Availity': 60, 'Idle': 48 }
    },
    {
      claim_id: 'CLM-8903',
      associate_id: 'EMP101',
      session_id: 'sess-demo-1',
      start_time: new Date(Date.now() - 2600000).toISOString(),
      end_time: new Date(Date.now() - 2306000).toISOString(),
      total_duration_seconds: 294,
      active_duration_seconds: 280,
      idle_duration_seconds: 14,
      app_switches_count: 3,
      status: 'COMPLETED',
      action_type: 'SI - Call / IVR',
      target_minutes: 7,
      target_seconds: 420,
      variance_seconds: -126,
      nva_flags: [],
      app_breakdown: { 'NovaArc RCM': 200, 'Chrome': 80, 'Idle': 14 }
    },
    {
      claim_id: 'CLM-8904',
      associate_id: 'EMP101',
      session_id: 'sess-demo-1',
      start_time: new Date(Date.now() - 2200000).toISOString(),
      end_time: new Date(Date.now() - 1834000).toISOString(),
      total_duration_seconds: 366,
      active_duration_seconds: 350,
      idle_duration_seconds: 16,
      app_switches_count: 5,
      status: 'COMPLETED',
      action_type: 'CR - Review / Portal',
      target_minutes: 4,
      target_seconds: 240,
      variance_seconds: 126,
      nva_flags: [],
      app_breakdown: { 'Chrome': 210, 'NovaArc RCM': 140, 'Idle': 16 }
    },
    {
      claim_id: 'CLM-8905',
      associate_id: 'EMP101',
      session_id: 'sess-demo-1',
      start_time: new Date(Date.now() - 1750000).toISOString(),
      end_time: new Date(Date.now() - 1186000).toISOString(),
      total_duration_seconds: 564,
      active_duration_seconds: 480,
      idle_duration_seconds: 84,
      app_switches_count: 9,
      status: 'COMPLETED',
      action_type: 'AP - Review / Written',
      target_minutes: 18,
      target_seconds: 1080,
      variance_seconds: -516,
      nva_flags: ['EXCEL_OVERUSE'],
      app_breakdown: { 'Excel': 320, 'Epic Hyperspace': 160, 'Idle': 84 }
    }
  ]
}

export const mockClaimTimelineDetail: ClaimTimelineDetail = {
  claim_id: 'CLM-9021',
  associate_id: 'EMP101',
  start_time: new Date(Date.now() - 1800000).toISOString(),
  end_time: null,
  total_duration_seconds: 312,
  active_duration_seconds: 288,
  idle_duration_seconds: 24,
  app_switches_count: 5,
  status: 'IN_PROGRESS',
  action_type: 'CR - Call / IVR',
  target_minutes: 14,
  nva_flags: [],
  app_breakdowns: [
    { app_name: 'NovaArc RCM', duration_seconds: 180, percentage: 58, color: '#4f46e5' },
    { app_name: 'Chrome', duration_seconds: 84, percentage: 27, color: '#2563eb' },
    { app_name: 'Excel', duration_seconds: 24, percentage: 8, color: '#16a34a' },
    { app_name: 'Idle', duration_seconds: 24, percentage: 7, color: '#d97706' }
  ],
  raw_events: [
    {
      id: 1,
      event_type: 'WINDOW_FOCUS',
      app_name: 'NovaArc RCM',
      window_title: 'Claim Adjudication Workqueue - Account #883921',
      timestamp: new Date(Date.now() - 312000).toISOString(),
      is_idle: false,
      url: 'https://krishna-caare.github.io/novaarc-rcm/claims',
      page_header: 'Claim Workbench',
      used_for: 'Claim Detail View'
    },
    {
      id: 2,
      event_type: 'WINDOW_FOCUS',
      app_name: 'Chrome',
      window_title: 'Availity Payer Portal - Real-time Eligibility Verification',
      timestamp: new Date(Date.now() - 200000).toISOString(),
      is_idle: false,
      url: 'https://availity.com/eligibility',
      page_header: 'Eligibility & Benefits Check',
      used_for: 'Payer verification'
    },
    {
      id: 3,
      event_type: 'WINDOW_FOCUS',
      app_name: 'NovaArc RCM',
      window_title: 'Claim Adjudication Workqueue - Account #883921',
      timestamp: new Date(Date.now() - 90000).toISOString(),
      is_idle: false,
      url: 'https://krishna-caare.github.io/novaarc-rcm/claims',
      page_header: 'Correction Editor',
      used_for: 'Submit revised claim'
    }
  ]
}

export const mockTeamOverview: TeamOverviewData = {
  date: new Date().toISOString().split('T')[0],
  total_associates: 4,
  active_associates_count: 4,
  total_claims_completed: 138,
  team_aht_minutes: 5.4,
  team_idle_percentage: 8.5,
  team_efficiency_score: 92,
  team_occupancy_percentage: 91.5,
  team_utilisation_percentage: 88.0,
  team_expected_output: 145,
  team_capacity_gap_minutes: 38,
  associates: [
    {
      id: 'EMP101',
      name: 'Priya Sharma',
      status: 'ACTIVE',
      current_claim_id: 'CLM-9021',
      completed_claims: 32,
      target_claims: 40,
      aht_minutes: 5.2,
      idle_percentage: 6.8,
      efficiency_score: 94,
      flags_count: 1,
      last_active_time: 'Just now'
    },
    {
      id: 'EMP102',
      name: 'Marcus Chen',
      status: 'ACTIVE',
      current_claim_id: 'CLM-9022',
      completed_claims: 28,
      target_claims: 40,
      aht_minutes: 6.1,
      idle_percentage: 9.4,
      efficiency_score: 88,
      flags_count: 3,
      last_active_time: '2m ago'
    },
    {
      id: 'EMP103',
      name: 'Aaliyah Patel',
      status: 'ACTIVE',
      current_claim_id: 'CLM-9023',
      completed_claims: 36,
      target_claims: 40,
      aht_minutes: 4.8,
      idle_percentage: 7.1,
      efficiency_score: 96,
      flags_count: 0,
      last_active_time: 'Just now'
    },
    {
      id: 'EMP104',
      name: 'David Kim',
      status: 'IDLE',
      current_claim_id: null,
      completed_claims: 24,
      target_claims: 40,
      aht_minutes: 6.8,
      idle_percentage: 14.2,
      efficiency_score: 82,
      flags_count: 2,
      last_active_time: '8m ago'
    }
  ],
  active_alerts: [
    {
      associate_id: 'EMP102',
      associate_name: 'Marcus Chen',
      type: 'EXCEL_OVERUSE',
      message: 'Excel active duration exceeds 45s threshold on CLM-9022'
    },
    {
      associate_id: 'EMP104',
      associate_name: 'David Kim',
      type: 'LONG_IDLE',
      message: 'Idle duration > 5m detected without active billing screen'
    }
  ]
}

export const mockNvaSummary: NVASummaryData = {
  date: new Date().toISOString().split('T')[0],
  excel_overuse_claims_count: 8,
  app_switching_spikes_count: 14,
  long_idle_incidents_count: 4,
  outlier_claims_count: 3,
  rework_claims_count: 2,
  total_nva_time_lost_hours: 3.2,
  top_nva_category: 'APP_SWITCHING',
  breakdown_by_category: {
    EXCEL_OVERUSE: 8,
    APP_SWITCHING: 14,
    LONG_IDLE: 4,
    OUTLIER: 3,
    REWORK: 2
  }
}

export const mockAiInsights: InsightsResponse = {
  timestamp: new Date().toISOString(),
  is_ai_live: true,
  insights: [
    {
      id: 'ins-1',
      title: 'Payer Denial Crosswalk Manual Excel Bottleneck',
      category: 'BOTTLENECK',
      severity: 'HIGH',
      impact_claim_count: 8,
      estimated_time_loss_mins: 42,
      description: 'Marcus Chen spends 45s+ per claim in Excel crosswalk sheets looking up CO-16 denial override codes.',
      recommendation: 'Enable instant In-App CARC auto-population widget inside NovaArc RCM to save ~5m per claim.',
      evidence: ['Excel active > 45s on 8 consecutive accounts', 'Window: Payer_Denial_Crosswalk_2026.xlsx']
    },
    {
      id: 'ins-2',
      title: 'High Touch Rate on Secondary Medicare Adjustments',
      category: 'REWORK',
      severity: 'MEDIUM',
      impact_claim_count: 12,
      estimated_time_loss_mins: 35,
      description: 'Associates repeatedly reopen Availity Portal to re-verify primary eligibility after claim generation.',
      recommendation: 'Automate 270/271 real-time eligibility batch checks upon claim intake.',
      evidence: ['App switching spike: 12 toggles between Epic and Availity on Account #883921']
    }
  ]
}

export const mockPendingClaims: PendingClaimItem[] = [
  {
    claim_id: 'CLM-9021',
    associate_id: 'EMP101',
    claim_type_name: 'CR - Call / IVR (CO-16 Missing Docs)',
    category: 'Commercial',
    due_date: 'Today',
    days_until_due: 0,
    urgency: 'OVERDUE',
    standard_minutes: 14
  },
  {
    claim_id: 'CLM-9022',
    associate_id: 'EMP101',
    claim_type_name: 'DM - Clinical / Auth (PR-204 Not Covered)',
    category: 'Commercial',
    due_date: 'Tomorrow',
    days_until_due: 1,
    urgency: 'DUE_SOON',
    standard_minutes: 13
  },
  {
    claim_id: 'CLM-9023',
    associate_id: 'EMP101',
    claim_type_name: 'PPA - Review / Posting (CO-97 Included)',
    category: 'Medicare',
    due_date: 'In 3 days',
    days_until_due: 3,
    urgency: 'ON_TRACK',
    standard_minutes: 3
  },
  {
    claim_id: 'CLM-9024',
    associate_id: 'EMP101',
    claim_type_name: 'AP - Review / Written (CO-4 Modifier Mismatch)',
    category: 'Medicaid',
    due_date: 'Yesterday',
    days_until_due: -1,
    urgency: 'OVERDUE',
    standard_minutes: 18
  },
  {
    claim_id: 'CLM-9025',
    associate_id: 'EMP101',
    claim_type_name: 'SI - Call / IVR (CO-18 Duplicate)',
    category: 'Commercial',
    due_date: 'In 5 days',
    days_until_due: 5,
    urgency: 'ON_TRACK',
    standard_minutes: 7
  }
]
