import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api import audio, harmony, realtime
from app.config import settings

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("harmonia_startup", env=settings.ENV)
    yield
    log.info("harmonia_shutdown")


app = FastAPI(
    title="Harmonia API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.ENV != "production" else None,
    redoc_url=None,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(audio.router, prefix="/api/audio", tags=["audio"])
app.include_router(harmony.router, prefix="/api/harmony", tags=["harmony"])
app.include_router(realtime.router, prefix="/api/ws", tags=["realtime"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
