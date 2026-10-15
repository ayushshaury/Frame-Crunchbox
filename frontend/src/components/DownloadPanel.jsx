import React from "react";
import { Download, Loader2, RotateCcw, PlusCircle, Check } from "lucide-react";
import ProgressIndicator from "./ProgressIndicator";

export default function DownloadPanel({
  metadata,
  selectedMode,
  selectedContainer,
  selectedQuality,
  selectedAudioFormat,
  onStartDownload,
  downloadStatus,
  downloadProgress,
  downloadError,
  completedFilename,
  onResetFormat,
  onResetNewVideo
}) {
  if (!metadata) return null;

  const isBusy = downloadStatus === "preparing" || downloadStatus === "downloading";

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
    <div className="action-dispatch-box">
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
