# FRAME — Video & Audio Format Utility

A modern, geometric Bauhaus-styled consumer web application to inspect media metadata, select available resolutions and formats, and stream-transcode downloads using **FastAPI**, **yt-dlp**, **FFmpeg**, and **React (Vite)**.

---

## 1. Features

- **No Database Dependency**: Completely stateless and memory-efficient. No PostgreSQL, SQLite, or Redis required.
- **Direct Stream Delivery**: Media is processed on disk and streamed in chunks directly to the browser. Large files are never buffered in Python RAM.
- **SSRF & Security Hardened**: Rejects localhost, loopback (`127.0.0.1`, `::1`), private networks (`10.x`, `172.16-31.x`, `192.168.x`), and cloud metadata (`169.254.169.254`). Rejects shell command injection by utilizing Python APIs directly without `shell=True`.
- **Dynamic Format & Quality Discovery**: Only displays resolutions and audio streams discovered in source metadata. Unavailable qualities are hidden or disabled.
- **Audio Extraction & Remuxing**: Convert audio directly to MP3 or M4A via FFmpeg postprocessors, or preserve best source streams without unnecessary re-encoding.
- **Automatic Lifecycle Cleanup**: Isolated per-download directories deleted immediately after stream completion, with background task fallbacks and stale file cleanup.
- **Concurrency Protection**: Bounded download semaphore to prevent CPU and disk exhaustion on constrained hosting tiers.

---

## 2. Tech Stack

- **Backend**: Python 3.11+, FastAPI, Uvicorn, yt-dlp, FFmpeg, FFprobe.
- **Frontend**: React 19, Vite, Lucide Icons, Vanilla CSS (custom design system tokens).
- **Deployment**:
  - Backend: Render Web Service via Docker with FFmpeg pre-installed.
  - Frontend: Vercel Static Site deployment.

---

## 3. Prerequisites

Before running locally, verify the following tools are installed:

1. **Python 3.10+**:
   ```powershell
   python --version
   ```
2. **Node.js 18+ and npm**:
   ```powershell
   node -v
   npm -v
   ```
3. **FFmpeg & FFprobe** (must be available in system `PATH`):
   ```powershell
   ffmpeg -version
   ffprobe -version
   ```
   > *Windows Tip:* If `ffmpeg` is not found, install it via winget (`winget install Gyan.FFmpeg`) or Chocolatey (`choco install ffmpeg`), then restart your terminal.

---

## 4. Local Setup (Windows PowerShell)

### Step 1: Clone or Navigate to the Project

```powershell
cd "c:\Users\ayush\OneDrive\Documents\ANTIGRAVITY PROJECTS\YT CRUNCHBOX"
```

### Step 2: Backend Setup

In your first PowerShell terminal:

```powershell
# Navigate to backend
cd backend

# (Optional) Create and activate a virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install backend dependencies
pip install -r requirements.txt

# Verify dependencies and FFmpeg
python -c "import fastapi, yt_dlp; print('Python dependencies OK')"
ffmpeg -version

# Launch the FastAPI development server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- API Base: `http://127.0.0.1:8000`
- Interactive Swagger Documentation: `http://127.0.0.1:8000/docs`
- Health Check: `http://127.0.0.1:8000/api/health`

### Step 3: Frontend Setup

In a second PowerShell terminal:

```powershell
# Navigate to frontend
cd frontend

# Install npm dependencies
npm install

# Start Vite development server
npm run dev
```

- Local Web App: `http://localhost:5173`

---

## 5. API Endpoints

### 1. Health Check
`GET /api/health`

Response (`200 OK`):
```json
{
  "status": "ok",
  "yt_dlp_available": true,
  "ffmpeg_available": true
}
```

### 2. Extract Video Info
`POST /api/info`

Request Body:
```json
{
  "url": "https://www.youtube.com/watch?v=example"
}
```

Response (`200 OK`):
```json
{
  "title": "Example Video Title",
  "thumbnail": "https://i.ytimg.com/vi/example/maxresdefault.jpg",
  "duration": 214,
  "extractor": "Youtube",
  "webpage_url": "https://www.youtube.com/watch?v=example",
  "available_qualities": ["1080p", "720p", "480p", "360p"],
  "formats": [
    {
      "format_id": "137",
      "ext": "mp4",
      "resolution": "1920x1080",
      "height": 1080,
      "vcodec": "avc1.640028",
      "acodec": null,
      "filesize": 25165824,
      "has_video": true,
      "has_audio": false,
      "fps": 30
    }
  ]
}
```

