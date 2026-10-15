import React, { useState } from "react";
import { ChevronDown, ChevronUp, Check, Sliders } from "lucide-react";

const STANDARD_QUALITIES = [
  { id: "best", label: "Best", desc: "Original stream" },
  { id: "2160p", label: "2160p", desc: "4K UHD" },
  { id: "1440p", label: "1440p", desc: "2K QHD" },
  { id: "1080p", label: "1080p", desc: "FHD" },
  { id: "720p", label: "720p", desc: "HD" },
  { id: "480p", label: "480p", desc: "SD" },
  { id: "360p", label: "360p", desc: "Low" },
];

const AUDIO_FORMATS = [
  { id: "mp3", label: "MP3", desc: "Universal audio (192k)" },
  { id: "m4a", label: "M4A", desc: "Apple AAC audio" },
  { id: "best", label: "Original", desc: "Best source stream" },
];

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return null;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function FormatSelector({
  metadata,
  selectedMode,
  setSelectedMode,
  selectedContainer,
  setSelectedContainer,
  selectedQuality,
  setSelectedQuality,
  selectedAudioFormat,
  setSelectedAudioFormat,
  disabled
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!metadata) return null;

  const discoveredQualities = new Set(metadata.available_qualities || []);

  // Filter qualities to only genuinely discovered ones
  const qualityOptions = STANDARD_QUALITIES.filter(
    (q) => q.id === "best" || discoveredQualities.has(q.id)
  );

  // Find active format metadata for advanced details if available
  const matchingFormat = metadata.formats?.find((f) => {
    if (selectedMode === "video") {
      if (selectedQuality === "best") return f.has_video;
      const height = parseInt(selectedQuality, 10);
      return f.height === height;
    } else {
      return f.has_audio;
    }
  });

  return (
    <div>
      {/* Download type segmented switch */}
      <div className="section-subhead">
        <span>Download Type</span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-subtle)" }}>MODE</span>
      </div>

      <div className="segmented-switch">
        <button
          type="button"
          className={`segment-btn ${selectedMode === "video" ? "active" : ""}`}
          onClick={() => setSelectedMode("video")}
          disabled={disabled}
        >
          Video
        </button>
        <button
          type="button"
          className={`segment-btn ${selectedMode === "audio" ? "active" : ""}`}
          onClick={() => setSelectedMode("audio")}
          disabled={disabled}
        >
          Audio Only
        </button>
      </div>

      {selectedMode === "video" ? (
        <>
          {/* Container Selection */}
          <div className="section-subhead">
            <span>Video Container</span>
          </div>
          <div className="selection-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: "1.25rem" }}>
            <button
              type="button"
              className={`selection-card ${selectedContainer === "mp4" ? "active" : ""}`}
              onClick={() => setSelectedContainer("mp4")}
              disabled={disabled}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="card-title-strong">MP4</span>
                {selectedContainer === "mp4" && <Check size={14} color="var(--accent-red)" />}
              </div>
              <span className="card-caption-subtle">Universal standard</span>
            </button>

            <button
              type="button"
              className={`selection-card ${selectedContainer === "webm" ? "active" : ""}`}
              onClick={() => setSelectedContainer("webm")}
              disabled={disabled}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="card-title-strong">WebM</span>
                {selectedContainer === "webm" && <Check size={14} color="var(--accent-red)" />}
              </div>
              <span className="card-caption-subtle">Open web media</span>
            </button>
          </div>

          {/* Quality Selection */}
          <div className="section-subhead">
            <span>Resolution &amp; Quality</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-subtle)" }}>
              {qualityOptions.length} AVAILABLE
            </span>
          </div>
          <div className="selection-grid">
            {qualityOptions.map((q) => {
              const isSelected = selectedQuality === q.id;
              return (
                <button
                  key={q.id}
                  type="button"
                  className={`selection-card ${isSelected ? "active" : ""}`}
                  onClick={() => setSelectedQuality(q.id)}
                  disabled={disabled}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="card-title-strong">{q.label}</span>
                    {isSelected && <Check size={14} color="var(--accent-red)" />}
                  </div>
                  <span className="card-caption-subtle">{q.desc}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* Audio Output Selection */}
          <div className="section-subhead">
            <span>Audio Codec &amp; Format</span>
          </div>
          <div className="selection-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            {AUDIO_FORMATS.map((af) => {
              const isSelected = selectedAudioFormat === af.id;
              return (
                <button
                  key={af.id}
                  type="button"
                  className={`selection-card ${isSelected ? "active" : ""}`}
                  onClick={() => setSelectedAudioFormat(af.id)}
                  disabled={disabled}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="card-title-strong">{af.label}</span>
                    {isSelected && <Check size={14} color="var(--accent-red)" />}
                  </div>
                  <span className="card-caption-subtle">{af.desc}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Collapsible Format Details */}
      <div className="collapsible-details">
        <button
          type="button"
          className="collapsible-toggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Sliders size={13} />
            <span>Format details</span>
          </span>
          {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showAdvanced && (
          <div className="details-content-table">
            <span className="detail-label-dim">Video codec:</span>
            <span>{matchingFormat?.vcodec || "Stream remuxed / auto"}</span>

            <span className="detail-label-dim">Audio codec:</span>
            <span>{selectedMode === "audio" ? selectedAudioFormat.toUpperCase() : (matchingFormat?.acodec || "Preserved best audio")}</span>

            {matchingFormat?.filesize && (
              <>
                <span className="detail-label-dim">Stream size:</span>
                <span>{formatBytes(matchingFormat.filesize)}</span>
              </>
            )}

            {matchingFormat?.fps && (
              <>
                <span className="detail-label-dim">Frame rate:</span>
                <span>{matchingFormat.fps} fps</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
