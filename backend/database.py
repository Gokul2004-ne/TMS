import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

load_dotenv()

raw_db_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./tms.db")
if raw_db_url.startswith("postgres://"):
    DATABASE_URL = raw_db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif raw_db_url.startswith("postgresql://") and not raw_db_url.startswith("postgresql+"):
    DATABASE_URL = raw_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    DATABASE_URL = raw_db_url

# Strip sslmode=... query parameters that asyncpg doesn't support as url queries
if "asyncpg" in DATABASE_URL and "?" in DATABASE_URL:
    base_part, query_part = DATABASE_URL.split("?", 1)
    clean_queries = [q for q in query_part.split("&") if not q.startswith("sslmode=")]
    DATABASE_URL = f"{base_part}?{'&'.join(clean_queries)}" if clean_queries else base_part

Base = declarative_base()

_engine = None
_session_maker = None


def get_engine():
    global _engine
    if _engine is None:
        connect_args = {}
        if DATABASE_URL.startswith("sqlite"):
            connect_args = {"check_same_thread": False}
        elif "supabase" in DATABASE_URL or "pooler.supabase.com" in DATABASE_URL:
            # Supabase PostgreSQL requires SSL for cloud connections
            connect_args = {"ssl": True}
        _engine = create_async_engine(
            DATABASE_URL,
            echo=False,
            connect_args=connect_args,
            future=True
        )
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
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # Idempotent migration: Ensure new columns exist on existing SQLite/Postgres databases
        for col, col_type in [("url", "VARCHAR(500)"), ("page_header", "VARCHAR(200)"), ("used_for", "VARCHAR(500)")]:
            try:
                from sqlalchemy import text
                await conn.execute(text(f"ALTER TABLE events ADD COLUMN {col} {col_type}"))
            except Exception:
                pass

    # Automatically ensure default associate EMP101 exists on fresh clone databases
    session_maker = get_session_maker()
    async with session_maker() as session:
        try:
            from sqlalchemy import select
            from models import Associate
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
        except Exception:
            pass

