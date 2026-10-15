import asyncio
import os
import re
import uuid
import logging
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from typing import Dict, Any, List, Optional, Tuple

import yt_dlp
from yt_dlp.utils import DownloadError, ExtractorError, UnsupportedError

from app.config import settings
from app.utils.cleanup import cleanup_path
from app.utils.security import sanitize_filename

logger = logging.getLogger("ytdlp_service")

# Global semaphore to enforce MAX_CONCURRENT_DOWNLOADS
download_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_DOWNLOADS)

# In-memory dictionary tracking real-time progress for active downloads
active_job_progress: Dict[str, Dict[str, Any]] = {}


DEFAULT_EXTRACTOR_ARGS: Dict[str, Any] = {
    "youtube": {
        "player_client": ["tv_simply", "default"]
    }
}


def check_dependencies() -> Dict[str, Any]:
    """
    Checks if yt-dlp, ffmpeg, ffprobe, and JavaScript runtimes are available.
    """
    import shutil
    ffmpeg_path = shutil.which("ffmpeg")
    ffprobe_path = shutil.which("ffprobe")
    node_path = shutil.which("node")
    deno_path = shutil.which("deno")
    
    js_runtime = node_path or deno_path or None
    
    ejs_ok = False
    try:
        import yt_dlp_ejs
        ejs_ok = True
    except ImportError:
        ejs_ok = False

    yt_version = getattr(yt_dlp, "version", None)
    version_str = getattr(yt_version, "__version__", "unknown") if yt_version else "unknown"

    return {
        "yt_dlp_available": True,
        "yt_dlp_version": version_str,
        "ffmpeg_available": bool(ffmpeg_path and ffprobe_path),
        "js_runtime_available": bool(js_runtime),
        "js_runtime_path": js_runtime,
        "ejs_available": ejs_ok,
    }


def classify_ytdlp_error(err_msg: str) -> str:
    """
    Categorizes yt-dlp extraction/download failures into precise, user-safe messages
    without mislabeling generic extraction errors as rate-limit blocks.
    """
    lower = err_msg.lower()

    if "429" in err_msg or "too many requests" in lower:
        return "YouTube has temporarily rate-limited anonymous requests from this server IP. Please wait a few minutes before trying again."

    if "sign in to confirm you're not a bot" in lower or "bot verification" in lower:
        return "YouTube requires bot verification for this video from the current network. Please try another video or try again shortly."

    if "sign in" in lower and ("confirm your age" in lower or "age" in lower):
        return "This video is age-restricted and requires account authentication to access."

    if "members-only" in lower or "join this channel" in lower:
        return "This video is restricted to channel members only."

    if "private video" in lower:
        return "This video is private or restricted by its owner."

    if "video unavailable" in lower or "does not exist" in lower:
        return "This video is unavailable or has been removed."

    if "geo-restricted" in lower or "not available in your country" in lower:
        return "This video is geographically restricted and unavailable from this server."

    if "drm" in lower:
        return "This video is protected by DRM and cannot be processed."

    if "unsupported url" in lower:
        return "The provided URL is not supported by the video extractor."

    # General clean fallback
    clean = re.sub(r"\[.*?\]\s*", "", err_msg).strip()
    clean = re.sub(r"ERROR:\s*", "", clean).strip()
    return f"Unable to process video: {clean[:120]}"


