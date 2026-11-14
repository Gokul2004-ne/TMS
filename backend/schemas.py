from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# --- Events ---
class EventIn(BaseModel):
    associate_id: str = Field(..., examples=["EMP101"])
    session_id: str = Field(..., examples=["sess-001"])
    claim_id: str = Field(default="UNASSIGNED", examples=["CLM1003"])
    event_type: str = Field(..., examples=["APP_SWITCH"])
    app_name: str = Field(..., examples=["Excel"])
    window_title: Optional[str] = Field(default="", examples=["CLM1003 - Patient Charges.xlsx"])
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_idle: bool = Field(default=False)
    agent_version: str = Field(default="1.0.0")
    url: Optional[str] = Field(default="", examples=["https://novaarc.local/claims"])
    page_header: Optional[str] = Field(default="", examples=["Claims Management & Adjudication"])
    used_for: Optional[str] = Field(default="", examples=["Searching patient claims, checking denial codes, reviewing EOBs & filing appeals"])



class BulkEventsIn(BaseModel):
    events: List[EventIn]


class IngestResponse(BaseModel):
    received: int
    inserted: int
    timelines_updated: int
    status: str = "ok"


# --- Sessions ---
class SessionStartIn(BaseModel):
    associate_id: str
    session_id: Optional[str] = None


class SessionEndIn(BaseModel):
    session_id: str


class SessionOut(BaseModel):
    session_id: str
    associate_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    is_active: bool
    total_duration_seconds: int


# --- Timelines & Claims ---
class AppBreakdown(BaseModel):
    app_name: str
    duration_seconds: int
    percentage: float
    color: Optional[str] = None


class ClaimTimelineItem(BaseModel):
    claim_id: str
    associate_id: str
    session_id: str
    start_time: datetime
    end_time: Optional[datetime]
    total_duration_seconds: int
    active_duration_seconds: int
    idle_duration_seconds: int
    app_switches_count: int
    status: str  # IN_PROGRESS, COMPLETED, REWORK
    action_type: Optional[str] = "CR - Call / IVR"
    target_minutes: Optional[int] = 14
    target_seconds: Optional[int] = 840
    variance_seconds: Optional[int] = None  # positive: saved time, negative: overtime
    nva_flags: List[str] = []
    app_breakdown: Dict[str, int] = {}



class ClaimTimelineDetail(BaseModel):
    claim_id: str
    associate_id: str
    start_time: datetime
    end_time: Optional[datetime]
    total_duration_seconds: int
    active_duration_seconds: int
    idle_duration_seconds: int
    app_switches_count: int
    status: str
    action_type: Optional[str] = "CR - Call / IVR"
    target_minutes: Optional[int] = 14
    target_seconds: Optional[int] = 840
    variance_seconds: Optional[int] = None
    nva_flags: List[str]
    app_breakdowns: List[AppBreakdown]
    raw_events: List[Dict[str, Any]] = []


# --- Associate View ---
class AssociateTodayOut(BaseModel):
    associate_id: str
    associate_name: str
    session_id: Optional[str]
    is_active: bool
    target_claims: int
    completed_claims_count: int
    aht_minutes: float
    total_work_seconds: int
    total_active_seconds: int
    total_idle_seconds: int
    idle_percentage: float
    efficiency_score: float
    active_claim_id: Optional[str]
    active_claim_type: Optional[str] = None
    active_target_minutes: Optional[int] = None
    active_target_seconds: Optional[int] = None
    active_start_time: Optional[datetime] = None
    active_elapsed_seconds: Optional[int] = 0
    app_distribution: List[AppBreakdown]
    recent_claims: List[ClaimTimelineItem]
    # NovaChron Specification Fields (Section 6, 8, 9, 15)
    c01_performance_index: Optional[float] = None
    performance_band: Optional[str] = "On target"
    status_label: Optional[str] = "OPTIMAL"
    occupancy_percentage: Optional[float] = None
    utilisation_percentage: Optional[float] = None
    productive_percentage: Optional[float] = None
    nva_percentage: Optional[float] = None
    user_idle_percentage: Optional[float] = None
    system_idle_percentage: Optional[float] = None
    expected_output: Optional[float] = None
    output_attainment: Optional[float] = None
    aht_attainment: Optional[float] = None
    productivity_gap: Optional[float] = 0.0
    capacity_gap_minutes: Optional[float] = 0.0
    quality_score: Optional[float] = None
    sop_adherence: Optional[float] = None
    points_today: Optional[int] = 0
    level_name: Optional[str] = "Associate"
    level_number: Optional[int] = 1
    lifetime_points: Optional[int] = 0
    points_to_next_level: Optional[int] = None
    time_states: Optional[Dict[str, float]] = None


# --- Team & Supervisor View ---
class AssociateOverviewItem(BaseModel):
    associate_id: str
    name: str
    status: str  # ACTIVE, IDLE, OFFLINE
    current_claim_id: Optional[str]
    completed_claims: int
    aht_minutes: float
    idle_percentage: float
    efficiency_score: float
    flags_count: int
    occupancy_percentage: Optional[float] = None
    performance_band: Optional[str] = "On target"
    expected_output: Optional[float] = None
    capacity_gap_minutes: Optional[float] = None


class TeamOverviewOut(BaseModel):
    date: str
    total_associates: int
    active_associates_count: int
    total_claims_completed: int
    team_aht_minutes: float
    team_idle_percentage: float
    team_efficiency_score: float
    team_occupancy_percentage: Optional[float] = None
    team_utilisation_percentage: Optional[float] = None
    team_expected_output: Optional[float] = None
    team_capacity_gap_minutes: Optional[float] = None
    associates: List[AssociateOverviewItem]
    active_alerts: List[Dict[str, Any]] = []


class NVASummaryOut(BaseModel):
    date: str
    excel_overuse_claims_count: int
    app_switching_spikes_count: int
    long_idle_incidents_count: int
    outlier_claims_count: int
    rework_claims_count: int
    total_nva_time_lost_hours: float
    top_nva_category: str
    breakdown_by_category: Dict[str, int]


# --- AI Insights ---
class InsightCard(BaseModel):
    id: str
    title: str
    category: str  # BOTTLENECK, BEHAVIOR, REWORK, COACHING
    severity: str  # HIGH, MEDIUM, LOW
    impact_claim_count: int
    estimated_time_loss_mins: int
    description: str
    recommendation: str
    evidence: List[str] = []


class InsightsListOut(BaseModel):
    timestamp: datetime
    insights: List[InsightCard]


# --- Manual Claim Activation ---
class SetActiveClaimIn(BaseModel):
    claim_id: str
    patient_name: Optional[str] = None
    status: Optional[str] = "IN_PROGRESS"
    action_type: Optional[str] = "CR - Call / IVR"
    target_minutes: Optional[int] = 14
    target_seconds: Optional[int] = 840


class ActiveClaimOut(BaseModel):
    associate_id: str
    active_claim_id: str
    patient_name: Optional[str] = None
    status: Optional[str] = "IN_PROGRESS"
    action_type: Optional[str] = "CR - Call / IVR"
    target_minutes: Optional[int] = 14
    target_seconds: Optional[int] = 840
    start_time: Optional[datetime] = None
    elapsed_seconds: Optional[int] = 0


# --- Pending Claims Schema ---
class PendingClaimOut(BaseModel):
    claim_id: str
    associate_id: str
    claim_type_name: str
    category: str
    due_date: Optional[datetime] = None
    days_until_due: Optional[int] = None
    urgency: str  # OVERDUE, DUE_SOON, ON_TRACK
    standard_minutes: float = 10.0