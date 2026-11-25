import re
import time
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

try:
    from database import get_db, now_naive_utc
    from models import Session, Associate
    from schemas import SessionStartIn, SessionEndIn, SessionOut
    from routes.auth import (
        normalize_device_tag,
        extract_device_from_session_id,
        record_workstation_lock,
        release_workstation_lock,
        check_employee_lock_conflict,
    )
except ImportError:
    from backend.database import get_db, now_naive_utc
    from backend.models import Session, Associate
    from backend.schemas import SessionStartIn, SessionEndIn, SessionOut
    from backend.routes.auth import (
        normalize_device_tag,
        extract_device_from_session_id,
        record_workstation_lock,
        release_workstation_lock,
        check_employee_lock_conflict,
    )

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])


@router.post("/start", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def start_session(payload: SessionStartIn, db: AsyncSession = Depends(get_db)):
    """Starts a new agent tracking session for an associate with per-employee workstation lock."""
    clean_assoc = payload.associate_id.strip().upper()
    sess_dev = extract_device_from_session_id(payload.session_id)
    req_dev = sess_dev or (normalize_device_tag(payload.device_id) if payload.device_id else None)

    if req_dev and not payload.force_takeover:
        conflict = await check_employee_lock_conflict(db, clean_assoc, req_dev)
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Employee {clean_assoc} is already active on workstation {conflict['owner_device'].upper()}. Sign out there first or use a different Employee ID."
            )

    if payload.session_id:
        sess_id = payload.session_id[:95]
    elif req_dev:
        assoc_tag = re.sub(r"[^a-z0-9]", "", clean_assoc.lower())[:12] or "emp"
        sess_id = f"sess-{assoc_tag}-d{req_dev}-t{int(time.time())}"
    else:
        sess_id = f"sess-{uuid.uuid4().hex[:10]}"

    now = now_naive_utc()

    try:
        # Ensure associate exists
        assoc_res = await db.execute(select(Associate).where(Associate.id == clean_assoc))
        assoc = assoc_res.scalars().first()
        if not assoc:
            assoc = Associate(
                id=clean_assoc,
                name=f"Associate {clean_assoc}",
                email=f"{clean_assoc.lower()}@organization.com",
                role="ASSOCIATE"
            )
            db.add(assoc)
            await db.flush()

        # Close prior active sessions once lock check succeeded
        prior_res = await db.execute(
            select(Session).where(and_(Session.associate_id == clean_assoc, Session.is_active == True))
        )
        for old_s in prior_res.scalars().all():
            if old_s.id != sess_id:
                old_s.is_active = False
                if not old_s.end_time:
                    old_s.end_time = now

        # Check if session already exists
        existing_res = await db.execute(select(Session).where(Session.id == sess_id))
        existing = existing_res.scalars().first()
        if existing:
            existing.is_active = True
            existing.end_time = None
            await db.commit()
            await db.refresh(existing)
            if req_dev:
                record_workstation_lock(clean_assoc, req_dev, existing.id)
            return SessionOut(
                session_id=existing.id,
                associate_id=existing.associate_id,
                start_time=existing.start_time,
                end_time=existing.end_time,
                is_active=existing.is_active,
                total_duration_seconds=existing.total_duration_seconds
            )

        new_sess = Session(
            id=sess_id,
            associate_id=clean_assoc,
            start_time=now,
            is_active=True,
            total_duration_seconds=0
        )
        db.add(new_sess)
        await db.commit()
        await db.refresh(new_sess)

        if req_dev:
            record_workstation_lock(clean_assoc, req_dev, new_sess.id)

        return SessionOut(
            session_id=new_sess.id,
            associate_id=new_sess.associate_id,
            start_time=new_sess.start_time,
            end_time=new_sess.end_time,
            is_active=new_sess.is_active,
            total_duration_seconds=new_sess.total_duration_seconds
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[SESSIONS WARN] DB unavailable during start_session: {e}", flush=True)
        return SessionOut(
            session_id=sess_id,
            associate_id=clean_assoc,
            start_time=now,
            end_time=None,
            is_active=True,
            total_duration_seconds=0
        )


@router.post("/end", response_model=SessionOut)
async def end_session(payload: SessionEndIn, db: AsyncSession = Depends(get_db)):
    """Ends an ongoing session and releases any workstation lock held by it."""
    now = now_naive_utc()
    try:
        sess_res = await db.execute(select(Session).where(Session.id == payload.session_id))
        sess = sess_res.scalars().first()
        if sess:
            sess.end_time = now
            sess.is_active = False
            start_dt = sess.start_time.replace(tzinfo=None) if sess.start_time else now
            sess.total_duration_seconds = max(0, int((now - start_dt).total_seconds()))

            await db.commit()
            await db.refresh(sess)

            release_workstation_lock(
                sess.associate_id,
                device_id=payload.device_id,
                session_id=sess.id,
            )

            return SessionOut(
                session_id=sess.id,
                associate_id=sess.associate_id,
                start_time=sess.start_time,
                end_time=sess.end_time,
                is_active=sess.is_active,
                total_duration_seconds=sess.total_duration_seconds
            )
    except Exception as e:
        print(f"[SESSIONS WARN] DB unavailable during end_session: {e}", flush=True)

    if payload.associate_id:
        release_workstation_lock(payload.associate_id, device_id=payload.device_id, session_id=payload.session_id)

    return SessionOut(
        session_id=payload.session_id,
        associate_id=(payload.associate_id or "UNASSIGNED"),
        start_time=now,
        end_time=now,
        is_active=False,
        total_duration_seconds=0
    )
