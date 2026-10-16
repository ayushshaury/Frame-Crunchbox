import sys
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Ensure stdout/stderr handles Unicode titles (Hindi, Arabic, emojis) safely on Windows
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from app.config import settings
from app.routes import info, download
from app.services.ytdlp_service import check_dependencies
from app.utils.cleanup import cleanup_stale_directories

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    logger.info("Starting up %s (Environment: %s)", settings.APP_NAME, settings.ENVIRONMENT)
    
    # Attempt spawning POT token provider server if binary is present
    from app.services.pot_service import start_pot_server, stop_pot_server
    start_pot_server()

    deps = check_dependencies()
    logger.info(
        "Dependency status: yt-dlp=%s (v%s), ffmpeg=%s, js_runtime=%s (%s), ejs=%s, pot_server=%s, pot_plugin=%s",
        deps["yt_dlp_available"],
        deps.get("yt_dlp_version"),
        deps["ffmpeg_available"],
        deps.get("js_runtime_available"),
        deps.get("js_runtime_path"),
        deps.get("ejs_available"),
        deps.get("pot_provider_available"),
        deps.get("pot_plugin_available"),
    )
    # Clean up any stale files from previous runs
    cleaned = cleanup_stale_directories(settings.TEMP_DIR, max_age_seconds=1800)
    logger.info("Cleaned %d stale directories from temp storage", cleaned)
    yield
    # Shutdown actions
    logger.info("Shutting down %s", settings.APP_NAME)
    stop_pot_server()
    cleanup_stale_directories(settings.TEMP_DIR, max_age_seconds=0)


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Length"],
)


@app.get("/api/health", tags=["System"])
async def health_check():
    """
    Returns the operational health of the backend and external dependencies.
    """
    deps = check_dependencies()
    return {
        "status": "ok",
        "app_version": "1.0.5",
        "yt_dlp_available": deps["yt_dlp_available"],
        "ffmpeg_available": deps["ffmpeg_available"],
        "js_runtime_available": deps.get("js_runtime_available", False),
        "ejs_available": deps.get("ejs_available", False),
        "pot_provider_available": deps.get("pot_provider_available", False),
        "pot_plugin_available": deps.get("pot_plugin_available", False),
        "yt_dlp_version": deps.get("yt_dlp_version", "unknown"),
    }


# Include sub-routers
app.include_router(info.router, prefix="/api", tags=["Media Info"])
app.include_router(download.router, prefix="/api", tags=["Media Download"])


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled server exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected server error occurred. Please try again later."}
    )
