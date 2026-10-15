import os
import uuid
import logging
from pathlib import Path
from typing import Optional, Literal

from fastapi import APIRouter, HTTPException, BackgroundTasks, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.utils.security import (
    validate_and_sanitize_url,
    mask_url_for_logging,
    sanitize_filename,
    make_content_disposition_header
)
from app.utils.cleanup import cleanup_path
from app.services.ytdlp_service import (
    download_media_sync,
    download_semaphore,
    active_job_progress,
)

logger = logging.getLogger("routes.download")
router = APIRouter()

class DownloadRequest(BaseModel):
    url: str
    mode: Literal["video", "audio"] = "video"
    container: Optional[str] = "mp4"
    quality: Optional[str] = "best"
    audio_format: Optional[str] = "mp3"
    job_id: Optional[str] = None


def get_media_type(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    mime_map = {
        "mp4": "video/mp4",
        "webm": "video/webm",
        "mkv": "video/x-matroska",
        "mp3": "audio/mpeg",
        "m4a": "audio/mp4",
        "opus": "audio/opus",
        "ogg": "audio/ogg",
        "wav": "audio/wav",
    }
    return mime_map.get(ext, "application/octet-stream")


async def stream_and_cleanup(file_path: Path, temp_dir: Path, job_id: Optional[str] = None, chunk_size: int = 65536):
    """
    Yields chunks of the file for streaming, and guarantees deletion of
    the temporary directory once streaming finishes or client disconnects.
    """
    try:
        with open(file_path, "rb") as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                yield chunk
    except Exception as e:
        logger.warning("Streaming interrupted for %s: %s", file_path.name, e)
        raise
    finally:
        logger.info("Streaming ended. Cleaning up temporary directory %s", temp_dir)
        cleanup_path(temp_dir)
        if job_id:
            active_job_progress.pop(job_id, None)


@router.get("/progress/{job_id}")
async def get_download_progress(job_id: str):
    """
    Returns real-time progress of an ongoing download.
    """
    progress = active_job_progress.get(job_id)
    if not progress:
        return {"status": "preparing", "percent": 0, "message": "Connecting to source..."}
    return progress


@router.post("/download")
async def start_download(payload: DownloadRequest):
    """
    Downloads media with real-time progress hooks and streams the output directly to the client.
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
        logger.warning("URL validation error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    # Validate mode and formats
    mode = payload.mode
    container = (payload.container or "mp4").lower()
    quality = (payload.quality or "best").lower()
    audio_format = (payload.audio_format or "mp3").lower()
    client_job_id = payload.job_id or f"job_{uuid.uuid4().hex[:10]}"

    if mode == "video" and container not in ("mp4", "webm"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Container must be 'mp4' or 'webm' for video mode."
        )

    if mode == "audio" and audio_format not in ("mp3", "m4a", "best"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio format must be 'mp3', 'm4a', or 'best'."
        )

    # Concurrency control: check if semaphore is available
    if download_semaphore.locked():
        logger.warning("Download rejected: concurrent download limit reached.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The downloader is currently busy processing another media file. Please try again in a few moments."
        )

    # Create dedicated per-download temp directory
    temp_dir = Path(settings.TEMP_DIR) / f"job_{client_job_id}"
    temp_dir.mkdir(parents=True, exist_ok=True)

    active_job_progress[client_job_id] = {
        "status": "preparing",
        "percent": 0,
        "message": "Connecting to source..."
    }

    masked_url = mask_url_for_logging(safe_url)
    logger.info("Starting download job %s for %s (mode=%s, quality=%s)", client_job_id, masked_url, mode, quality)

    # Acquire semaphore for download & processing phase
    try:
        async with download_semaphore:
            import asyncio
            output_file, safe_filename = await asyncio.to_thread(
                download_media_sync,
                url=safe_url,
                mode=mode,
                container=container,
                quality=quality,
                audio_format=audio_format,
                target_dir=str(temp_dir),
                job_id=client_job_id,
            )
    except ValueError as e:
        cleanup_path(temp_dir)
        active_job_progress.pop(client_job_id, None)
        logger.warning("Download error for job %s: %s", client_job_id, e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        cleanup_path(temp_dir)
        active_job_progress.pop(client_job_id, None)
        logger.error("Unexpected error for job %s: %s", client_job_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while preparing your download. Please check the URL and try again."
        )

    if not output_file.exists():
        cleanup_path(temp_dir)
        active_job_progress.pop(client_job_id, None)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Media file was not created properly."
        )

    file_size = output_file.stat().st_size
    media_type = get_media_type(safe_filename)

    # Safely generate RFC 6266 / RFC 5987 header (ASCII fallback prevents UnicodeEncodeError in ASGI)
    content_disposition = make_content_disposition_header(safe_filename)

    headers = {
        "Content-Disposition": content_disposition,
        "Content-Length": str(file_size),
        "Access-Control-Expose-Headers": "Content-Disposition, Content-Length",
    }

    return StreamingResponse(
        stream_and_cleanup(output_file, temp_dir, client_job_id),
        media_type=media_type,
        headers=headers,
    )
