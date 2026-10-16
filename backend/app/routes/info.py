import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.utils.security import validate_and_sanitize_url, mask_url_for_logging
from app.services.ytdlp_service import fetch_video_info, fetch_playlist_info

logger = logging.getLogger("routes.info")
router = APIRouter()

class InfoRequest(BaseModel):
    url: str

@router.post("/info")
async def get_video_info(payload: InfoRequest):
    """
    Extracts normalized video metadata from a validated URL.
    """
    raw_url = payload.url.strip() if payload.url else ""
    if not raw_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A video URL is required."
        )

    try:
        safe_url = validate_and_sanitize_url(raw_url)
    except ValueError as e:
        logger.warning("URL validation failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    masked_url = mask_url_for_logging(safe_url)
    logger.info("Fetching info for URL: %s", masked_url)

    try:
        info_data = await fetch_video_info(safe_url)
        return info_data
    except ValueError as e:
        logger.warning("Metadata extraction failed for %s: %s", masked_url, e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Unexpected error fetching info for %s: %s", masked_url, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while analyzing the video URL. Please try again."
        )


@router.post("/playlist")
async def get_playlist_info(payload: InfoRequest):
    """
    Extracts playlist metadata and entry listing from a validated URL.
    """
    raw_url = payload.url.strip() if payload.url else ""
    if not raw_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A playlist URL is required."
        )

    try:
        safe_url = validate_and_sanitize_url(raw_url)
    except ValueError as e:
        logger.warning("Playlist URL validation failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    masked_url = mask_url_for_logging(safe_url)
    logger.info("Fetching playlist entries for URL: %s", masked_url)

    try:
        playlist_data = await fetch_playlist_info(safe_url)
        return playlist_data
    except ValueError as e:
        logger.warning("Playlist extraction failed for %s: %s", masked_url, e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Unexpected error fetching playlist for %s: %s", masked_url, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while reading the playlist. Please try again."
        )


@router.get("/debug")
async def debug_extraction(url: str = "https://youtu.be/EmSNAtcHLm8"):
    """
    Diagnostic endpoint to inspect raw yt-dlp logs and POT token provider status.
    """
    import urllib.request
    import json
    import yt_dlp
    from app.services.ytdlp_service import (
        DEFAULT_EXTRACTOR_ARGS,
        DEFAULT_JS_RUNTIMES,
        DEFAULT_HTTP_HEADERS,
        get_effective_extractor_args,
        check_dependencies,
    )

    effective_args = get_effective_extractor_args(url)
    debug_data = {
        "dependencies": check_dependencies(),
        "extractor_args": effective_args,
    }

    # 1. Check bgutil-pot ping
    try:
        req = urllib.request.Request("http://127.0.0.1:4416/ping")
        with urllib.request.urlopen(req, timeout=2) as r:
            debug_data["pot_ping"] = json.loads(r.read().decode())
    except Exception as e:
        debug_data["pot_ping_error"] = str(e)

    # 2. Check bgutil-pot /get_pot
    try:
        pot_req_data = json.dumps({"content_binding": "EmSNAtcHLm8"}).encode()
        req = urllib.request.Request(
            "http://127.0.0.1:4416/get_pot",
            data=pot_req_data,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as r:
            res = json.loads(r.read().decode())
            debug_data["pot_sample"] = {
                "has_token": bool(res.get("poToken")),
                "token_preview": (res.get("poToken") or "")[:20],
                "error": res.get("error"),
            }
    except Exception as e:
        debug_data["pot_sample_error"] = str(e)

    # 3. Run extraction with custom logger to capture exact yt-dlp messages
    logs = []

    class DiagnosticLogger:
        def debug(self, msg): logs.append(f"[DEBUG] {msg}")
        def info(self, msg): logs.append(f"[INFO] {msg}")
        def warning(self, msg): logs.append(f"[WARNING] {msg}")
        def error(self, msg): logs.append(f"[ERROR] {msg}")

    ydl_opts = {
        "skip_download": True,
        "quiet": False,
        "verbose": True,
        "socket_timeout": 15,
        "noplaylist": True,
        "extractor_args": effective_args,
        "js_runtimes": DEFAULT_JS_RUNTIMES,
        "http_headers": DEFAULT_HTTP_HEADERS,
        "logger": DiagnosticLogger(),
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            debug_data["extraction"] = "SUCCESS"
            debug_data["title"] = info.get("title")
            debug_data["formats_found"] = len(info.get("formats", []))
    except Exception as e:
        debug_data["extraction"] = "FAILED"
        debug_data["error_type"] = type(e).__name__
        debug_data["error_message"] = str(e)

    debug_data["recent_logs"] = logs[-30:]
    return debug_data
