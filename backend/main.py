import os
import sys

_current_dir = os.path.dirname(os.path.abspath(__file__))
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

_lib_dir = os.path.join(_current_dir, "lib")
if os.path.exists(_lib_dir) and _lib_dir not in sys.path:
    sys.path.append(_lib_dir)

import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response, Request, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from routes.events import router as events_router
from routes.sessions import router as sessions_router
from routes.associate import router as associate_router
from routes.team import router as team_router
from routes.ai_proxy import router as ai_proxy_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables
    try:
        await init_db()
        print("[DATABASE] Aiven PostgreSQL tables initialized successfully.", flush=True)
    except Exception as e:
        print(f"[DATABASE ERROR] Could not initialize tables on boot: {e}", flush=True)
    yield
    # Shutdown logic if needed


app = FastAPI(
    title="TMS Core API",
    description="Transaction Intelligence Platform - Core Backend API for Accounts Receivable tracking",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.github\.io|https://.*\.onrender\.com|https://.*\.catalystappsail\.(com|in)|https://.*\.zohocatalyst\.(com|in)|http://localhost:.*|http://127\.0\.0\.1:.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(events_router)
app.include_router(sessions_router)
app.include_router(associate_router)
app.include_router(team_router)
app.include_router(ai_proxy_router)


@app.get("/", tags=["Root"])
@app.get("/health", tags=["Root"])
async def root():
    return {
        "status": "healthy",
        "service": "TMS Backend API",
        "version": "1.0.0",
        "documentation": "/docs",
        "health": "/health"
    }


@app.get("/api/agent/version", tags=["Agent"])
async def get_agent_version():
    """Returns current release version of TMS Desktop Agent and upgrade instructions."""
    return {
        "version": "1.0.1",
        "minimum_supported_version": "1.0.0",
        "status": "latest",
        "released_at": "2026-10-30",
        "release_notes": "Single-instance enforcement, duplicate launch protection, on-screen status dialog, and automatic upgrade support."
    }


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    trace = traceback.format_exc()
    print(f"[UNHANDLED EXCEPTION] {request.method} {request.url.path}: {exc}\n{trace}", flush=True)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__, "trace": trace}
    )


@app.get("/api/db-status", tags=["Diagnostic"])
async def db_status(db: AsyncSession = Depends(get_db)):
    """Verifies live database connection and table health."""
    try:
        from database import DATABASE_URL, _last_pg_error
        is_pg = "postgres" in DATABASE_URL
        if is_pg:
            res = await db.execute(text("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"))
            table_count = res.scalar()
        else:
            res = await db.execute(text("SELECT count(*) FROM sqlite_master WHERE type='table'"))
            table_count = res.scalar()

        masked_url = DATABASE_URL
        if "@" in masked_url and ":" in masked_url:
            try:
                prefix = masked_url.split("://", 1)[0]
                rest = masked_url.split("://", 1)[1]
                user = rest.split(":", 1)[0]
                host_part = rest.split("@", 1)[1]
                masked_url = f"{prefix}://{user}:***@{host_part}"
            except Exception:
                masked_url = "masked"

        return {
            "status": "connected",
            "tables_count": table_count,
            "database_type": "PostgreSQL (Aiven Cloud)" if is_pg else "SQLite (Local Fallback)",
            "active_database_url": masked_url,
            "last_postgres_error": _last_pg_error
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "trace": traceback.format_exc()
        }


@app.post("/api/seed", tags=["Diagnostic"])
@app.get("/api/seed", tags=["Diagnostic"])
async def trigger_seed():
    """Seeds the live database with initial associates, realistic claim timelines, and baseline summaries."""
    try:
        from scripts.seed_db import seed
        await seed()
        return {"status": "success", "message": "Database successfully populated with baseline associates and claims."}
    except Exception as e:
        return {"status": "error", "message": str(e), "trace": traceback.format_exc()}


if __name__ == "__main__":
    import uvicorn
    listen_port = int(os.getenv("X_ZOHO_CATALYST_LISTEN_PORT", os.getenv("PORT", 9000)))
    print(f"[BOOT] Starting TMS Backend on port {listen_port}", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=listen_port, reload=False)
