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

load_dotenv()

# Resilient Local Database Configuration - Remote Supabase connection removed completely
# Aiven PostgreSQL Cloud Database Configuration (SSL Required)
env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(env_file):
    load_dotenv(env_file)
else:
    load_dotenv()

default_aiven_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://avnadmin@pg-6e76a1e-tms-novaarc.h.aivencloud.com:10058/defaultdb")
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
            connect_args = {"check_same_thread": False}
        elif "aiven" in DATABASE_URL or "aivencloud.com" in DATABASE_URL or "postgres" in DATABASE_URL or "postgresql" in DATABASE_URL:
            # Supabase PostgreSQL requires SSL; disable prepared statement cache for poolers
            import ssl
            sslctx = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
            sslctx.check_hostname = False
            sslctx.verify_mode = ssl.CERT_NONE
            connect_args = {
                "ssl": sslctx,
                "prepared_statement_cache_size": 0,
                "statement_cache_size": 0
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
    """Initializes tables on startup if they don't already exist and ensures baseline associate."""
    global DATABASE_URL, _engine, _session_maker
    engine = get_engine()

    # Try initializing tables; auto-fallback to local SQLite if remote PostgreSQL is unreachable or fails auth
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

            # Idempotent migration: Ensure new columns exist on existing SQLite/Postgres databases
            from sqlalchemy import text
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
                await conn.run_sync(Base.metadata.create_all)
                for col, col_type in [("url", "VARCHAR(500)"), ("page_header", "VARCHAR(200)"), ("used_for", "VARCHAR(500)")]:
                    try:
                        from sqlalchemy import text
                        await conn.execute(text(f"ALTER TABLE events ADD COLUMN {col} {col_type}"))
                    except Exception:
                        pass
                for col, col_type in [("action_type", "VARCHAR(100)"), ("target_minutes", "INTEGER"), ("target_seconds", "INTEGER")]:
                    try:
                        from sqlalchemy import text
                        await conn.execute(text(f"ALTER TABLE claim_timelines ADD COLUMN {col} {col_type}"))
                    except Exception:
                        pass
        else:
            print(f"[DATABASE ERROR] SQLite table initialization error: {e}", flush=True)

    # Automatically ensure default associate EMP101 and baseline benchmarks exist
    session_maker = get_session_maker()
    async with session_maker() as session:
        try:
            from sqlalchemy import select
            from models import Associate, ClaimBenchmark, EmployeeClaim
            res = await session.execute(select(Associate).where(Associate.id == "EMP101"))
            if not res.scalars().first():
                emp = Associate(
                    id="EMP101",
                    name="Associate EMP101",
                    email="emp101@organization.com",
                    role="ASSOCIATE",
                    target_daily_claims=40
                )
                session.add(emp)
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

            # Seed baseline shift claims for EMP101 if table is empty
            ec_res = await session.execute(select(EmployeeClaim).where(EmployeeClaim.associate_id == "EMP101").limit(1))
            if not ec_res.scalars().first():
                initial_claims = [
                    {"claim_id": "CLM-605", "patient_mrn": "MRN126225", "provider": "Dr. Amanda Davis", "payer": "UnitedHealthcare", "dos": "Oct 23, 2026", "charged": "$250.00", "paid": "$0.00", "balance": "$250.00", "platform_status": "RESUBMIT CLAIM (CALL/IVR)"},
                    {"claim_id": "CLM-606", "patient_mrn": "MRN126225", "provider": "Dr. Amanda Davis", "payer": "Aetna", "dos": "Sep 15, 2026", "charged": "$750.00", "paid": "$750.00", "balance": "$0.00", "platform_status": "PAID"},
                    {"claim_id": "CLM-604", "patient_mrn": "MRN126225", "provider": "Dr. Amanda Davis", "payer": "Aetna", "dos": "Sep 15, 2026", "charged": "$750.00", "paid": "$750.00", "balance": "$0.00", "platform_status": "PAID"},
                    {"claim_id": "CLM-603", "patient_mrn": "MRN126225", "provider": "Dr. Amanda Davis", "payer": "Aetna", "dos": "Sep 15, 2026", "charged": "$750.00", "paid": "$750.00", "balance": "$0.00", "platform_status": "PAID"},
                    {"claim_id": "CLM-602", "patient_mrn": "MRN126225", "provider": "Dr. Amanda Davis", "payer": "Aetna", "dos": "Sep 15, 2026", "charged": "$750.00", "paid": "$750.00", "balance": "$0.00", "platform_status": "PAID"},
                    {"claim_id": "CLM-601", "patient_mrn": "MRN126225", "provider": "Dr. Amanda Davis", "payer": "Aetna", "dos": "Sep 15, 2026", "charged": "$750.00", "paid": "$750.00", "balance": "$0.00", "platform_status": "PAID"},
                    {"claim_id": "CLM-472", "patient_mrn": "MRN550664", "provider": "Dr. Emily Rodriguez", "payer": "Medicare", "dos": "Aug 8, 2026", "charged": "$2,443.92", "paid": "$0.00", "balance": "$2,443.92", "platform_status": "DENIED"},
                    {"claim_id": "CLM-0012", "patient_mrn": "MRN334211", "provider": "Dr. Amanda Davis", "payer": "Blue Cross Blue Shield", "dos": "Oct 19, 2026", "charged": "$620.00", "paid": "$0.00", "balance": "$620.00", "platform_status": "RESUBMIT CLAIM (CALL/IVR)"},
                    {"claim_id": "CLM-0016", "patient_mrn": "MRN884120", "provider": "Dr. Amanda Davis", "payer": "Cigna", "dos": "Oct 18, 2026", "charged": "$310.00", "paid": "$0.00", "balance": "$310.00", "platform_status": "RESUBMIT CLAIM (CALL/IVR)"},
                    {"claim_id": "CLM-7722", "patient_mrn": "MRN441092", "provider": "Dr. Amanda Davis", "payer": "Humana", "dos": "Oct 17, 2026", "charged": "$1,150.00", "paid": "$0.00", "balance": "$1,150.00", "platform_status": "RESUBMIT CLAIM (CALL/IVR)"},
                    {"claim_id": "CLM-001", "patient_mrn": "MRN1001", "provider": "Dr. Amanda Davis", "payer": "Aetna", "dos": "Sep 20, 2026", "charged": "$450.00", "paid": "$0.00", "balance": "$450.00", "platform_status": "RESUBMIT CLAIM (CALL/IVR)"},
                    {"claim_id": "CLM-002", "patient_mrn": "MRN1002", "provider": "Dr. Amanda Davis", "payer": "UnitedHealthcare", "dos": "Sep 22, 2026", "charged": "$520.00", "paid": "$0.00", "balance": "$520.00", "platform_status": "STANDARD CLAIM APPEAL (WRITTEN)"},
                    {"claim_id": "CLM-003", "patient_mrn": "MRN1003", "provider": "Dr. Amanda Davis", "payer": "Medicare", "dos": "Sep 25, 2026", "charged": "$290.00", "paid": "$0.00", "balance": "$290.00", "platform_status": "CLAIM STATUS CHECK (CALL/IVR)"},
                    {"claim_id": "CLM-445522", "patient_mrn": "MRN992011", "provider": "Dr. Amanda Davis", "payer": "Aetna", "dos": "Oct 21, 2026", "charged": "$890.00", "paid": "$0.00", "balance": "$890.00", "platform_status": "RESUBMIT CLAIM (CALL/IVR)"}
                ]
                for c in initial_claims:
                    session.add(EmployeeClaim(associate_id="EMP101", **c))
                await session.commit()
        except Exception as e:
            print(f"[DATABASE WARN] Could not complete database baseline seeding: {e}", flush=True)

