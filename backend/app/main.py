import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import auth, books, reading

# ── Sentry ─────────────────────────────────────────────────────────────────────
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=0.2,
        profiles_sample_rate=0.1,
        environment="production" if not settings.DEBUG else "development",
    )

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
allowed_origins = [
    "https://pagestreak-frontend.onrender.com",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4173",
]

# Also allow any custom FRONTEND_URL set via env var
if settings.FRONTEND_URL and settings.FRONTEND_URL not in allowed_origins:
    allowed_origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api")
app.include_router(books.router, prefix="/api")
app.include_router(reading.router, prefix="/api")


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }
