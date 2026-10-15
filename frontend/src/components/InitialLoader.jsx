import React, { useState, useEffect } from "react";

export default function InitialLoader({ onComplete }) {
  const [isFading, setIsFading] = useState(false);
  const [isGone, setIsGone] = useState(false);

  useEffect(() => {
    // Show quick, joyful entrance (approx 950ms total)
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, 850);

    const doneTimer = setTimeout(() => {
      setIsGone(true);
      if (onComplete) onComplete();
    }, 1200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onComplete]);

  if (isGone) return null;

  return (
    <div className={`initial-splash-overlay ${isFading ? "fade-out" : ""}`} aria-hidden="true">
      <div className="splash-card">
        {/* Animated Bauhaus Geometric Trio */}
        <div className="splash-shapes-stage">
          <div className="splash-shape splash-shape-square" />
          <div className="splash-shape splash-shape-circle" />
          <div className="splash-shape splash-shape-triangle" />
        </div>

        <div className="splash-brand-text">
          <span className="splash-title">Frame_Crunchbox</span>
          <span className="splash-subtitle">VIDEO & AUDIO FORMAT UTILITY</span>
        </div>

        {/* Dynamic geometric progress line */}
        <div className="splash-progress-track">
          <div className="splash-progress-bar" />
        </div>
      </div>
    </div>
  );
}
