import React, { useState } from "react";
import { Link2, Sliders, ArrowDownToLine } from "lucide-react";

export default function HowItWorks() {
  const [activeStep, setActiveStep] = useState(null);

  return (
    <section id="how-it-works" className="info-block">
      <div className="info-title-divider">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>How it works</span>
          <span className="info-title-badge">INTERACTIVE WORKFLOW</span>
        </div>
        <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: 500 }}>
          Three simple steps
        </span>
      </div>

      <div className="grid-three-col">
        {/* Step 01 */}
        <div
          className={`step-card step-card-01 ${activeStep === 1 ? "step-card-active" : ""}`}
          onMouseEnter={() => setActiveStep(1)}
          onMouseLeave={() => setActiveStep(null)}
          tabIndex={0}
        >
          {/* Top Geometric Illustration Stage */}
          <div className="step-graphic-stage" aria-hidden="true">
            <div className="graphic-paste-box">
              <span className="geo-bracket left-bracket">[</span>
              <div className="geo-paste-square">
                <Link2 size={16} color="#FFFFFF" strokeWidth={2.5} />
              </div>
              <span className="geo-bracket right-bracket">]</span>
            </div>
            <div className="graphic-stage-particles">
              <span className="mini-particle p-red" />
              <span className="mini-particle p-red-2" />
            </div>
          </div>

          <div className="step-card-body">
            <div className="step-marker step-marker-01">
              <span>01</span>
              <span className="step-marker-line" />
            </div>
            <h3 className="step-heading">Paste Link</h3>
            <p className="step-desc">
              Add any public video or audio URL into the input field. Frame_Crunchbox resolves the source stream in real time.
            </p>
          </div>
        </div>

        {/* Step 02 */}
        <div
          className={`step-card step-card-02 ${activeStep === 2 ? "step-card-active" : ""}`}
          onMouseEnter={() => setActiveStep(2)}
          onMouseLeave={() => setActiveStep(null)}
          tabIndex={0}
        >
          {/* Top Geometric Illustration Stage */}
          <div className="step-graphic-stage" aria-hidden="true">
            <div className="graphic-choose-box">
              <div className="geo-choose-circle">
                <Sliders size={16} color="#FFFFFF" strokeWidth={2.5} />
              </div>
              <div className="geo-choose-pills">
                <span className="choose-pill pill-video">MP4 · 1080p</span>
                <span className="choose-pill pill-audio">MP3 · 192k</span>
              </div>
            </div>
            <div className="graphic-stage-particles">
              <span className="mini-particle p-blue" />
              <span className="mini-particle p-blue-2" />
            </div>
          </div>

          <div className="step-card-body">
            <div className="step-marker step-marker-02">
              <span>02</span>
              <span className="step-marker-line" />
            </div>
            <h3 className="step-heading">Choose Format</h3>
            <p className="step-desc">
              Select your preferred container and available resolution (up to 4K) or extract high-fidelity standalone audio.
            </p>
          </div>
        </div>

        {/* Step 03 */}
        <div
          className={`step-card step-card-03 ${activeStep === 3 ? "step-card-active" : ""}`}
          onMouseEnter={() => setActiveStep(3)}
          onMouseLeave={() => setActiveStep(null)}
          tabIndex={0}
        >
          {/* Top Geometric Illustration Stage */}
          <div className="step-graphic-stage" aria-hidden="true">
            <div className="graphic-download-box">
              <div className="geo-download-arrow">
                <ArrowDownToLine size={18} color="var(--text-black)" strokeWidth={2.5} />
              </div>
              <div className="geo-download-tray" />
            </div>
            <div className="graphic-stage-particles">
              <span className="mini-particle p-yellow" />
              <span className="mini-particle p-yellow-2" />
            </div>
          </div>

          <div className="step-card-body">
            <div className="step-marker step-marker-03">
              <span>03</span>
              <span className="step-marker-line" />
            </div>
            <h3 className="step-heading">Direct Download</h3>
            <p className="step-desc">
              Save the stream directly to your device storage with fast in-memory remuxing and zero third-party tracking.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
