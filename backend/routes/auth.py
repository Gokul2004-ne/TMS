import hashlib
import re
import secrets
import time
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

try:
    from database import get_db, now_naive_utc, to_naive_utc
    from models import User, Associate, Session, Event
    from schemas import UserLoginRequest, UserLogoutRequest, UserResponse, LoginResponse
except ImportError:
    from backend.database import get_db, now_naive_utc, to_naive_utc
    from backend.models import User, Associate, Session, Event
    from backend.schemas import UserLoginRequest, UserLogoutRequest, UserResponse, LoginResponse

router = APIRouter()

LOCK_TTL_SECONDS = 900  # 15 minutes inactivity auto-expiry
ACTIVE_WORKSTATION_LOCKS: Dict[str, Dict[str, Any]] = {}


def normalize_device_tag(device_id: Optional[str]) -> str:
    clean = re.sub(r"[^a-z0-9]", "", (device_id or "").lower())
    return clean[:12] if clean else "webclient"


def extract_device_from_session_id(session_id: Optional[str]) -> Optional[str]:
    if not session_id:
        return None
    m = re.search(r"-d([a-z0-9]{6,12})-t(\d{9,13})", session_id.lower())
    return m.group(1) if m else None


def record_workstation_lock(associate_id: str, device_id: Optional[str], session_id: str) -> None:
    clean_id = (associate_id or "").strip().upper()
    if not clean_id:
        return
    now = now_naive_utc()
    ACTIVE_WORKSTATION_LOCKS[clean_id] = {
        "device_id": normalize_device_tag(device_id),
        "session_id": session_id,
        "locked_at": now,
        "last_seen_at": now,
    }


def release_workstation_lock(
    associate_id: str, device_id: Optional[str] = None, session_id: Optional[str] = None
) -> None:
    clean_id = (associate_id or "").strip().upper()
    if not clean_id:
        return
    entry = ACTIVE_WORKSTATION_LOCKS.get(clean_id)
    if not entry:
        return
    if session_id and entry.get("session_id") and entry.get("session_id") != session_id:
        return
    if device_id and entry.get("device_id") and entry.get("device_id") != normalize_device_tag(device_id):
        return
    ACTIVE_WORKSTATION_LOCKS.pop(clean_id, None)


async def check_employee_lock_conflict(
    db: AsyncSession, associate_id: str, req_device: str
) -> Optional[Dict[str, Any]]:
    """Returns active lock conflict metadata if another workstation currently holds this employee ID."""
    clean_id = associate_id.strip().upper()
    now = now_naive_utc()

    mem_lock = ACTIVE_WORKSTATION_LOCKS.get(clean_id)
    if mem_lock:
        last_seen = to_naive_utc(mem_lock.get("last_seen_at")) or to_naive_utc(mem_lock.get("locked_at"))
        age_sec = (now - last_seen).total_seconds() if last_seen else LOCK_TTL_SECONDS + 1
        if age_sec <= LOCK_TTL_SECONDS:
            owner_dev = mem_lock.get("device_id", "")
            if owner_dev and owner_dev != req_device:
                return {
                    "owner_device": owner_dev,
                    "session_id": mem_lock.get("session_id"),
                    "age_seconds": int(age_sec),
                }
        else:
            ACTIVE_WORKSTATION_LOCKS.pop(clean_id, None)

    sess_res = await db.execute(
        select(Session)
        .where(and_(Session.associate_id == clean_id, Session.is_active == True))
        .order_by(Session.start_time.desc())
        .limit(1)
    )
    active_sess = sess_res.scalars().first()
    if active_sess:
        owner_dev = extract_device_from_session_id(active_sess.id)
        sess_start = to_naive_utc(active_sess.start_time)
        sess_age = (now - sess_start).total_seconds() if sess_start else LOCK_TTL_SECONDS + 1

        ev_res = await db.execute(
            select(Event.timestamp)
            .where(Event.associate_id == clean_id)
            .order_by(Event.timestamp.desc())
            .limit(1)
        )
        last_ev_ts = to_naive_utc(ev_res.scalars().first())
        ev_age = (now - last_ev_ts).total_seconds() if last_ev_ts else LOCK_TTL_SECONDS + 1

        is_fresh = (sess_age <= LOCK_TTL_SECONDS) or (ev_age <= 600)
        if is_fresh and owner_dev and owner_dev != req_device:
            return {
                "owner_device": owner_dev,
                "session_id": active_sess.id,
                "age_seconds": int(min(sess_age, ev_age)),
            }
        if ev_age <= 600 and not owner_dev:
            return {
                "owner_device": "ACTIVE-PC",
                "session_id": active_sess.id,
                "age_seconds": int(ev_age),
            }
    return None

