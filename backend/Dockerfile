FROM python:3.11-slim

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Install system dependencies: ffmpeg, nodejs (JS runtime for yt-dlp EJS challenges), and ca-certificates
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg nodejs ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Create working directory and unprivileged user
WORKDIR /app
RUN useradd -m -u 1000 appuser && \
    mkdir -p /tmp/video-downloader && \
    chown -R appuser:appuser /tmp/video-downloader /app

# Copy dependency specifications and install
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY app/ app/
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose Render default port
EXPOSE 10000

# Default environment configuration
ENV TEMP_DIR=/tmp/video-downloader
ENV PORT=10000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
