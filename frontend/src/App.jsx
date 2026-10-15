import React, { useState, useEffect } from "react";
import { checkBackendHealth, fetchVideoInfo, downloadMediaStream } from "./services/api";
import Navbar from "./components/Navbar";
import UrlForm from "./components/UrlForm";
import VideoDetails from "./components/VideoDetails";
import FormatSelector from "./components/FormatSelector";
import DownloadPanel from "./components/DownloadPanel";
import PlaylistQueue from "./components/PlaylistQueue";
import HowItWorks from "./components/HowItWorks";
import SupportedFormats from "./components/SupportedFormats";
import { Play } from "lucide-react";

export default function App() {
  const [isBackendReady, setIsBackendReady] = useState(true);
  const [activeTab, setActiveTab] = useState("single"); // "single" | "playlist"

  // Single video state
  const [activeUrl, setActiveUrl] = useState("");
  const [isInfoLoading, setIsInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState("");
  const [metadata, setMetadata] = useState(null);

  // Configuration options
  const [selectedMode, setSelectedMode] = useState("video");
  const [selectedContainer, setSelectedContainer] = useState("mp4");
  const [selectedQuality, setSelectedQuality] = useState("best");
  const [selectedAudioFormat, setSelectedAudioFormat] = useState("mp3");

  // Download state
  const [downloadStatus, setDownloadStatus] = useState("idle");
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [downloadError, setDownloadError] = useState("");
  const [completedFilename, setCompletedFilename] = useState("");

  useEffect(() => {
    let mounted = true;
    checkBackendHealth().then((res) => {
      if (mounted) {
        setIsBackendReady(res.status === "ok");
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSearch = async (url) => {
    setActiveUrl(url);
    setIsInfoLoading(true);
    setInfoError("");
    setMetadata(null);
    setDownloadStatus("idle");
    setDownloadError("");

    try {
      const data = await fetchVideoInfo(url);
      setMetadata(data);

      // Default quality to best available
      if (data.available_qualities && data.available_qualities.length > 0) {
        setSelectedQuality("best");
      }
    } catch (err) {
      setInfoError(err.message || "Failed to retrieve video information. Please verify the URL.");
    } finally {
      setIsInfoLoading(false);
    }
  };

  const handleStartDownload = async () => {
    if (!metadata || !activeUrl) return;

    setDownloadStatus("preparing");
    setDownloadProgress(null);
    setDownloadError("");
    setCompletedFilename("");

    const payload = {
      url: activeUrl,
      mode: selectedMode,
      container: selectedContainer,
      quality: selectedQuality,
      audio_format: selectedAudioFormat
    };

    try {
      const result = await downloadMediaStream(payload, (p) => {
        setDownloadStatus("downloading");
        setDownloadProgress(p);
      });

      setDownloadStatus("success");
      setCompletedFilename(result.filename);
    } catch (err) {
      setDownloadStatus("error");
      setDownloadError(err.message || "Download failed. Please check your connection or choose another format.");
    }
  };

  const handleResetFormat = () => {
    setDownloadStatus("idle");
    setDownloadProgress(null);
    setDownloadError("");
  };

  const handleResetNewVideo = () => {
    setMetadata(null);
    setActiveUrl("");
    setDownloadStatus("idle");
    setDownloadProgress(null);
    setDownloadError("");
    setCompletedFilename("");
    setInfoError("");
  };

  return (
    <div>
      <Navbar
        isBackendReady={isBackendReady}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="page-wrapper">
        {/* Editorial Bauhaus Hero */}
        <header className="hero-section">
          <div>
            <h1 className="hero-heading">
              Your video.<br />
              Your format.
            </h1>
            <p className="hero-subtitle">
              Convert supported videos and full playlists into the format you need. Choose your quality, keep what matters, and download your files.
            </p>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="bauhaus-badge">
              <Play size={24} className="badge-play-icon" fill="#171717" />
            </div>
          </div>
        </header>

        {/* View Mode: Single Video vs Playlist Queue */}
        {activeTab === "playlist" ? (
          <PlaylistQueue />
        ) : (
          <section className="workspace-box">
            <UrlForm
              onSearch={handleSearch}
              isLoading={isInfoLoading}
              disabled={downloadStatus === "preparing" || downloadStatus === "downloading"}
              defaultUrl={activeUrl}
            />

            {infoError && (
              <div className="bauhaus-alert alert-type-error">
                <div>
                  <strong>Unable to fetch video:</strong> {infoError}
                </div>
              </div>
            )}

            {/* Configuration View: Two Columns (Left: Video Info, Right: Controls & Download) */}
            {metadata && (
              <div className="config-layout">
                <VideoDetails
                  metadata={metadata}
                  onResetVideo={handleResetNewVideo}
                />

                <div className="media-controls-pane">
                  <FormatSelector
                    metadata={metadata}
                    selectedMode={selectedMode}
                    setSelectedMode={setSelectedMode}
                    selectedContainer={selectedContainer}
                    setSelectedContainer={setSelectedContainer}
                    selectedQuality={selectedQuality}
                    setSelectedQuality={setSelectedQuality}
                    selectedAudioFormat={selectedAudioFormat}
                    setSelectedAudioFormat={setSelectedAudioFormat}
                    disabled={downloadStatus === "preparing" || downloadStatus === "downloading"}
                  />

                  <DownloadPanel
                    metadata={metadata}
                    selectedMode={selectedMode}
                    selectedContainer={selectedContainer}
                    selectedQuality={selectedQuality}
                    selectedAudioFormat={selectedAudioFormat}
                    onStartDownload={handleStartDownload}
                    downloadStatus={downloadStatus}
                    downloadProgress={downloadProgress}
                    downloadError={downloadError}
                    completedFilename={completedFilename}
                    onResetFormat={handleResetFormat}
                    onResetNewVideo={handleResetNewVideo}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {/* How It Works Section */}
        <HowItWorks />

        {/* Supported Formats Section */}
        <SupportedFormats />
      </main>

      {/* Bauhaus Footer with Frame_Crunchbox branding and copyright */}
      <footer className="minimal-footer">
        <div className="footer-inner">
          <div className="footer-top-row">
            <span className="footer-brand">Frame_Crunchbox</span>
            <span style={{ fontSize: "0.8125rem", color: "var(--text-subtle)" }}>
              Copyright reserved for Frame_Crunchbox
            </span>
          </div>
          <p className="footer-notice">
            Download only content you own or have permission to use. Respect platform terms of service and applicable copyright regulations.
          </p>
        </div>
      </footer>
    </div>
  );
}
