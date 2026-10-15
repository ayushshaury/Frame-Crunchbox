import React, { useState, useEffect } from "react";

const FETCH_STEPS = [
  "CONNECTING TO SOURCE STREAM",
  "READING STREAM MANIFEST",
  "PARSING AVAILABLE BITRATES",
  "ASSEMBLING FORMAT PROFILES",
  "FINALIZING VIDEO METADATA"
];

export default function GeometricVideoLoader({ title = "Fetching Video Details" }) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % FETCH_STEPS.length);
    }, 650);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="geometric-loader-container" role="status" aria-live="polite">
      {/* Dynamic Animated Geometric Centerpiece */}
      <div className="geometric-animation-stage">
        {/* Pulsing Outer Geometric Radar Ring */}
        <div className="geo-ring geo-ring-outer" />
        <div className="geo-ring geo-ring-inner" />

        {/* Orbiting Bauhaus Shapes */}
        <div className="geo-shapes-orbit">
          <div className="geo-shape-orbiting geo-shape-square" title="Square" />
          <div className="geo-shape-orbiting geo-shape-circle" title="Circle" />
          <div className="geo-shape-orbiting geo-shape-triangle" title="Triangle" />
        </div>

        {/* Center core pulse */}
        <div className="geo-core-dot" />
      </div>

      {/* Narrative Status Message */}
      <div className="geometric-loader-text">
        <h4 className="geo-loader-heading">{title}</h4>
        <div className="geo-ticker-badge">
          <span className="geo-ticker-indicator" />
          <span className="geo-ticker-label">{FETCH_STEPS[stepIndex]}</span>
        </div>
      </div>

      {/* Decorative Bauhaus Striped Meter */}
      <div className="geo-progress-meter">
        <div className="geo-progress-fill" />
      </div>
    </div>
  );
}