### 3. Stream Download
`POST /api/download`

Request Body:
```json
{
  "url": "https://www.youtube.com/watch?v=example",
  "mode": "video",
  "container": "mp4",
  "quality": "1080p",
  "audio_format": "mp3"
}
```

Response:
- Binary media stream (`video/mp4`, `video/webm`, or `audio/mpeg`).
- Header: `Content-Disposition: attachment; filename="Example Video Title.mp4"`
- Cleaned from temporary server disk automatically upon completion.

---

## 6. Environment Variables

### Backend (`backend/.env` or Render environment settings)
| Variable | Default | Description |
|---|---|---|
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Production origin allowed for CORS (e.g. `https://yt-crunchbox.vercel.app`) |
| `TEMP_DIR` | `/tmp/video-downloader` | Ephemeral directory for processing intermediate downloads |
| `MAX_CONCURRENT_DOWNLOADS` | `1` | Max active downloads processed simultaneously (returns 503 if busy) |
| `ENVIRONMENT` | `development` | Set to `production` when deployed |

### Frontend (`frontend/.env` or Vercel environment settings)
| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://127.0.0.1:8000` | URL of the deployed FastAPI backend (e.g. `https://yt-crunchbox.onrender.com`) |

---

## 7. Deployment Instructions

### Deploying the Backend to Render

1. Log in to [Render](https://dashboard.render.com/) and click **New > Web Service**.
2. Connect your Git repository.
3. Configure the service:
   - **Environment / Runtime**: `Docker`
   - **Root Directory**: `backend` (or build context `backend`)
   - **Dockerfile Path**: `Dockerfile`
   - **Instance Type**: Free tier or Starter
   - **Health Check Path**: `/api/health`
4. Set Environment Variables in Render:
   - `FRONTEND_ORIGIN`: Your Vercel frontend URL (e.g., `https://your-app.vercel.app`)
   - `TEMP_DIR`: `/tmp/video-downloader`
   - `MAX_CONCURRENT_DOWNLOADS`: `1`
5. Click **Create Web Service**.

> **Important Render Free Constraints:**
> - Render Free instances sleep after 15 minutes of inactivity. Initial wakeups may take 45-60 seconds.
> - Free instances have 512 MB RAM and shared ephemeral disk. Large 2GB+ downloads will exceed container memory or ephemeral disk space. Keep downloads to reasonable resolutions and lengths.
> - The filesystem is ephemeral and reset upon container restarts.

### Deploying the Frontend to Vercel

1. Log in to [Vercel](https://vercel.com/) and click **Add New > Project**.
2. Select your repository.
3. Set **Root Directory** to `frontend`.
4. Configure Build & Development Settings:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Add Environment Variable:
   - `VITE_API_URL`: Your deployed Render backend URL (e.g. `https://yt-crunchbox.onrender.com`) without trailing slash.
6. Click **Deploy**.

---

## 8. Troubleshooting Guide

- **`ffmpeg` or `ffprobe` not found**:
  Verify `ffmpeg -version` works in the terminal where `uvicorn` is executed. In Docker, `apt-get install -y ffmpeg` is preconfigured in `backend/Dockerfile`.
- **CORS Error on frontend**:
  Ensure the backend's `FRONTEND_ORIGIN` matches your exact Vercel frontend URL (including `https://` and no trailing slash).
- **Backend returns 503 Busy**:
  The backend restricts concurrent operations (`MAX_CONCURRENT_DOWNLOADS=1`) to prevent server overload. Wait a few moments for the active transcode to finish and retry.
- **Source-Site Extraction Error**:
  Ensure `yt-dlp` is updated to the latest release (`pip install --upgrade yt-dlp`). Some streaming platforms update their signatures frequently.
- **Private / Restricted / DRM Videos**:
  Videos requiring user authentication, age confirmation, or DRM keys cannot be extracted. The API will return a user-friendly error.

---

## 9. Legal & Authorized-Use Notice

This software is designed solely for content you own or are legally authorized to download. Users are responsible for complying with the source platform's Terms of Service, applicable copyright legislation, and intellectual property rights. This tool does not implement DRM circumvention, authentication bypass, or paywall circumvention.
