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
