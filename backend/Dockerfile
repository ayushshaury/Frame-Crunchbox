FROM python:3.11-slim

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Install system dependencies: ffmpeg, nodejs, ca-certificates, and curl
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg nodejs ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

# Install bgutil-pot (Rust Proof-of-Origin Token provider to bypass datacenter bot challenges)
# Download an architecture-appropriate prebuilt binary when available; otherwise continue without failing the build.
RUN set -eux; \
    arch="$(uname -m)"; \
    case "$arch" in \
      x86_64) asset="bgutil-pot-linux-x86_64" ;; \
      aarch64|arm64) asset="bgutil-pot-linux-aarch64" ;; \
      *) asset="" ;; \
    esac; \
    if [ -n "$asset" ]; then \
      url="https://github.com/jim60105/bgutil-ytdlp-pot-provider-rs/releases/download/v0.8.1/${asset}"; \
      echo "Attempting to download bgutil-pot for arch=$arch from $url"; \
      if curl -fSL -o /usr/local/bin/bgutil-pot "$url"; then \
        chmod 755 /usr/local/bin/bgutil-pot; \
        echo "bgutil-pot downloaded and installed to /usr/local/bin/bgutil-pot"; \
      else \
        echo "Warning: failed to download bgutil-pot for $arch from $url; continuing without POT provider"; \
        rm -f /usr/local/bin/bgutil-pot || true; \
      fi; \
    else \
      echo "No prebuilt bgutil-pot available for architecture: $arch; skipping download"; \
    fi

# Create working directory and unprivileged user
WORKDIR /app
RUN useradd -m -u 1000 appuser && \
    mkdir -p /tmp/video-downloader && \
    chown -R appuser:appuser /tmp/video-downloader /app

# Copy dependency specifications and install
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code and yt-dlp plugins
COPY app/ app/
COPY yt_dlp_plugins/ yt_dlp_plugins/
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose Render default port
EXPOSE 10000

# Default environment configuration
ENV TEMP_DIR=/tmp/video-downloader
ENV PORT=10000

# Start bgutil-pot server if present (non-fatal if missing), then the FastAPI app
CMD ["sh", "-c", "/usr/local/bin/bgutil-pot server --host 127.0.0.1 --port 4416 2>/dev/null || echo 'bgutil-pot not started'; uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
