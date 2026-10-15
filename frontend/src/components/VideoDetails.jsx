import React, { useState } from "react";
import { Film, Globe, Clock, ExternalLink } from "lucide-react";

function formatDuration(seconds) {
  if (typeof seconds !== "number" || isNaN(seconds) || seconds <= 0) {
    return null;
  }
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function VideoDetails({ metadata, onResetVideo }) {
  const [imgError, setImgError] = useState(false);

  if (!metadata) return null;

  const { title, thumbnail, duration, extractor, webpage_url } = metadata;
  const formattedDuration = formatDuration(duration);

  return (
    <div className="media-preview-pane">
      <div className="section-subhead">
        <span>Video Information</span>
        {onResetVideo && (
          <button
            type="button"
            className="btn-text-link"
            onClick={onResetVideo}
            title="Choose or download another video"
            style={{ fontSize: "0.75rem", textTransform: "none" }}
          >
            ← Download another video
          </button>
        )}
      </div>

      <div className="media-thumbnail-container">
        {thumbnail && !imgError ? (
          <img
            src={thumbnail}
            alt={title || "Video thumbnail"}
            className="media-thumbnail-img"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="media-thumbnail-placeholder">
            <Film size={40} />
          </div>
        )}

        {formattedDuration && (
          <div className="duration-pill">
            {formattedDuration}
          </div>
        )}
      </div>

      <div className="media-meta-badges">
        {extractor && (
          <span className="meta-chip chip-highlight">
            <Globe size={12} />
            <span>{extractor}</span>
          </span>
        )}
        {formattedDuration && (
          <span className="meta-chip">
            <Clock size={12} />
            <span>{formattedDuration}</span>
          </span>
        )}
      </div>

      <h2 className="media-title-text" title={title}>
        {title}
      </h2>

      {webpage_url && (
        <a
          href={webpage_url}
          target="_blank"
          rel="noopener noreferrer"
          className="source-outlink"
        >
          <span>View original source</span>
          <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}
