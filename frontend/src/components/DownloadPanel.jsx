import React from "react";
import { Download, Loader2, RotateCcw, PlusCircle, Check, XCircle, Ban } from "lucide-react";
import ProgressIndicator from "./ProgressIndicator";
import GeometricConfetti from "./GeometricConfetti";

export default function DownloadPanel({
  metadata,
  selectedMode,
  selectedContainer,
  selectedQuality,
  selectedAudioFormat,
  onStartDownload,
  onCancelDownload,
  downloadStatus,
  downloadProgress,
  downloadError,
  completedFilename,
  onResetFormat,
  onResetNewVideo
}) {
  if (!metadata) return null;

  const isBusy = downloadStatus === "preparing" || downloadStatus === "downloading";
  const isCancelled = downloadStatus === "cancelled";

  // Build accurate summary line above button
  let summaryText = "";
  if (selectedMode === "video") {
    const qualLabel = selectedQuality === "best" ? "Best available streams" : selectedQuality;
    summaryText = `${selectedContainer.toUpperCase()} · ${qualLabel}`;
  } else {
    summaryText = `${selectedAudioFormat.toUpperCase()} · Audio stream extraction`;
  }

  const buttonLabel = selectedMode === "video" ? "Download video" : "Download audio";

  return (
    <div className="action-dispatch-box" style={{ position: "relative" }}>
      {downloadStatus === "success" && <GeometricConfetti />}

      <div className="summary-headline">
        <span>Selected format: </span>
        <span className="summary-highlight">{summaryText}</span>
      </div>

      {downloadStatus === "success" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="bauhaus-alert alert-type-success">
            <Check size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Download complete:</strong> {completedFilename || "File successfully saved to your device."}
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-primary-action-outline"
              onClick={onResetNewVideo}
            >
              <PlusCircle size={15} />
              <span>Download Another Video</span>
            </button>

            <button
              type="button"
              className="btn-secondary-action"
              onClick={onResetFormat}
            >
              <RotateCcw size={14} />
              <span>Download another format</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="download-action-row">
            <button
              type="button"
              className="btn-primary-download"
              onClick={onStartDownload}
              disabled={isBusy}
            >
              {isBusy ? (
                <>
                  <Loader2 size={18} className="spin-fast" />
                  <span>Processing Media…</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span>{buttonLabel}</span>
                </>
              )}
            </button>

            {isBusy && onCancelDownload && (
              <button
                type="button"
                className="btn-cancel-download"
                onClick={onCancelDownload}
                title="Cancel download in progress"
              >
                <XCircle size={16} className="cancel-icon-pulse" />
                <span>Cancel</span>
              </button>
            )}
          </div>

          {isCancelled && (
            <div className="bauhaus-alert alert-type-warning" style={{ marginTop: "0.875rem" }}>
              <Ban size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Download cancelled:</strong> You can select a different format or click download again to retry.
              </div>
            </div>
          )}

          <div style={{ marginTop: "0.875rem", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn-text-link"
              onClick={onResetNewVideo}
              disabled={isBusy}
              title="Clear current video and download another video"
            >
              <PlusCircle size={14} />
              <span>Download another video</span>
            </button>
          </div>
        </>
      )}

      <ProgressIndicator
        status={downloadStatus}
        progress={downloadProgress}
        error={downloadError}
        completedFilename={completedFilename}
      />
    </div>
  );
}
