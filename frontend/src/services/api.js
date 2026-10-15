const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

/**
 * Checks backend health and dependency availability.
 */
export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });
    if (!res.ok) {
      throw new Error(`Health check failed with status ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    return {
      status: "unreachable",
      yt_dlp_available: false,
      ffmpeg_available: false,
      error: err.message
    };
  }
}

/**
 * Extracts video metadata and available formats for a URL.
 */
export async function fetchVideoInfo(url) {
  const res = await fetch(`${API_BASE}/api/info`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({ url })
  });

  if (!res.ok) {
    let errorDetail = "Failed to retrieve video information.";
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        errorDetail = errJson.detail;
      }
    } catch {
      // response wasn't JSON
    }
    throw new Error(errorDetail);
  }

  return await res.json();
}

/**
 * Extracts playlist entries and summary metadata.
 */
export async function fetchPlaylistInfo(url) {
  const res = await fetch(`${API_BASE}/api/playlist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({ url })
  });

  if (!res.ok) {
    let errorDetail = "Failed to retrieve playlist information.";
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        errorDetail = errJson.detail;
      }
    } catch {
      // response wasn't JSON
    }
    throw new Error(errorDetail);
  }

  return await res.json();
}

/**
 * Downloads the requested media stream with active backend polling and browser stream progress.
 */
export async function downloadMediaStream(payload, onProgress) {
  const jobId = payload.job_id || `job_${Math.random().toString(36).substring(2, 10)}`;
  const requestPayload = { ...payload, job_id: jobId };

  let pollInterval = null;

  // Poll backend progress while waiting for media preparation
  if (onProgress) {
    pollInterval = setInterval(async () => {
      try {
        const pRes = await fetch(`${API_BASE}/api/progress/${jobId}`);
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData && onProgress) {
            onProgress({
              phase: pData.status || "downloading",
              percent: pData.percent,
              received: pData.downloaded,
              total: pData.total,
              speed: pData.speed,
              eta: pData.eta,
              message: pData.message,
            });
          }
        }
      } catch {
        // Silently ignore polling network hiccups
      }
    }, 400);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}/api/download`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestPayload)
    });
  } catch (err) {
    if (pollInterval) clearInterval(pollInterval);
    throw err;
  }

  // Once response arrives, stop backend poll
  if (pollInterval) clearInterval(pollInterval);

  if (!res.ok) {
    let errorDetail = "Download failed.";
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        errorDetail = errJson.detail;
      }
    } catch {
      // response wasn't JSON
    }
    throw new Error(errorDetail);
  }

  // Parse filename from Content-Disposition header
  const disposition = res.headers.get("Content-Disposition") || "";
  let filename = "media_download";

  // Try filename*=UTF-8''... (RFC 5987)
  const utf8FilenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8FilenameMatch && utf8FilenameMatch[1]) {
    try {
      filename = decodeURIComponent(utf8FilenameMatch[1]);
    } catch {
      filename = utf8FilenameMatch[1];
    }
  } else {
    // Try filename="..."
    const standardMatch = disposition.match(/filename="?([^";]+)"?/i);
    if (standardMatch && standardMatch[1]) {
      filename = standardMatch[1];
    }
  }

  const contentLength = res.headers.get("Content-Length");
  const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

  if (!res.body) {
    const blob = await res.blob();
    triggerBrowserSave(blob, filename);
    return { filename, size: blob.size };
  }

  const reader = res.body.getReader();
  const chunks = [];
  let receivedBytes = 0;
  const streamStartTime = Date.now();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedBytes += value.length;

    if (onProgress) {
      const elapsedSec = (Date.now() - streamStartTime) / 1000;
      const speedBps = elapsedSec > 0 ? receivedBytes / elapsedSec : 0;
      const speedMb = (speedBps / (1024 * 1024)).toFixed(1);
      const percent = totalBytes > 0 ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : 100;
      const remainingBytes = totalBytes > receivedBytes ? totalBytes - receivedBytes : 0;
      const etaSec = speedBps > 0 && remainingBytes > 0 ? Math.round(remainingBytes / speedBps) : null;

      onProgress({
        phase: "streaming",
        received: receivedBytes,
        total: totalBytes,
        percent,
        speed: `${speedMb} MB/s`,
        eta: etaSec !== null ? `${etaSec}s` : null,
      });
    }
  }

  const completeBlob = new Blob(chunks, {
    type: res.headers.get("Content-Type") || "application/octet-stream"
  });

  triggerBrowserSave(completeBlob, filename);
  return { filename, size: completeBlob.size };
}

function triggerBrowserSave(blob, filename) {
  let safeName = filename || "download.mp4";
  if (!safeName.includes(".")) {
    safeName += ".mp4";
  }
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(url), 2000);
}
