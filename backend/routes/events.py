from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from database import get_db
from models import Event, Associate, Session
from schemas import BulkEventsIn, IngestResponse
from services.timeline_builder import process_incoming_events

router = APIRouter(prefix="/api/events", tags=["Events"])


@router.post("", response_model=IngestResponse, status_code=status.HTTP_201_CREATED)
async def ingest_events(payload: BulkEventsIn, db: AsyncSession = Depends(get_db)):
    """
    High-throughput bulk ingestion endpoint for desktop agents.
    Automatically ensures Associate & Session existence, saves raw events,
    and increments live ClaimTimelines.
    """
    if not payload.events:
        return IngestResponse(received=0, inserted=0, timelines_updated=0, status="empty")

    db_events: List[Event] = []

    # Cache known associates and sessions within batch
    known_associates = set()
    known_sessions = set()

    for item in payload.events:
        # Auto-create associate if does not exist yet
        if item.associate_id not in known_associates:
            assoc_res = await db.execute(select(Associate).where(Associate.id == item.associate_id))
            assoc = assoc_res.scalars().first()
            if not assoc:
                assoc = Associate(
                    id=item.associate_id,
                    name=f"Associate {item.associate_id}",
                    email=f"{item.associate_id.lower()}@organization.com",
                    role="ASSOCIATE"
                )
                db.add(assoc)
                await db.flush()
            known_associates.add(item.associate_id)

        # Auto-create session if does not exist
        if item.session_id not in known_sessions:
            sess_res = await db.execute(select(Session).where(Session.id == item.session_id))
            sess = sess_res.scalars().first()
            if not sess:
                sess = Session(
                    id=item.session_id,
                    associate_id=item.associate_id,
                    start_time=item.timestamp,
                    is_active=True
                )
                db.add(sess)
                await db.flush()
            known_sessions.add(item.session_id)

        ev = Event(
            session_id=item.session_id,
            associate_id=item.associate_id,
            claim_id=item.claim_id or "UNASSIGNED",
            event_type=item.event_type,
            app_name=item.app_name,
            window_title=item.window_title or "",
            timestamp=item.timestamp,
            is_idle=item.is_idle,
            agent_version=item.agent_version
        )
        db_events.append(ev)
        db.add(ev)

    await db.flush()

    # Process events into claim timelines
    updated_timelines = await process_incoming_events(db, db_events)

    await db.commit()

    return IngestResponse(
        received=len(payload.events),
        inserted=len(db_events),
        timelines_updated=updated_timelines,
        status="success"
    )
