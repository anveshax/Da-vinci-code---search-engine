from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.health import router as health_router
from app.api.search import router as search_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API and Code Analysis Services for Codebase Intelligence Engine",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for local frontend & mobile development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(health_router, prefix=settings.API_PREFIX)
app.include_router(search_router, prefix=settings.API_PREFIX)


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
    }
