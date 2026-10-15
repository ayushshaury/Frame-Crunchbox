import React from "react";
import { ListVideo, Video } from "lucide-react";

export default function Navbar({ activeTab, setActiveTab }) {
  return (
    <nav className="navbar">
      <div className="nav-container">
        <a href="/" className="nav-brand" aria-label="Frame_Crunchbox Home" onClick={(e) => { e.preventDefault(); setActiveTab("single"); }}>
          <div className="nav-logo-mark" aria-hidden="true">
            <span className="shape-square" />
            <span className="shape-circle" />
            <span className="shape-triangle" />
          </div>
          <span className="nav-title">Frame_Crunchbox</span>
        </a>

        <div className="nav-links">
          <div className="nav-mode-selector">
            <button
              type="button"
              className={`nav-mode-btn ${activeTab === "single" ? "active" : ""}`}
              onClick={() => setActiveTab("single")}
              title="Download single video"
            >
              <Video size={14} />
              <span>Single Video</span>
            </button>
            <button
              type="button"
              className={`nav-mode-btn ${activeTab === "playlist" ? "active" : ""}`}
              onClick={() => setActiveTab("playlist")}
              title="Download full playlist or queue"
            >
              <ListVideo size={14} />
              <span>Playlist Queue</span>
            </button>
          </div>

          <a href="#how-it-works" className="nav-link nav-hide-mobile">
            How it works
          </a>
          <a href="#supported-formats" className="nav-link nav-hide-mobile">
            Formats
          </a>
        </div>
      </div>
    </nav>
  );
}
