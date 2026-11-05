from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

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
from app.api.voice import router as voice_router
from app.api.personas import router as personas_router
from app.api.browser import router as browser_router
from app.api.tor import router as tor_router
from app.api.security import router as security_router
from app.api.research import router as research_router
from app.api.news import router as news_router
from app.api.performance import router as performance_router
from app.core.extensions_engine import ExtensionEngine
from engine.news import global_news_service
from engine.http_client import close_shared_client
from engine.task_manager import background_task_manager
import asyncio


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database schema, ensure seed domains, seed browser extensions, recover crawl tasks, initialize background task manager and global news
    init_db()
    web_intelligence_engine.ensure_seeded()
    ExtensionEngine.seed_curated_marketplace()
    await crawler_scheduler.startup_recovery()
    await background_task_manager.start()
    asyncio.create_task(global_news_service.initialize())
    yield
    # Shutdown: gracefully cancel active crawler tasks, news scheduler, task manager, and close HTTP pool
    await crawler_scheduler.shutdown()
    await background_task_manager.shutdown()
    await global_news_service.scheduler.stop()
    await close_shared_client()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API and Code Analysis Services for Codebase Intelligence Engine",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Enable GZip compression (> 1000 bytes) for high network throughput
app.add_middleware(GZipMiddleware, minimum_size=1000)

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
app.include_router(voice_router, prefix=settings.API_PREFIX)
app.include_router(voice_router, prefix=settings.API_V2_PREFIX)
app.include_router(personas_router, prefix=settings.API_V2_PREFIX)
app.include_router(browser_router, prefix=settings.API_V2_PREFIX)
app.include_router(tor_router, prefix=settings.API_V2_PREFIX)
app.include_router(security_router, prefix=settings.API_V2_PREFIX)
app.include_router(research_router, prefix=settings.API_V2_PREFIX)
app.include_router(news_router, prefix="/api/v1")
app.include_router(news_router, prefix=settings.API_PREFIX)
app.include_router(news_router, prefix=settings.API_V2_PREFIX)
app.include_router(performance_router, prefix=settings.API_V2_PREFIX)


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
