import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Session, Associate
from schemas import SessionStartIn, SessionEndIn, SessionOut

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])


@router.post("/start", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def start_session(payload: SessionStartIn, db: AsyncSession = Depends(get_db)):
    """Starts a new agent tracking session for an associate."""
    # Ensure associate exists
    assoc_res = await db.execute(select(Associate).where(Associate.id == payload.associate_id))
    assoc = assoc_res.scalars().first()
    if not assoc:
        assoc = Associate(
            id=payload.associate_id,
            name=f"Associate {payload.associate_id}",
            email=f"{payload.associate_id.lower()}@organization.com",
            role="ASSOCIATE"
        )
        db.add(assoc)
        await db.flush()

    sess_id = payload.session_id or f"sess-{uuid.uuid4().hex[:10]}"
    
    # Check if session already exists
    existing_res = await db.execute(select(Session).where(Session.id == sess_id))
    existing = existing_res.scalars().first()
    if existing:
        existing.is_active = True
        await db.commit()
        await db.refresh(existing)
        return SessionOut(
            session_id=existing.id,
            associate_id=existing.associate_id,
            start_time=existing.start_time,
            end_time=existing.end_time,
            is_active=existing.is_active,
            total_duration_seconds=existing.total_duration_seconds
        )

    now = datetime.now(timezone.utc)
    new_sess = Session(
        id=sess_id,
        associate_id=payload.associate_id,
        start_time=now,
        is_active=True,
        total_duration_seconds=0
    )
    db.add(new_sess)
    await db.commit()
    await db.refresh(new_sess)

    return SessionOut(
        session_id=new_sess.id,
        associate_id=new_sess.associate_id,
        start_time=new_sess.start_time,
        end_time=new_sess.end_time,
        is_active=new_sess.is_active,
        total_duration_seconds=new_sess.total_duration_seconds
    )


@router.post("/end", response_model=SessionOut)
async def end_session(payload: SessionEndIn, db: AsyncSession = Depends(get_db)):
    """Ends an ongoing session."""
    sess_res = await db.execute(select(Session).where(Session.id == payload.session_id))
    sess = sess_res.scalars().first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    now = datetime.now(timezone.utc)
    sess.end_time = now
    sess.is_active = False
    start_dt = sess.start_time if sess.start_time.tzinfo else sess.start_time.replace(tzinfo=timezone.utc)
    sess.total_duration_seconds = max(0, int((now - start_dt).total_seconds()))


    await db.commit()
    await db.refresh(sess)

    return SessionOut(
        session_id=sess.id,
        associate_id=sess.associate_id,
        start_time=sess.start_time,
        end_time=sess.end_time,
        is_active=sess.is_active,
        total_duration_seconds=sess.total_duration_seconds
    )
