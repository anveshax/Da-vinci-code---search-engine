from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.db import init_db
from engine.crawler.scheduler import crawler_scheduler
from engine.crawler.engine import web_intelligence_engine
from app.api.health import router as health_router
from app.api.search import router as search_router
from app.api.search_v2 import router as search_v2_router
from app.api.platform import router as platform_router
from app.api.extensions import router as extensions_router
from app.api.ai_providers import router as ai_providers_router
from app.api.documents import router as documents_router
from app.api.orchestrator import router as orchestrator_router
from app.api.governance import router as governance_router
from app.api.adaptive import router as adaptive_router
from app.api.crawler import router as crawler_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database schema, ensure seed domains, and recover interrupted crawl tasks
    init_db()
    web_intelligence_engine.ensure_seeded()
    await crawler_scheduler.startup_recovery()
    yield
    # Shutdown: gracefully cancel active crawler tasks
    await crawler_scheduler.shutdown()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API and Code Analysis Services for Codebase Intelligence Engine",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Enable CORS for local frontend & deployed Vercel origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(health_router, prefix=settings.API_PREFIX)
app.include_router(health_router, prefix=settings.API_V2_PREFIX)
app.include_router(search_router, prefix=settings.API_PREFIX)
app.include_router(search_v2_router, prefix=settings.API_V2_PREFIX)
app.include_router(platform_router, prefix=settings.API_V2_PREFIX)
app.include_router(extensions_router, prefix=settings.API_V2_PREFIX)
app.include_router(ai_providers_router, prefix=settings.API_V2_PREFIX)
app.include_router(documents_router, prefix=settings.API_V2_PREFIX)
app.include_router(orchestrator_router, prefix=settings.API_V2_PREFIX)
app.include_router(governance_router, prefix=settings.API_V2_PREFIX)
app.include_router(adaptive_router, prefix=settings.API_V2_PREFIX)
app.include_router(crawler_router, prefix=settings.API_V2_PREFIX)


@app.get("/")
def read_root():
    """
    Root entry point directing developers to API docs.
    """
    return {
        "message": "Welcome to Codebase Intelligence Engine API",
        "version": settings.VERSION,
        "docs": "/docs",
        "health_endpoint": f"{settings.API_PREFIX}/health",
        "v2_health_endpoint": f"{settings.API_V2_PREFIX}/search/health",
        "v2_stream_endpoint": f"{settings.API_V2_PREFIX}/search/stream",
    }