SALT = "novaarc_tms_2026_salt"

def hash_password(plain: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", plain.encode("utf-8"), SALT.encode("utf-8"), 100000).hex()

def verify_password(plain: str, hashed: str) -> bool:
    return hash_password(plain) == hashed

PRESET_PROFILES = {
    "EMP101": {
        "id": "EMP101",
        "username": "emp101",
        "name": "Priya Sharma",
        "email": "priya.sharma@novaarc-rcm.com",
        "role": "employee",
        "title": "Lead AR Specialist",
        "team": "Claims Adjudication Team Alpha",
        "avatar": "PS"
    },
    "EMP102": {
        "id": "EMP102",
        "username": "emp102",
        "name": "Marcus Chen",
        "email": "marcus.chen@novaarc-rcm.com",
        "role": "employee",
        "title": "Senior Claims Associate",
        "team": "Denial Resolution Team Beta",
        "avatar": "MC"
    },
    "EMP103": {
        "id": "EMP103",
        "username": "emp103",
        "name": "Aaliyah Patel",
        "email": "aaliyah.patel@novaarc-rcm.com",
        "role": "employee",
        "title": "Billing & Denial Analyst",
        "team": "Claims Adjudication Team Alpha",
        "avatar": "AP"
    },
    "EMP104": {
        "id": "EMP104",
        "username": "emp104",
        "name": "David Kim",
        "email": "david.kim@novaarc-rcm.com",
        "role": "employee",
        "title": "Claims Adjudicator",
        "team": "High-Dollar Claims Team",
        "avatar": "DK"
    },
    "MGR101": {
        "id": "MGR101",
        "username": "mgr101",
        "name": "Sarah Jenkins",
        "email": "sarah.jenkins@novaarc-rcm.com",
        "role": "manager",
        "title": "Claims Operations Supervisor",
        "team": "Operations Team Alpha",
        "avatar": "SJ"
    },
    "MGR102": {
        "id": "MGR102",
        "username": "mgr102",
        "name": "Robert Vance",
        "email": "robert.vance@novaarc-rcm.com",
        "role": "manager",
        "title": "Team Lead - Denial Mgmt",
        "team": "Operations Team Beta",
        "avatar": "RV"
    },
    "LEADER01": {
        "id": "LEADER01",
        "username": "leader01",
        "name": "Eleanor Vance",
        "email": "eleanor.vance@novaarc-rcm.com",
        "role": "leader",
        "title": "VP of Revenue Cycle Operations",
        "team": "Executive Leadership",
        "avatar": "EV"
    }
}


@router.post("/login", response_model=LoginResponse)
async def login(req: UserLoginRequest, db: AsyncSession = Depends(get_db)):
    user_id = req.user_id.strip().upper()
    password = req.password or "demo1234"

    # 1. Search database
    res = await db.execute(
        select(User).where((User.id == user_id) | (User.username == req.user_id.lower()) | (User.email == req.user_id.lower()))
    )
    user = res.scalars().first()

    # 2. If user not yet in DB but is in preset catalog, auto-seed and persist
    if not user and user_id in PRESET_PROFILES:
        preset = PRESET_PROFILES[user_id]
        user = User(
            id=preset["id"],
            username=preset["username"],
            name=preset["name"],
            email=preset["email"],
            hashed_password=hash_password("demo1234"),
            role=preset["role"],
            title=preset["title"],
            team=preset["team"],
            avatar=preset["avatar"],
            is_active=True
        )
        db.add(user)

        # Also ensure associate record exists if employee
        if preset["role"] == "employee":
            assoc_res = await db.execute(select(Associate).where(Associate.id == preset["id"]))
            if not assoc_res.scalars().first():
                db.add(Associate(
                    id=preset["id"],
                    name=preset["name"],
                    email=preset["email"],
                    role="ASSOCIATE",
                    target_daily_claims=40
                ))
        await db.commit()
        await db.refresh(user)

    # 3. Dynamic user fallback if any other ID is provided
    if not user:
        assigned_role = req.role or ("manager" if user_id.startswith("MGR") else "leader" if user_id.startswith("LEAD") else "employee")
        user = User(
            id=user_id,
            username=user_id.lower(),
            name=f"User {user_id}",
            email=f"{user_id.lower()}@novaarc-rcm.com",
            hashed_password=hash_password(password),
            role=assigned_role,
            title="Specialist" if assigned_role == "employee" else "Supervisor" if assigned_role == "manager" else "Executive",
            team="RCM Operations",
            avatar=user_id[:2],
            is_active=True
        )
        db.add(user)
        if assigned_role == "employee":
            assoc_exists = (await db.execute(select(Associate).where(Associate.id == user_id))).scalars().first()
            if not assoc_exists:
                db.add(Associate(
                    id=user_id,
                    name=f"Associate {user_id}",
                    email=f"{user_id.lower()}@novaarc-rcm.com",
                    role="ASSOCIATE",
                    target_daily_claims=40
                ))
        await db.commit()
        await db.refresh(user)

    # 4. Password validation: allow demo password or matching hash
    if password != "demo1234" and not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    req_dev = normalize_device_tag(req.device_id)
    effective_role = (user.role or req.role or "employee").lower()
    assigned_sess_id: Optional[str] = None

    # 5. Per-employee concurrent workstation login lock
    if effective_role == "employee":
        if not req.force_takeover:
            conflict = await check_employee_lock_conflict(db, user.id, req_dev)
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Employee {user.id} is already logged in on workstation {conflict['owner_device'].upper()}. Only one active PC login is permitted per Employee ID."
                )

        # Ensure associate record and device-bound active session
        assoc_res = await db.execute(select(Associate).where(Associate.id == user.id))
        if not assoc_res.scalars().first():
            db.add(Associate(
                id=user.id,
                name=user.name or f"Associate {user.id}",
                email=user.email or f"{user.id.lower()}@novaarc-rcm.com",
                role="ASSOCIATE",
                target_daily_claims=40
            ))
            await db.flush()

        now_dt = now_naive_utc()
        open_res = await db.execute(
            select(Session).where(and_(Session.associate_id == user.id, Session.is_active == True))
        )
        for old_s in open_res.scalars().all():
            old_dev = extract_device_from_session_id(old_s.id)
            if old_dev == req_dev and not assigned_sess_id:
                assigned_sess_id = old_s.id
            else:
                old_s.is_active = False
                if not old_s.end_time:
                    old_s.end_time = now_dt

        if not assigned_sess_id:
            assoc_tag = re.sub(r"[^a-z0-9]", "", user.id.lower())[:12] or "emp"
            assigned_sess_id = f"sess-{assoc_tag}-d{req_dev}-t{int(time.time())}"
            db.add(Session(
                id=assigned_sess_id,
                associate_id=user.id,
                start_time=now_dt,
                is_active=True
            ))

        await db.commit()
        record_workstation_lock(user.id, req_dev, assigned_sess_id)

    token = f"tms_token_{user.id}_{secrets.token_hex(12)}"
    return LoginResponse(
        token=token,
        user=UserResponse(
            id=user.id,
            username=user.username,
            name=user.name,
            email=user.email,
            role=user.role,
            title=user.title or "",
            team=user.team or "",
            avatar=user.avatar or user.id[:2],
            is_active=user.is_active
        ),
        session_id=assigned_sess_id,
        device_id=req_dev,
        status="ok"
    )


