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


def check_dependencies() -> Dict[str, bool]:
    """
    Checks if yt-dlp and ffmpeg are available.
    """
    yt_dlp_ok = True
    ffmpeg_ok = False
    try:
        import shutil
        ffmpeg_path = shutil.which("ffmpeg")
        ffprobe_path = shutil.which("ffprobe")
        ffmpeg_ok = bool(ffmpeg_path and ffprobe_path)
    except Exception:
        ffmpeg_ok = False

    return {
        "yt_dlp_available": yt_dlp_ok,
        "ffmpeg_available": ffmpeg_ok,
    }


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
    Synchronously extracts metadata using yt-dlp with safe options.
    """
    ydl_opts = {
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
        "socket_timeout": 15,
        "noplaylist": True,
        "extract_flat": False,
        "remote_components": ["ejs:github"],
        "js_runtimes": {"node": {}},
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
            logger.warning("yt-dlp extraction error: %s", err_msg)
            if "Unsupported URL" in err_msg:
                raise ValueError("The provided URL is not supported by the video extractor.")
            if "Private video" in err_msg:
                raise ValueError("This video is private or restricted.")
            if "Sign in" in err_msg or "age" in err_msg.lower():
                raise ValueError("This video requires authentication or age verification and cannot be downloaded.")
            if "DRM" in err_msg or "drm" in err_msg.lower():
                raise ValueError("This video is protected by DRM and cannot be downloaded.")
            clean_err = re.sub(r"\[.*?\]\s*", "", err_msg).strip()
            raise ValueError(f"Unable to process video: {clean_err[:150]}")
        except Exception as e:
            logger.error("Unexpected error during info extraction: %s", e)
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
        "no_warnings": True,
        "socket_timeout": 15,
        "extract_flat": True,
        "playlistend": 50,
        "playlist_items": "1-50",
        "remote_components": ["ejs:github"],
        "js_runtimes": {"node": {}},
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
            logger.warning("yt-dlp playlist extraction error: %s", err_msg)
            clean_err = re.sub(r"\[.*?\]\s*", "", err_msg).strip()
            raise ValueError(f"Unable to process playlist: {clean_err[:150]}")
        except Exception as e:
            logger.error("Unexpected error during playlist extraction: %s", e)
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
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": 30,
        "windowsfilenames": True,
        "retries": 3,
        "concurrent_fragment_downloads": 5,
        "buffersize": 1048576,
        "http_chunk_size": 10485760,
        "remote_components": ["ejs:github"],
        "js_runtimes": {"node": {}},
        "progress_hooks": [progress_hook],
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
            logger.warning("yt-dlp download error: %s", err_msg)
            if "DRM" in err_msg or "drm" in err_msg.lower():
                raise ValueError("This video is DRM protected and cannot be downloaded.")
            if "Sign in" in err_msg:
                raise ValueError("This video requires sign-in or authorization.")
            clean_err = re.sub(r"\[.*?\]\s*", "", err_msg).strip()
            raise ValueError(f"Download failed: {clean_err[:150]}")
        except Exception as e:
            logger.error("Unexpected download exception: %s", e)
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
