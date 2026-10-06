from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Index
)
from sqlalchemy.orm import relationship
from database import Base


class Associate(Base):
    __tablename__ = "associates"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    role = Column(String(50), default="ASSOCIATE")  # ASSOCIATE, SUPERVISOR
    target_daily_claims = Column(Integer, default=40)
    created_at = Column(DateTime, default=datetime.utcnow)

    sessions = relationship("Session", back_populates="associate", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="associate", cascade="all, delete-orphan")
    claim_timelines = relationship("ClaimTimeline", back_populates="associate", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(100), primary_key=True, index=True)
    associate_id = Column(String(50), ForeignKey("associates.id"), nullable=False, index=True)
    start_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    end_time = Column(DateTime, nullable=True)
    total_duration_seconds = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    associate = relationship("Associate", back_populates="sessions")
    events = relationship("Event", back_populates="session", cascade="all, delete-orphan")
    claim_timelines = relationship("ClaimTimeline", back_populates="session", cascade="all, delete-orphan")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(100), ForeignKey("sessions.id"), nullable=False, index=True)
    associate_id = Column(String(50), ForeignKey("associates.id"), nullable=False, index=True)
    claim_id = Column(String(50), nullable=False, index=True, default="UNASSIGNED")
    event_type = Column(String(50), nullable=False)  # APP_SWITCH, CLAIM_DETECTED, etc.
    app_name = Column(String(100), nullable=False)
    window_title = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    is_idle = Column(Boolean, default=False)
    agent_version = Column(String(20), default="1.0.0")

    session = relationship("Session", back_populates="events")
    associate = relationship("Associate", back_populates="events")

    __table_args__ = (
        Index("idx_events_claim_time", "claim_id", "timestamp"),
        Index("idx_events_session_time", "session_id", "timestamp"),
    )


class ClaimTimeline(Base):
    __tablename__ = "claim_timelines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    claim_id = Column(String(50), nullable=False, index=True)
    session_id = Column(String(100), ForeignKey("sessions.id"), nullable=False, index=True)
    associate_id = Column(String(50), ForeignKey("associates.id"), nullable=False, index=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    total_duration_seconds = Column(Integer, default=0)
    active_duration_seconds = Column(Integer, default=0)
    idle_duration_seconds = Column(Integer, default=0)
    app_switches_count = Column(Integer, default=0)
    app_breakdown_json = Column(Text, default="{}")  # JSON string of {"App": seconds}
    status = Column(String(30), default="IN_PROGRESS")  # IN_PROGRESS, COMPLETED, REWORK
    nva_flags_json = Column(Text, default="[]")  # JSON list of flags e.g. ["EXCEL_OVERUSE"]

    session = relationship("Session", back_populates="claim_timelines")
    associate = relationship("Associate", back_populates="claim_timelines")

    __table_args__ = (
        Index("idx_timeline_claim_associate", "claim_id", "associate_id"),
    )


class DailySummary(Base):
    __tablename__ = "daily_summaries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    associate_id = Column(String(50), ForeignKey("associates.id"), nullable=False, index=True)
    date = Column(String(20), nullable=False, index=True)  # YYYY-MM-DD
    total_claims_completed = Column(Integer, default=0)
    total_work_seconds = Column(Integer, default=0)
    total_active_seconds = Column(Integer, default=0)
    total_idle_seconds = Column(Integer, default=0)
    aht_seconds = Column(Float, default=0.0)
    efficiency_score = Column(Float, default=100.0)