@router.post("/logout")
async def logout(req: UserLogoutRequest, db: AsyncSession = Depends(get_db)):
    clean_id = req.user_id.strip().upper()
    now_dt = now_naive_utc()
    release_workstation_lock(clean_id, device_id=req.device_id, session_id=req.session_id)

    sess_res = await db.execute(
        select(Session).where(and_(Session.associate_id == clean_id, Session.is_active == True))
    )
    req_dev = normalize_device_tag(req.device_id) if req.device_id else None
    for s in sess_res.scalars().all():
        s_dev = extract_device_from_session_id(s.id)
        if req.session_id and s.id != req.session_id:
            continue
        if req_dev and s_dev and s_dev != req_dev:
            continue
        s.is_active = False
        s.end_time = now_dt
        start_dt = to_naive_utc(s.start_time) or now_dt
        s.total_duration_seconds = max(0, int((now_dt - start_dt).total_seconds()))

    await db.commit()
    return {"status": "logged_out", "user_id": clean_id}


@router.get("/lock-status/{user_id}")
async def get_lock_status(user_id: str, device_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    clean_id = user_id.strip().upper()
    req_dev = normalize_device_tag(device_id)
    conflict = await check_employee_lock_conflict(db, clean_id, req_dev)
    return {
        "user_id": clean_id,
        "locked": bool(conflict),
        "owner_device": conflict.get("owner_device") if conflict else None,
        "session_id": conflict.get("session_id") if conflict else None,
        "age_seconds": conflict.get("age_seconds") if conflict else None,
    }


@router.get("/me", response_model=UserResponse)
async def get_me(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    target_id = None
    if x_user_id:
        target_id = x_user_id.strip().upper()
    elif authorization and "Bearer tms_token_" in authorization:
        parts = authorization.replace("Bearer ", "").split("_")
        if len(parts) >= 3:
            target_id = parts[2]

    if not target_id:
        target_id = "EMP101"

    res = await db.execute(select(User).where(User.id == target_id))
    user = res.scalars().first()
    if not user:
        if target_id in PRESET_PROFILES:
            preset = PRESET_PROFILES[target_id]
            return UserResponse(
                id=preset["id"],
                username=preset["username"],
                name=preset["name"],
                email=preset["email"],
                role=preset["role"],
                title=preset["title"],
                team=preset["team"],
                avatar=preset["avatar"],
                is_active=True
            )
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        id=user.id,
        username=user.username,
        name=user.name,
        email=user.email,
        role=user.role,
        title=user.title or "",
        team=user.team or "",
        avatar=user.avatar or user.id[:2],
        is_active=user.is_active
    )


@router.get("/users", response_model=List[UserResponse])
async def list_users(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).order_by(User.id))
    users = res.scalars().all()
    if not users:
        return [
            UserResponse(
                id=p["id"],
                username=p["username"],
                name=p["name"],
                email=p["email"],
                role=p["role"],
                title=p["title"],
                team=p["team"],
                avatar=p["avatar"],
                is_active=True
            )
            for p in PRESET_PROFILES.values()
        ]

    return [
        UserResponse(
            id=u.id,
            username=u.username,
            name=u.name,
            email=u.email,
            role=u.role,
            title=u.title or "",
            team=u.team or "",
            avatar=u.avatar or u.id[:2],
            is_active=u.is_active
        )
        for u in users
    ]

