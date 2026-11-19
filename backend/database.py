import os
from datetime import datetime, timezone
from typing import Optional
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

def to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensures a datetime is converted to UTC and stripped of timezone info for TIMESTAMP WITHOUT TIME ZONE columns."""
    if dt is None:
        return None
    if getattr(dt, "tzinfo", None) is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt

def now_naive_utc() -> datetime:
    """Returns current UTC datetime stripped of timezone info."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

if "DATABASE_URL" not in os.environ:
    env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(env_file):
        load_dotenv(env_file)
    else:
        load_dotenv()

default_aiven_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./tms.db")
raw_db_url = os.getenv("DATABASE_URL", default_aiven_url).strip().strip('"').strip("'")
if "supabase" in raw_db_url or "pooler.supabase.com" in raw_db_url or not raw_db_url:
    DATABASE_URL = default_aiven_url
elif raw_db_url.startswith("postgres://"):
    DATABASE_URL = raw_db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif raw_db_url.startswith("postgresql://") and not raw_db_url.startswith("postgresql+"):
    DATABASE_URL = raw_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    DATABASE_URL = raw_db_url

if "asyncpg" in DATABASE_URL and "?" in DATABASE_URL:
    base_part, query_part = DATABASE_URL.split("?", 1)
    clean_queries = [q for q in query_part.split("&") if not q.startswith("sslmode=")]
    DATABASE_URL = f"{base_part}?{'&'.join(clean_queries)}" if clean_queries else base_part

Base = declarative_base()

_engine = None
_session_maker = None
_last_pg_error = None


def get_engine():
    global _engine
    if _engine is None:
        connect_args = {}
        if DATABASE_URL.startswith("sqlite"):
            connect_args = {"check_same_thread": False, "timeout": 30.0}
        elif "aiven" in DATABASE_URL or "aivencloud.com" in DATABASE_URL or "postgres" in DATABASE_URL or "postgresql" in DATABASE_URL:
            import ssl
            sslctx = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
            sslctx.check_hostname = False
            sslctx.verify_mode = ssl.CERT_NONE
            connect_args = {
                "ssl": sslctx,
                "prepared_statement_cache_size": 0,
                "statement_cache_size": 0,
                "timeout": 4.0,
                "command_timeout": 4.0
            }
        engine_kwargs = {"echo": False, "connect_args": connect_args, "future": True}
        if not DATABASE_URL.startswith("sqlite"):
            engine_kwargs["pool_size"] = 3
            engine_kwargs["max_overflow"] = 2
            engine_kwargs["pool_recycle"] = 300
            engine_kwargs["pool_pre_ping"] = True
        _engine = create_async_engine(DATABASE_URL, **engine_kwargs)
    return _engine


def get_session_maker():
    global _session_maker
    if _session_maker is None:
        _session_maker = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False
        )
    return _session_maker


