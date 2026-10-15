import React from "react";

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="info-block">
      <div className="info-title-divider">
        <span>How it works</span>
        <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: 500 }}>
          Three simple steps
        </span>
      </div>

      <div className="grid-three-col">
        <div className="step-card">
          <div className="step-marker step-marker-01">01</div>
          <h3 className="step-heading">Paste</h3>
          <p className="step-desc">
            Add a link to any supported video or audio source you have permission to download.
          </p>
        </div>

        <div className="step-card">
          <div className="step-marker step-marker-02">02</div>
          <h3 className="step-heading">Choose</h3>
          <p className="step-desc">
            Select your preferred container and available resolution or audio-only extraction.
          </p>
        </div>

        <div className="step-card">
          <div className="step-marker step-marker-03">03</div>
          <h3 className="step-heading">Download</h3>
          <p className="step-desc">
            Save the stream directly to your device storage in the specified format.
          </p>
        </div>
      </div>
    </section>
  );
}
