import React from "react";
import { Sliders, Volume2, ShieldCheck, Cpu } from "lucide-react";

export default function SupportedFormats() {
  return (
    <section id="supported-formats" className="info-block">
      <div className="info-title-divider">
        <span>Supported formats &amp; capabilities</span>
        <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: 500 }}>
          Source-dependent
        </span>
      </div>

      <div className="formats-explanation-grid">
        <div className="format-note-card">
          <div className="format-note-title">
            <Sliders size={16} color="var(--accent-blue)" />
            <span>Resolution Availability</span>
          </div>
          <p className="format-note-text">
            High resolutions (such as 1080p, 1440p, or 2160p) appear only when provided by the original host. If an upload was published in 720p, higher options will not be displayed.
          </p>
        </div>

        <div className="format-note-card">
          <div className="format-note-title">
            <Volume2 size={16} color="var(--accent-red)" />
            <span>Audio Conversion</span>
          </div>
          <p className="format-note-text">
            Audio extractions can be exported as MP3 or M4A. Audio-only exports extract the stream directly, ensuring high fidelity with standard device players.
          </p>
        </div>

        <div className="format-note-card">
          <div className="format-note-title">
            <Cpu size={16} color="#B58900" />
            <span>Container Remuxing</span>
          </div>
          <p className="format-note-text">
            MP4 and WebM options merge the best discrete audio and video feeds without lossy re-encoding whenever possible, optimizing both speed and playback quality.
          </p>
        </div>

        <div className="format-note-card">
          <div className="format-note-title">
            <ShieldCheck size={16} color="var(--text-black)" />
            <span>Permitted Media</span>
          </div>
          <p className="format-note-text">
            FRAME functions only on public, unprotected media. Videos subject to digital rights management (DRM), private restrictions, or authentication are rejected.
          </p>
        </div>
      </div>
    </section>
  );
}
