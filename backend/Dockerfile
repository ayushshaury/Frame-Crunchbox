FROM python:3.11-slim

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Install system dependencies: ffmpeg, ca-certificates, curl, unzip, and Node.js 22
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg ca-certificates curl unzip gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Deno (yt-dlp primary supported JS challenge engine)
ENV DENO_INSTALL=/usr/local
RUN curl -fsSL https://deno.land/install.sh | sh && \
    chmod 755 /usr/local/bin/deno

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
    mkdir -p /tmp/video-downloader /home/appuser/.cache && \
    chown -R appuser:appuser /tmp/video-downloader /app /home/appuser

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

# Start the FastAPI application (lifespan asynchronously manages bgutil-pot daemon)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
