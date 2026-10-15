import React, { useState } from "react";
import { Sliders, Volume2, ShieldCheck, Cpu, Sparkles } from "lucide-react";

export default function SupportedFormats() {
  const [hoveredCard, setHoveredCard] = useState(null);

  const formatCards = [
    {
      id: "res",
      title: "Resolution Availability",
      icon: Sliders,
      accentColor: "var(--accent-blue)",
      shadowColor: "var(--accent-blue)",
      badgeTag: "UP TO 4K UHD",
      shape: "square",
      text: "High resolutions (1080p, 1440p, or 2160p) appear automatically when provided by the original host. If the video was published in 720p, only available qualities are displayed.",
      liveData: "4K · 2K · 1080p · 720p · 480p"
    },
    {
      id: "audio",
      title: "Audio Extraction",
      icon: Volume2,
      accentColor: "var(--accent-red)",
      shadowColor: "var(--accent-red)",
      badgeTag: "192KBPS STEREO",
      shape: "circle",
      text: "Audio extractions can be exported directly as universal MP3 or Apple AAC (M4A). Streams are isolated with pristine high fidelity for your personal audio collection.",
      liveData: "MP3 (192k) · M4A (AAC) · Original"
    },
    {
      id: "remux",
      title: "In-Memory Remuxing",
      icon: Cpu,
      accentColor: "#C59B27",
      shadowColor: "#C59B27",
      badgeTag: "ZERO LOSS STREAM",
      shape: "triangle",
      text: "Discrete video and audio feeds are muxed in real-time with FFmpeg without lossy re-encoding whenever possible, optimizing both transfer speed and visual sharpness.",
      liveData: "Direct Stream Copy · No Recode"
    },
    {
      id: "safety",
      title: "Permitted Media",
      icon: ShieldCheck,
      accentColor: "var(--text-black)",
      shadowColor: "var(--text-black)",
      badgeTag: "PUBLIC & SAFE",
      shape: "diamond",
      text: "Frame_Crunchbox operates strictly on public, unrestricted media. DRM-encrypted content, private streams, and restricted videos are safely filtered out.",
      liveData: "Public Access Only · No DRM"
    }
  ];

  return (
    <section id="supported-formats" className="info-block">
      <div className="info-title-divider">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>Supported formats &amp; capabilities</span>
          <span className="info-title-badge info-badge-spec">SPECIFICATIONS</span>
        </div>
        <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: 500 }}>
          Source-dependent
        </span>
      </div>

      <div className="formats-explanation-grid">
        {formatCards.map((card) => {
          const IconComp = card.icon;
          const isHovered = hoveredCard === card.id;

          return (
            <div
              key={card.id}
              className={`format-note-card format-card-${card.id} ${isHovered ? "format-card-hovered" : ""}`}
              onMouseEnter={() => setHoveredCard(card.id)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                "--card-accent": card.accentColor,
                "--card-shadow": card.shadowColor
              }}
              tabIndex={0}
            >
              {/* Dynamic Corner Accent Banner */}
              <div className="format-card-corner" aria-hidden="true" />

              {/* Header with Geometric Shape Badge */}
              <div className="format-note-header">
                <div className="format-badge-wrap">
                  <div className={`format-shape-badge shape-${card.shape}`}>
                    <IconComp size={16} className="format-icon" />
                  </div>
                  <div className="format-shape-halo" />
                </div>

                <div className="format-header-text">
                  <h3 className="format-note-title">{card.title}</h3>
                  <span className="format-capability-tag">
                    <Sparkles size={10} />
                    <span>{card.badgeTag}</span>
                  </span>
                </div>
              </div>

              <p className="format-note-text">{card.text}</p>

              {/* Animated Interactive Data Pill at Bottom */}
              <div className="format-data-pill">
                <span className="format-data-indicator" />
                <span className="format-data-label">{card.liveData}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
