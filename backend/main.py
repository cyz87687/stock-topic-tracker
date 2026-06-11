import asyncio
import os
import time
from typing import Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import create_tables
from data_service import fetch_and_store_real_data, fetch_and_store_historical_data, periodic_data_update
from app.routers import topics, trends, rotation, market

_periodic_task: Optional[asyncio.Task] = None

PRODUCTION = os.environ.get("PRODUCTION", "0") == "1"
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _periodic_task
    await create_tables()
    print("[Startup] Fetching historical data (last 30 days)...")
    await fetch_and_store_historical_data(days=30)
    print("[Startup] Fetching real-time data...")
    await fetch_and_store_real_data()
    print("[Startup] Starting periodic update task...")
    _periodic_task = asyncio.create_task(periodic_data_update())
    mode = "PRODUCTION" if PRODUCTION else "DEVELOPMENT"
    print(f"[Startup] All data loaded, server ready! Mode: {mode}")
    yield
    if _periodic_task:
        _periodic_task.cancel()


app = FastAPI(title="A股题材轮动追踪", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = time.time() - start
    response.headers["X-Process-Time"] = f"{elapsed:.3f}s"
    return response


app.include_router(topics.router)
app.include_router(trends.router)
app.include_router(rotation.router)
app.include_router(market.router)

if PRODUCTION and os.path.isdir(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))


@app.get("/")
async def root():
    return {"code": 0, "data": {"service": "A股题材轮动追踪API", "version": "2.0.0", "dataSource": "东方财富实时接口", "mode": "production" if PRODUCTION else "development"}, "message": "ok"}


@app.post("/api/refresh")
async def refresh_data(background_tasks: BackgroundTasks):
    from app.routers.rotation import _cache
    _cache.clear()
    background_tasks.add_task(fetch_and_store_real_data)
    return {"code": 0, "data": None, "message": "缓存已清除，数据刷新已触发"}


if __name__ == "__main__":
    import uvicorn
    workers = int(os.environ.get("WORKERS", "1"))
    reload_mode = not PRODUCTION
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=reload_mode,
        workers=workers,
        log_level="info",
        access_log=True,
    )
