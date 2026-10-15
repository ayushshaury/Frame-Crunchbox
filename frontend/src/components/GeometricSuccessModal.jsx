import React, { useEffect, useState } from "react";
import { Check, X, Sparkles, FolderDown } from "lucide-react";

export default function GeometricSuccessModal({
  filename,
  formatSummary,
  onClose,
  duration = 4500
}) {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Auto-dismiss after duration
    const dismissTimer = setTimeout(() => {
      triggerClose();
    }, duration);

    return () => clearTimeout(dismissTimer);
  }, [duration]);

  const triggerClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      if (onClose) onClose();
    }, 300);
  };

  return (
    <div
      className={`geo-success-overlay ${isClosing ? "geo-success-fade-out" : ""}`}
      onClick={triggerClose}
      role="dialog"
      aria-modal="true"
      aria-label="Download Complete Celebration"
    >
      <div
        className={`geo-success-modal ${isClosing ? "geo-success-pop-down" : "geo-success-pop-in"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Background Bauhaus Shapes (Square, Circle, Triangle, Diamond) */}
        <div className="geo-modal-decorations" aria-hidden="true">
          <span className="decor-shape decor-sq-1" />
          <span className="decor-shape decor-sq-2" />
          <span className="decor-shape decor-circ-1" />
          <span className="decor-shape decor-circ-2" />
          <span className="decor-shape decor-tri-1" />
          <span className="decor-shape decor-tri-2" />
          <span className="decor-shape decor-diamond" />
        </div>

        {/* Close Button */}
        <button
          type="button"
          className="geo-modal-close-btn"
          onClick={triggerClose}
          aria-label="Close celebration modal"
        >
          <X size={16} />
        </button>

        {/* Center Animated Bauhaus Hero Seal */}
        <div className="geo-success-seal-container">
          <div className="geo-seal-radar-ring" />
          <div className="geo-seal-orbit-shapes">
            <span className="orbit-dot orbit-dot-red" />
            <span className="orbit-dot orbit-dot-blue" />
            <span className="orbit-dot orbit-dot-yellow" />
          </div>
          <div className="geo-seal-badge">
            <Check size={28} className="geo-seal-check-icon" strokeWidth={3} />
          </div>
        </div>

        {/* Text Content */}
        <div className="geo-success-content">
          <div className="geo-success-tag">
            <Sparkles size={13} />
            <span>DOWNLOAD COMPLETE</span>
          </div>

          <h3 className="geo-success-title">Saved To Your Device!</h3>

          {filename && (
            <div className="geo-success-file-box">
              <FolderDown size={18} className="file-box-icon" />
              <div className="file-box-details">
                <span className="file-box-name" title={filename}>
                  {filename}
                </span>
                {formatSummary && (
                  <span className="file-box-format">{formatSummary}</span>
                )}
              </div>
            </div>
          )}

          <p className="geo-success-hint">
            Your media file was packaged and streamed directly into your browser's downloads folder.
          </p>

          <button
            type="button"
            className="btn-geo-success-action"
            onClick={triggerClose}
          >
            <span>Got it, thanks!</span>
          </button>
        </div>

        {/* Animated Countdown Progress Bar at Bottom */}
        <div className="geo-success-countdown-track">
          <div
            className="geo-success-countdown-fill"
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>
      </div>
    </div>
  );
}
