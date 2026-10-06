export interface AppBreakdown {
  app_name: string
  duration_seconds: number
  percentage: number
  color?: string
}

export interface ClaimTimelineItem {
  claim_id: string
  associate_id: string
  session_id: string
  start_time: string
  end_time: string | null
  total_duration_seconds: number
  active_duration_seconds: number
  idle_duration_seconds: number
  app_switches_count: number
  status: 'IN_PROGRESS' | 'COMPLETED' | 'REWORK'
  nva_flags: string[]
  app_breakdown: Record<string, number>
}

export interface ClaimTimelineDetail {
  claim_id: string
  associate_id: string
  start_time: string
  end_time: string | null
  total_duration_seconds: number
  active_duration_seconds: number
  idle_duration_seconds: number
  app_switches_count: number
  status: string
  nva_flags: string[]
  app_breakdowns: AppBreakdown[]
  raw_events: Array<{
    id: number
    event_type: string
    app_name: string
    window_title: string
    timestamp: string
    is_idle: boolean
  }>
}

export interface AssociateTodayData {
  associate_id: string
  associate_name: string
  session_id: string | null
  is_active: boolean
  target_claims: number
  completed_claims_count: number
  aht_minutes: number
  total_work_seconds: number
  total_active_seconds: number
  total_idle_seconds: number
  idle_percentage: number
  efficiency_score: number
  active_claim_id: string | null
  app_distribution: AppBreakdown[]
  recent_claims: ClaimTimelineItem[]
}

export interface AssociateOverviewItem {
  associate_id: string
  name: string
  status: 'ACTIVE' | 'IDLE' | 'OFFLINE'
  current_claim_id: string | null
  completed_claims: number
  aht_minutes: number
  idle_percentage: number
  efficiency_score: number
  flags_count: number
}

export interface TeamOverviewData {
  date: string
  total_associates: number
  active_associates_count: number
  total_claims_completed: number
  team_aht_minutes: number
  team_idle_percentage: number
  team_efficiency_score: number
  associates: AssociateOverviewItem[]
  active_alerts: Array<{
    associate_id: string
    associate_name: string
    type: string
    message: string
  }>
}

export interface NVASummaryData {
  date: string
  excel_overuse_claims_count: number
  app_switching_spikes_count: number
  long_idle_incidents_count: number
  outlier_claims_count: number
  rework_claims_count: number
  total_nva_time_lost_hours: number
  top_nva_category: string
  breakdown_by_category: Record<string, number>
}

export interface InsightCard {
  id: string
  title: string
  category: 'BOTTLENECK' | 'BEHAVIOR' | 'REWORK' | 'COACHING'
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  impact_claim_count: number
  estimated_time_loss_mins: number
  description: string
  recommendation: string
  evidence: string[]
}

export interface InsightsResponse {
  timestamp: string
  insights: InsightCard[]
  is_ai_live?: boolean
}
