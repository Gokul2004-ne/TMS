import hashlib
import secrets
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

try:
    from database import get_db
    from models import User, Associate
    from schemas import UserLoginRequest, UserResponse, LoginResponse
except ImportError:
    from backend.database import get_db
    from backend.models import User, Associate
    from backend.schemas import UserLoginRequest, UserResponse, LoginResponse

router = APIRouter()

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
        status="ok"
    )


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

