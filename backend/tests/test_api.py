import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "yt_dlp_available" in data
    assert "ffmpeg_available" in data

def test_info_empty_url():
    response = client.post("/api/info", json={"url": ""})
    assert response.status_code == 400
    assert "A video URL is required" in response.json()["detail"]

def test_info_ssrf_blocked():
    response = client.post("/api/info", json={"url": "http://127.0.0.1:8000/api/health"})
    assert response.status_code == 400
    assert "forbidden" in response.json()["detail"].lower()

@patch("app.routes.info.fetch_video_info")
def test_info_mocked_success(mock_fetch):
    mock_fetch.return_value = {
        "title": "Sample Test Video",
        "thumbnail": "https://example.com/thumb.jpg",
        "duration": 120,
        "extractor": "TestSite",
        "webpage_url": "https://example.com/video",
        "available_qualities": ["1080p", "720p"],
        "formats": [
            {
                "format_id": "137",
                "ext": "mp4",
                "resolution": "1920x1080",
                "height": 1080,
                "vcodec": "avc1",
                "acodec": None,
                "filesize": 10485760,
                "has_video": True,
                "has_audio": False,
                "fps": 30,
            }
        ]
    }

    response = client.post("/api/info", json={"url": "https://example.com/watch?v=mock123"})
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Sample Test Video"
    assert data["duration"] == 120
    assert "available_qualities" in data
    assert "1080p" in data["available_qualities"]


@patch("app.routes.info.fetch_video_info")
def test_info_mocked_extraction_failure(mock_fetch):
    mock_fetch.side_effect = ValueError("YouTube requires bot verification for this video from the current network. Please try another video or try again shortly.")
    response = client.post("/api/info", json={"url": "https://example.com/watch?v=mock123"})
    assert response.status_code == 400
    assert "bot verification" in response.json()["detail"]


def test_classify_ytdlp_error_handling():
    from app.services.ytdlp_service import classify_ytdlp_error
    
    # 429 rate limit
    msg_429 = classify_ytdlp_error("HTTP Error 429: Too Many Requests")
    assert "rate-limited" in msg_429
    
    # Bot challenge (should not be mislabeled as generic rate limit)
    msg_bot = classify_ytdlp_error("Sign in to confirm you're not a bot. This helps protect our community.")
    assert "bot verification" in msg_bot
    
    # Private video
    msg_priv = classify_ytdlp_error("Private video. Sign in if you've been granted access to this video")
    assert "private" in msg_priv
    
    # DRM
    msg_drm = classify_ytdlp_error("This video is DRM protected")
    assert "DRM" in msg_drm

def test_download_invalid_container():
    response = client.post("/api/download", json={
        "url": "https://example.com/watch?v=mock123",
        "mode": "video",
        "container": "avi",
        "quality": "1080p"
    })
    assert response.status_code == 400
    assert "Container must be 'mp4' or 'webm'" in response.json()["detail"]

def test_download_invalid_audio_format():
    response = client.post("/api/download", json={
        "url": "https://example.com/watch?v=mock123",
        "mode": "audio",
        "audio_format": "flac"
    })
    assert response.status_code == 400
    assert "Audio format must be" in response.json()["detail"]

@patch("app.routes.download.download_media_sync")
def test_download_mocked_streaming(mock_dl, tmp_path):
    # Create a small dummy output file
    dummy_file = tmp_path / "test_download.mp4"
    dummy_file.write_bytes(b"TEST_VIDEO_BYTES_STREAM")

    mock_dl.return_value = (dummy_file, "test_download.mp4")

    response = client.post("/api/download", json={
        "url": "https://example.com/watch?v=mock123",
        "mode": "video",
        "container": "mp4",
        "quality": "best"
    })

    assert response.status_code == 200
    assert response.content == b"TEST_VIDEO_BYTES_STREAM"
    assert "Content-Disposition" in response.headers
    assert "test_download.mp4" in response.headers["Content-Disposition"]

def test_cors_preflight():
    response = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"

def test_playlist_empty_url():
    response = client.post("/api/playlist", json={"url": ""})
    assert response.status_code == 400
    assert "playlist URL is required" in response.json()["detail"]

@patch("app.routes.info.fetch_playlist_info")
def test_playlist_mocked_success(mock_fetch_pl):
    mock_fetch_pl.return_value = {
        "title": "Study Collection Playlist",
        "extractor": "YoutubeTab",
        "webpage_url": "https://example.com/playlist?list=PL123",
        "total_items": 2,
        "items": [
            {
                "index": 1,
                "id": "vid1",
                "title": "Part 1 Introduction",
                "url": "https://example.com/watch?v=vid1",
                "duration": 300,
                "thumbnail": "https://example.com/t1.jpg",
                "uploader": "Instructor",
            },
            {
                "index": 2,
                "id": "vid2",
                "title": "Part 2 Core Concepts",
                "url": "https://example.com/watch?v=vid2",
                "duration": 450,
                "thumbnail": "https://example.com/t2.jpg",
                "uploader": "Instructor",
            }
        ]
    }

    response = client.post("/api/playlist", json={"url": "https://example.com/playlist?list=PL123"})
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Study Collection Playlist"
    assert data["total_items"] == 2
    assert len(data["items"]) == 2
    assert data["items"][0]["title"] == "Part 1 Introduction"


