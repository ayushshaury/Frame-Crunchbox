import os
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "Antigravity Video Downloader API"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Frontend origins allowed for CORS
    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    
    # Concurrency and limitations
    MAX_CONCURRENT_DOWNLOADS: int = int(os.getenv("MAX_CONCURRENT_DOWNLOADS", "1"))
    MAX_VIDEO_DURATION_SECONDS: int = int(os.getenv("MAX_VIDEO_DURATION_SECONDS", "7200"))  # 2 hours max
    DOWNLOAD_TIMEOUT_SECONDS: int = int(os.getenv("DOWNLOAD_TIMEOUT_SECONDS", "600"))  # 10 minutes max

    # POT (Proof-of-Origin Token) provider base URL. When set, the app will use this URL
    # instead of attempting to spawn a local bgutil-pot server. Example: "http://127.0.0.1:4416"
    POT_BASE_URL: Optional[str] = os.getenv("POT_BASE_URL", None)
    
    # Storage
    TEMP_DIR: str = os.getenv(
        "TEMP_DIR",
        str(Path(__file__).resolve().parent.parent / ".temp_downloads")
        if os.name == "nt"
        else "/tmp/video-downloader"
    )

settings = Settings()

# Add production FRONTEND_ORIGIN to allowed origins if specified
if settings.FRONTEND_ORIGIN and settings.FRONTEND_ORIGIN not in settings.ALLOWED_ORIGINS:
    settings.ALLOWED_ORIGINS.append(settings.FRONTEND_ORIGIN)

# Ensure temporary directory exists
Path(settings.TEMP_DIR).mkdir(parents=True, exist_ok=True)
