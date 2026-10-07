import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./tms.db")

Base = declarative_base()

_engine = None
_session_maker = None


def get_engine():
    global _engine
    if _engine is None:
        connect_args = {}
        if DATABASE_URL.startswith("sqlite"):
            connect_args = {"check_same_thread": False}
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

