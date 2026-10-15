import React from "react";
import { Loader2, DownloadCloud, CheckCircle, AlertCircle, Cpu } from "lucide-react";

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function ProgressIndicator({ status, progress, error, completedFilename }) {
  if (status === "idle") return null;

  const isPreparing = status === "preparing";
  const isDownloading = status === "downloading";
  const isSuccess = status === "success";
  const isError = status === "error";

  const percent = progress?.percent !== undefined && progress?.percent !== null ? Math.min(100, Math.max(0, progress.percent)) : null;

  let statusLabel = "Processing…";
  if (isPreparing) {
    if (progress?.phase === "downloading") {
      statusLabel = "Downloading stream from source…";
    } else if (progress?.phase === "remuxing") {
      statusLabel = "Remuxing media with FFmpeg…";
    } else {
      statusLabel = progress?.message || "Preparing media stream…";
    }
  } else if (isDownloading) {
    statusLabel = "Streaming to your device…";
  } else if (isSuccess) {
    statusLabel = `Saved: ${completedFilename || "File downloaded"}`;
  } else if (isError) {
    statusLabel = error || "Operation failed.";
  }

  return (
    <div className="bauhaus-progress-tray">
      {/* Bauhaus Geometric Streaming Visualizer */}
      {(isPreparing || isDownloading) && (
        <div className="geo-stream-visualizer" aria-hidden="true">
          <div className="geo-stream-item geo-stream-sq" />
          <div className="geo-stream-item geo-stream-circ" />
          <div className="geo-stream-item geo-stream-tri" />
          <div className="geo-stream-label">
            <span>{isPreparing ? "FFmpeg Stream Pipeline" : "Direct Download Stream"}</span>
          </div>
        </div>
      )}

      <div className="progress-status-row">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {isPreparing && progress?.phase === "remuxing" && <Cpu size={14} className="spin-fast" color="var(--accent-red)" />}
          {isPreparing && progress?.phase !== "remuxing" && <Loader2 size={14} className="spin-fast" color="var(--accent-red)" />}
          {isDownloading && <DownloadCloud size={14} className="spin-fast" color="var(--accent-blue)" />}
          {isSuccess && <CheckCircle size={14} color="#2E7D32" />}
          {isError && <AlertCircle size={14} color="var(--accent-red)" />}
          <span>{statusLabel}</span>
        </span>

        {percent !== null ? (
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--accent-blue)" }}>
            {percent}%
          </span>
        ) : isSuccess ? (
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "#2E7D32" }}>
            100%
          </span>
        ) : (
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-subtle)" }}>
            0%
          </span>
        )}
      </div>

      <div className="progress-track-frame">
        <div
          className="progress-bar-fill"
          style={{
            width: isSuccess ? "100%" : `${Math.max(4, percent ?? 4)}%`,
            background: isSuccess ? "#2E7D32" : isError ? "var(--accent-red)" : progress?.phase === "streaming" ? "var(--accent-blue)" : "var(--accent-red)",
            transition: "width 250ms ease"
          }}
        />
      </div>

      {progress && (progress.received > 0 || progress.speed || progress.eta) && (
        <div className="progress-byte-meta">
          <span>
            {progress.received > 0 && formatBytes(progress.received)}
            {progress.total > 0 && ` / ${formatBytes(progress.total)}`}
          </span>
          <span>
            {progress.speed && `${progress.speed}`}
            {progress.speed && progress.eta && " · "}
            {progress.eta && `ETA ${progress.eta}`}
          </span>
        </div>
      )}

      {isError && (
        <div className="bauhaus-alert alert-type-error" style={{ marginTop: "0.75rem" }}>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