async def get_db():
    """FastAPI dependency for obtaining async database session."""
    session_maker = get_session_maker()
    async with session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Initializes tables on startup if they don't already exist and ensures baseline associate and users."""
    global DATABASE_URL, _engine, _session_maker
    engine = get_engine()

    try:
        async with engine.begin() as conn:
            from sqlalchemy import text
            if DATABASE_URL.startswith("sqlite"):
                try:
                    await conn.execute(text("PRAGMA journal_mode=WAL;"))
                    await conn.execute(text("PRAGMA synchronous=NORMAL;"))
                    await conn.execute(text("PRAGMA busy_timeout=10000;"))
                except Exception:
                    pass
            await conn.run_sync(Base.metadata.create_all)

            is_sqlite = DATABASE_URL.startswith("sqlite")
            if is_sqlite:
                ev_cols = [r[1] for r in (await conn.execute(text("PRAGMA table_info(events)"))).fetchall()]
                for col, col_type in [("url", "VARCHAR(500)"), ("page_header", "VARCHAR(200)"), ("used_for", "VARCHAR(500)")]:
                    if col not in ev_cols:
                        try:
                            await conn.execute(text(f"ALTER TABLE events ADD COLUMN {col} {col_type}"))
                        except Exception:
                            pass
                tl_cols = [r[1] for r in (await conn.execute(text("PRAGMA table_info(claim_timelines)"))).fetchall()]
                for col, col_type in [("action_type", "VARCHAR(100)"), ("target_minutes", "INTEGER"), ("target_seconds", "INTEGER")]:
                    if col not in tl_cols:
                        try:
                            await conn.execute(text(f"ALTER TABLE claim_timelines ADD COLUMN {col} {col_type}"))
                        except Exception:
                            pass
            else:
                for col, col_type in [("url", "VARCHAR(500)"), ("page_header", "VARCHAR(200)"), ("used_for", "VARCHAR(500)")]:
                    try:
                        await conn.execute(text(f"ALTER TABLE events ADD COLUMN IF NOT EXISTS {col} {col_type}"))
                    except Exception:
                        pass
                for col, col_type in [("action_type", "VARCHAR(100)"), ("target_minutes", "INTEGER"), ("target_seconds", "INTEGER")]:
                    try:
                        await conn.execute(text(f"ALTER TABLE claim_timelines ADD COLUMN IF NOT EXISTS {col} {col_type}"))
                    except Exception:
                        pass

            try:
                await conn.execute(text("UPDATE claim_timelines SET status = 'COMPLETED' WHERE status = 'IN_PROGRESS' AND end_time IS NOT NULL;"))
            except Exception:
                pass
            try:
                if is_sqlite:
                    await conn.execute(text("UPDATE claim_timelines SET status = 'COMPLETED', end_time = datetime(start_time, '+' || min(total_duration_seconds, 1800) || ' seconds') WHERE status = 'IN_PROGRESS' AND start_time < datetime('now', '-10 minutes');"))
                else:
                    await conn.execute(text("UPDATE claim_timelines SET status = 'COMPLETED', end_time = start_time + interval '10 minutes' WHERE status = 'IN_PROGRESS' AND start_time < (now() - interval '10 minutes');"))
            except Exception:
                pass
    except Exception as e:
        _last_pg_error = f"{type(e).__name__}: {str(e)}"
        if not DATABASE_URL.startswith("sqlite"):
            print(f"[DATABASE WARN] PostgreSQL initialization failed ({e}). Auto-falling back to local SQLite engine (./tms.db)...", flush=True)
            try:
                await engine.dispose()
            except Exception:
                pass
            DATABASE_URL = "sqlite+aiosqlite:///./tms.db"
            _engine = None
            _session_maker = None
            engine = get_engine()
            async with engine.begin() as conn:
                from sqlalchemy import text
                try:
                    await conn.execute(text("PRAGMA journal_mode=WAL;"))
                    await conn.execute(text("PRAGMA synchronous=NORMAL;"))
                    await conn.execute(text("PRAGMA busy_timeout=10000;"))
                except Exception:
                    pass
                await conn.run_sync(Base.metadata.create_all)
                for col, col_type in [("url", "VARCHAR(500)"), ("page_header", "VARCHAR(200)"), ("used_for", "VARCHAR(500)")]:
                    try:
                        await conn.execute(text(f"ALTER TABLE events ADD COLUMN {col} {col_type}"))
                    except Exception:
                        pass
                for col, col_type in [("action_type", "VARCHAR(100)"), ("target_minutes", "INTEGER"), ("target_seconds", "INTEGER")]:
                    try:
                        await conn.execute(text(f"ALTER TABLE claim_timelines ADD COLUMN {col} {col_type}"))
                    except Exception:
                        pass
                try:
                    await conn.execute(text("UPDATE claim_timelines SET status = 'COMPLETED' WHERE status = 'IN_PROGRESS' AND end_time IS NOT NULL;"))
                    await conn.execute(text("UPDATE claim_timelines SET status = 'COMPLETED', end_time = datetime(start_time, '+' || min(total_duration_seconds, 1800) || ' seconds') WHERE status = 'IN_PROGRESS' AND start_time < datetime('now', '-10 minutes');"))
                except Exception:
                    pass
        else:
            print(f"[DATABASE ERROR] SQLite table initialization error: {e}", flush=True)

    # Automatically ensure default associates and users exist
    session_maker = get_session_maker()
    async with session_maker() as session:
        try:
            from sqlalchemy import select
            try:
                from models import Associate, ClaimBenchmark, EmployeeClaim, User
            except ImportError:
                from backend.models import Associate, ClaimBenchmark, EmployeeClaim, User

            import hashlib
            SALT = "novaarc_tms_2026_salt"
            demo_hash = hashlib.pbkdf2_hmac("sha256", b"demo1234", SALT.encode("utf-8"), 100000).hex()

            seed_personas = [
                {"id": "EMP101", "username": "emp101", "name": "Priya Sharma", "email": "priya.sharma@novaarc-rcm.com", "role": "employee", "title": "Lead AR Specialist", "team": "Claims Adjudication Team Alpha", "avatar": "PS"},
                {"id": "EMP102", "username": "emp102", "name": "Marcus Chen", "email": "marcus.chen@novaarc-rcm.com", "role": "employee", "title": "Senior Claims Associate", "team": "Denial Resolution Team Beta", "avatar": "MC"},
                {"id": "EMP103", "username": "emp103", "name": "Aaliyah Patel", "email": "aaliyah.patel@novaarc-rcm.com", "role": "employee", "title": "Billing & Denial Analyst", "team": "Claims Adjudication Team Alpha", "avatar": "AP"},
                {"id": "EMP104", "username": "emp104", "name": "David Kim", "email": "david.kim@novaarc-rcm.com", "role": "employee", "title": "Claims Adjudicator", "team": "High-Dollar Claims Team", "avatar": "DK"},
                {"id": "MGR101", "username": "mgr101", "name": "Sarah Jenkins", "email": "sarah.jenkins@novaarc-rcm.com", "role": "manager", "title": "Claims Operations Supervisor", "team": "Operations Team Alpha", "avatar": "SJ"},
                {"id": "MGR102", "username": "mgr102", "name": "Robert Vance", "email": "robert.vance@novaarc-rcm.com", "role": "manager", "title": "Team Lead - Denial Mgmt", "team": "Operations Team Beta", "avatar": "RV"},
                {"id": "LEADER01", "username": "leader01", "name": "Eleanor Vance", "email": "eleanor.vance@novaarc-rcm.com", "role": "leader", "title": "VP of Revenue Cycle Operations", "team": "Executive Leadership", "avatar": "EV"},
            ]

            for p in seed_personas:
                # User table
                u_res = await session.execute(select(User).where(User.id == p["id"]))
                if not u_res.scalars().first():
                    session.add(User(
                        id=p["id"],
                        username=p["username"],
                        name=p["name"],
                        email=p["email"],
                        hashed_password=demo_hash,
                        role=p["role"],
                        title=p["title"],
                        team=p["team"],
                        avatar=p["avatar"],
                        is_active=True
                    ))

                # Associate table (for employees)
                if p["role"] == "employee":
                    a_res = await session.execute(select(Associate).where(Associate.id == p["id"]))
                    if not a_res.scalars().first():
                        session.add(Associate(
                            id=p["id"],
                            name=p["name"],
                            email=p["email"],
                            role="ASSOCIATE",
                            target_daily_claims=40
                        ))
            await session.commit()

            # Seed standard status-to-benchmark mapping rules if table is empty
            bm_res = await session.execute(select(ClaimBenchmark).limit(1))
            if not bm_res.scalars().first():
                default_benchmarks = [
                    {"status_pattern": "CALL", "claim_type_name": "CR - Call / IVR", "target_minutes": 14, "target_seconds": 840, "priority": 10},
                    {"status_pattern": "IVR", "claim_type_name": "CR - Call / IVR", "target_minutes": 14, "target_seconds": 840, "priority": 10},
                    {"status_pattern": "APPEAL", "claim_type_name": "AP - Review / Written", "target_minutes": 18, "target_seconds": 1080, "priority": 15},
                    {"status_pattern": "WRITTEN", "claim_type_name": "AP - Review / Written", "target_minutes": 18, "target_seconds": 1080, "priority": 12},
                    {"status_pattern": "STATUS", "claim_type_name": "SI - Call / IVR", "target_minutes": 7, "target_seconds": 420, "priority": 20},
                    {"status_pattern": "PAID", "claim_type_name": "PPA - Review / Posting", "target_minutes": 3, "target_seconds": 180, "priority": 25},
                    {"status_pattern": "POSTING", "claim_type_name": "PPA - Review / Posting", "target_minutes": 3, "target_seconds": 180, "priority": 25},
                    {"status_pattern": "DENIED", "claim_type_name": "DM - Clinical / Auth", "target_minutes": 13, "target_seconds": 780, "priority": 10},
                    {"status_pattern": "AUTH", "claim_type_name": "DM - Clinical / Auth", "target_minutes": 13, "target_seconds": 780, "priority": 10},
                    {"status_pattern": "CLINICAL", "claim_type_name": "DM - Clinical / Auth", "target_minutes": 13, "target_seconds": 780, "priority": 10},
                ]
                for bm in default_benchmarks:
                    session.add(ClaimBenchmark(**bm))
                await session.commit()
        except Exception as e:
            print(f"[DATABASE WARN] Could not complete database baseline seeding: {e}", flush=True)