def normalize_metadata(info: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizes raw yt-dlp info into a compact, UI-friendly dictionary.
    Excludes sensitive/raw internals and redundant formats.
    """
    title = info.get("title") or "Untitled Media"
    thumbnail = info.get("thumbnail")
    duration = info.get("duration")
    extractor = info.get("extractor_key") or info.get("extractor") or "Unknown"

    raw_formats = info.get("formats", [])
    normalized_formats: List[Dict[str, Any]] = []
    discovered_heights = set()

    for f in raw_formats:
        vcodec = f.get("vcodec")
        acodec = f.get("acodec")
        has_video = vcodec not in (None, "none")
        has_audio = acodec not in (None, "none")

        if not has_video and not has_audio:
            continue

        height = f.get("height")
        if height and has_video:
            discovered_heights.add(height)

        format_item = {
            "format_id": str(f.get("format_id", "")),
            "ext": f.get("ext", ""),
            "resolution": f.get("resolution") or (f"{height}p" if height else "audio only"),
            "height": height,
            "vcodec": vcodec if has_video else None,
            "acodec": acodec if has_audio else None,
            "filesize": f.get("filesize") or f.get("filesize_approx"),
            "has_video": has_video,
            "has_audio": has_audio,
            "fps": f.get("fps"),
        }
        normalized_formats.append(format_item)

    # Sort available heights descending (e.g. 2160, 1440, 1080, 720, 480, 360)
    sorted_heights = sorted(list(discovered_heights), reverse=True)
    available_qualities = [f"{h}p" for h in sorted_heights]

    return {
        "title": title,
        "thumbnail": thumbnail,
        "duration": duration,
        "extractor": extractor,
        "webpage_url": info.get("webpage_url"),
        "available_qualities": available_qualities,
        "formats": normalized_formats,
    }


def fetch_video_info_sync(url: str) -> Dict[str, Any]:
    """
    Synchronously extracts metadata using yt-dlp with safe options, client fallbacks, and challenge solving.
    """
    ydl_opts = {
        "skip_download": True,
        "quiet": True,
        "no_warnings": False,
        "socket_timeout": 20,
        "noplaylist": True,
        "extract_flat": False,
        "extractor_args": DEFAULT_EXTRACTOR_ARGS,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            if not info:
                raise ValueError("Could not extract video metadata from this URL.")
            # Handle playlist containing single video or entry list
            if "entries" in info:
                entries = list(info["entries"])
                if entries:
                    info = entries[0]
                else:
                    raise ValueError("No video entries found in the provided URL.")
            return normalize_metadata(info)
        except (DownloadError, ExtractorError, UnsupportedError) as e:
            err_msg = str(e)
            logger.error("yt-dlp extraction failed for %s: %s", url, err_msg, exc_info=True)
            raise ValueError(classify_ytdlp_error(err_msg))
        except Exception as e:
            logger.error("Unexpected error during info extraction for %s: %s", url, e, exc_info=True)
            raise ValueError("An unexpected error occurred while fetching video info.")


async def fetch_video_info(url: str) -> Dict[str, Any]:
    """
    Asynchronously executes fetch_video_info_sync on thread pool.
    """
    return await asyncio.to_thread(fetch_video_info_sync, url)


def fetch_playlist_info_sync(url: str) -> Dict[str, Any]:
    """
    Ultra-fast playlist metadata extraction using flat mode and challenge solver.
    Fetches up to 50 items in under 2 seconds.
    """
    ydl_opts = {
        "skip_download": True,
        "quiet": True,
        "no_warnings": False,
        "socket_timeout": 25,
        "extract_flat": True,
        "playlistend": 50,
        "playlist_items": "1-50",
        "extractor_args": DEFAULT_EXTRACTOR_ARGS,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            if not info:
                raise ValueError("Could not extract playlist information from this URL.")

            raw_entries = info.get("entries")
            if raw_entries is None:
                raw_entries = [info]
            elif not isinstance(raw_entries, list):
                raw_entries = list(raw_entries)

            entries = []
            for idx, entry in enumerate(raw_entries):
                if not entry:
                    continue
                video_id = entry.get("id") or f"item_{idx+1}"
                video_url = entry.get("url")

                # Generate clean single-video URL without playlist params
                if not video_url or not video_url.startswith("http"):
                    video_url = f"https://www.youtube.com/watch?v={video_id}"
                elif "youtube.com" in video_url and "v=" in video_url:
                    video_url = f"https://www.youtube.com/watch?v={video_id}"

                thumb = entry.get("thumbnail")
                if not thumb and entry.get("thumbnails"):
                    thumb = entry["thumbnails"][-1].get("url")

                entries.append({
                    "index": idx + 1,
                    "id": str(video_id),
                    "title": entry.get("title") or f"Item {idx + 1}",
                    "url": video_url,
                    "duration": entry.get("duration"),
                    "thumbnail": thumb,
                    "uploader": entry.get("uploader") or entry.get("channel"),
                })

            return {
                "title": info.get("title") or "Media Playlist",
                "extractor": info.get("extractor_key") or info.get("extractor") or "Playlist",
                "webpage_url": info.get("webpage_url") or url,
                "total_items": len(entries),
                "items": entries,
            }
        except (DownloadError, ExtractorError, UnsupportedError) as e:
            err_msg = str(e)
            logger.error("yt-dlp playlist extraction failed for %s: %s", url, err_msg, exc_info=True)
            raise ValueError(classify_ytdlp_error(err_msg))
        except Exception as e:
            logger.error("Unexpected error during playlist extraction for %s: %s", url, e, exc_info=True)
            raise ValueError("An unexpected error occurred while fetching playlist info.")


async def fetch_playlist_info(url: str) -> Dict[str, Any]:
    return await asyncio.to_thread(fetch_playlist_info_sync, url)


def download_media_sync(
    url: str,
    mode: str,
    container: str,
    quality: str,
    audio_format: str,
    target_dir: str,
    job_id: Optional[str] = None
) -> Tuple[Path, str]:
    """
    Downloads and remuxes/extracts audio using high-speed direct streams
    with parallel fragment downloads, challenge solver, and progress hooks.
    """
    # Clean YouTube URLs from playlist parameters to prevent yt-dlp redundant checks
    if "youtube.com/watch" in url and "v=" in url:
        try:
            parsed = urlparse(url)
            qs = parse_qs(parsed.query)
            vid = qs.get("v", [None])[0]
            if vid:
                url = f"https://www.youtube.com/watch?v={vid}"
        except Exception:
            pass

    out_template = os.path.join(target_dir, "%(title).100B [%(id)s].%(ext)s")

    def progress_hook(d):
        if not job_id:
            return
        status = d.get("status")
        if status == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes") or 0
            speed = d.get("speed") or 0
            eta = d.get("eta")
            pct = round((downloaded / total) * 100, 1) if total > 0 else 5.0
            speed_mb = round(speed / (1024 * 1024), 1) if speed else None
            speed_str = f"{speed_mb} MB/s" if speed_mb else None
            eta_str = f"{int(eta)}s" if eta is not None else None

            active_job_progress[job_id] = {
                "status": "downloading",
                "percent": pct,
                "downloaded": downloaded,
                "total": total,
                "speed": speed_str,
                "eta": eta_str,
                "message": f"Downloading media stream ({speed_str or 'active'})...",
            }
        elif status == "finished":
            active_job_progress[job_id] = {
                "status": "remuxing",
                "percent": 99,
                "message": "Finalizing media stream with FFmpeg...",
            }

    ydl_opts: Dict[str, Any] = {
        "outtmpl": out_template,
        "quiet": True,
        "no_warnings": False,
        "noplaylist": True,
        "socket_timeout": 30,
        "windowsfilenames": True,
        "retries": 3,
        "concurrent_fragment_downloads": 5,
        "buffersize": 1048576,
        "http_chunk_size": 10485760,
        "progress_hooks": [progress_hook],
        "extractor_args": DEFAULT_EXTRACTOR_ARGS,
    }

    if mode == "audio":
        selected_fmt = audio_format.lower() if audio_format else "mp3"
        if selected_fmt == "mp3":
            ydl_opts["format"] = "bestaudio[protocol^=http]/bestaudio/best"
            ydl_opts["postprocessors"] = [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }]
        elif selected_fmt == "m4a":
            ydl_opts["format"] = "bestaudio[ext=m4a][protocol^=http]/bestaudio[ext=m4a]/bestaudio/best"
            ydl_opts["postprocessors"] = [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "m4a",
                "preferredquality": "192",
            }]
        else:
            ydl_opts["format"] = "bestaudio[protocol^=http]/bestaudio/best"
    else:
        # Video mode
        cnt = container.lower() if container else "mp4"
        if cnt not in ("mp4", "webm"):
            cnt = "mp4"

        ydl_opts["merge_output_format"] = cnt

        # Parse target quality
        target_height = None
        if quality and quality.lower() != "best":
            match = re.search(r"(\d+)", quality)
            if match:
                target_height = int(match.group(1))

        if target_height:
            if cnt == "mp4":
                ydl_opts["format"] = (
                    f"bestvideo[height<={target_height}][protocol^=http][ext=mp4]+bestaudio[ext=m4a]/"
                    f"bestvideo[height<={target_height}][protocol^=http]+bestaudio/"
                    f"bestvideo[height<={target_height}][ext=mp4]+bestaudio[ext=m4a]/"
                    f"bestvideo[height<={target_height}]+bestaudio/"
                    f"best[height<={target_height}][ext=mp4]/"
                    f"best[height<={target_height}]/best"
                )
            else:
                ydl_opts["format"] = (
                    f"bestvideo[height<={target_height}][protocol^=http][ext=webm]+bestaudio[ext=webm]/"
                    f"bestvideo[height<={target_height}][protocol^=http]+bestaudio/"
                    f"bestvideo[height<={target_height}][ext=webm]+bestaudio[ext=webm]/"
                    f"bestvideo[height<={target_height}]+bestaudio/"
                    f"best[height<={target_height}][ext=webm]/"
                    f"best[height<={target_height}]/best"
                )
        else:
            # Best available: prioritize crisp 1080p direct streams to prevent downloading massive 4K streams by default
            if cnt == "mp4":
                ydl_opts["format"] = (
                    "bestvideo[height<=1080][protocol^=http][ext=mp4]+bestaudio[ext=m4a]/"
                    "bestvideo[height<=1080][protocol^=http]+bestaudio/"
                    "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/"
                    "bestvideo[height<=1080]+bestaudio/"
                    "bestvideo[protocol^=http][ext=mp4]+bestaudio[ext=m4a]/"
                    "bestvideo[protocol^=http]+bestaudio/"
                    "bestvideo[ext=mp4]+bestaudio[ext=m4a]/"
                    "bestvideo+bestaudio/best[ext=mp4]/best"
                )
            else:
                ydl_opts["format"] = (
                    "bestvideo[height<=1080][protocol^=http][ext=webm]+bestaudio[ext=webm]/"
                    "bestvideo[height<=1080][protocol^=http]+bestaudio/"
                    "bestvideo[height<=1080][ext=webm]+bestaudio[ext=webm]/"
                    "bestvideo[height<=1080]+bestaudio/"
                    "bestvideo[protocol^=http][ext=webm]+bestaudio[ext=webm]/"
                    "bestvideo[protocol^=http]+bestaudio/"
                    "bestvideo[ext=webm]+bestaudio[ext=webm]/"
                    "bestvideo+bestaudio/best[ext=webm]/best"
                )

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            ydl.download([url])
        except (DownloadError, ExtractorError, UnsupportedError) as e:
            err_msg = str(e)
            logger.error("yt-dlp download failed for %s: %s", url, err_msg, exc_info=True)
            raise ValueError(classify_ytdlp_error(err_msg))
        except Exception as e:
            logger.error("Unexpected download exception for %s: %s", url, e, exc_info=True)
            raise ValueError("An unexpected error occurred during download processing.")

    # Locate generated output file
    target_path = Path(target_dir)
    completed_files = [
        f for f in target_path.iterdir()
        if f.is_file() and not f.name.endswith((".part", ".ytdl", ".temp"))
    ]

    if not completed_files:
        raise ValueError("Download finished but no output file was generated.")

    # Pick largest file if multiple
    main_file = max(completed_files, key=lambda f: f.stat().st_size)
    safe_name = sanitize_filename(main_file.name, default_name=f"download.{main_file.suffix.lstrip('.')}")
    return main_file, safe_name
