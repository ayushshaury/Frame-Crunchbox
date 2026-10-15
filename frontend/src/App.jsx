import React, { useState, useEffect, useRef } from "react";
import { checkBackendHealth, fetchVideoInfo, downloadMediaStream } from "./services/api";
import Navbar from "./components/Navbar";
import UrlForm from "./components/UrlForm";
import VideoDetails from "./components/VideoDetails";
import FormatSelector from "./components/FormatSelector";
import DownloadPanel from "./components/DownloadPanel";
import PlaylistQueue from "./components/PlaylistQueue";
import HowItWorks from "./components/HowItWorks";
import SupportedFormats from "./components/SupportedFormats";
import InitialLoader from "./components/InitialLoader";
import GeometricVideoLoader from "./components/GeometricVideoLoader";
import GeometricSuccessModal from "./components/GeometricSuccessModal";
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Auto-scroll ref for video information
  const videoInfoRef = useRef(null);
  const abortControllerRef = useRef(null);

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

  // Smooth auto-scroll to video information when fetched
  useEffect(() => {
    if (metadata && videoInfoRef.current) {
      const scrollTimer = setTimeout(() => {
        videoInfoRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }, 120);
      return () => clearTimeout(scrollTimer);
    }
  }, [metadata]);

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

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setDownloadStatus("preparing");
    setDownloadProgress(null);
    setDownloadError("");
    setCompletedFilename("");
    setShowSuccessModal(false);

    const payload = {
      url: activeUrl,
      mode: selectedMode,
      container: selectedContainer,
      quality: selectedQuality,
      audio_format: selectedAudioFormat
    };

    try {
      const result = await downloadMediaStream(
        payload,
        (p) => {
          setDownloadStatus("downloading");
          setDownloadProgress(p);
        },
        controller.signal
      );

      setDownloadStatus("success");
      setCompletedFilename(result.filename);
      setShowSuccessModal(true);
    } catch (err) {
      if (err.name === "AbortError") {
        setDownloadStatus("cancelled");
        setDownloadProgress(null);
      } else {
        setDownloadStatus("error");
        setDownloadError(err.message || "Download failed. Please check your connection or choose another format.");
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleCancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleResetFormat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setDownloadStatus("idle");
    setDownloadProgress(null);
    setDownloadError("");
    setShowSuccessModal(false);
  };

  const handleResetNewVideo = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMetadata(null);
    setActiveUrl("");
    setDownloadStatus("idle");
    setDownloadProgress(null);
    setDownloadError("");
    setCompletedFilename("");
    setInfoError("");
    setShowSuccessModal(false);
  };

  return (
    <div className="app-container">
      {/* Joyful Bauhaus Initial Site Entry Animation */}
      <InitialLoader />

      {/* Joyful Bauhaus Download Celebration Modal */}
      {showSuccessModal && completedFilename && (
        <GeometricSuccessModal
          filename={completedFilename}
          formatSummary={selectedMode === "video" ? `${selectedContainer.toUpperCase()} · ${selectedQuality}` : `${selectedAudioFormat.toUpperCase()} Audio`}
          onClose={() => setShowSuccessModal(false)}
        />
      )}

      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="page-wrapper">
        {/* Editorial Bauhaus Hero */}
        <header className="hero-section">
          <div className="hero-content">
            {/* Joyful Bauhaus Eyebrow Pill */}
            <div className="hero-eyebrow">
              <span className="hero-eyebrow-pill">
                <span className="eyebrow-dot dot-red" />
                <span className="eyebrow-dot dot-yellow" />
                <span className="eyebrow-dot dot-blue" />
                <span className="eyebrow-text">MODERN MEDIA WORKBENCH</span>
              </span>
              <span className="hero-eyebrow-status">
                <span className="hero-beacon-ring" />
                <span className="hero-beacon-dot" />
                <span>FAST ENGINE</span>
              </span>
            </div>

            {/* Kinetic Typography Heading */}
            <h1 className="hero-heading">
              <span className="hero-heading-line line-1">
                <span className="hero-text-word">Your</span>{" "}
                <span className="hero-text-word hero-word-accent">
                  video
                  <span className="hero-dot hero-dot-red" title="Bauhaus Primary Red" aria-hidden="true" />
                </span>
              </span>
              <br />
              <span className="hero-heading-line line-2">
                <span className="hero-text-word">Your</span>{" "}
                <span className="hero-text-word hero-word-accent">
                  format
                  <span className="hero-dot hero-dot-blue" title="Bauhaus Primary Blue" aria-hidden="true" />
                </span>
                <span className="hero-badge-floating">
                  <span>MP4</span>
                  <span className="floating-sep">/</span>
                  <span>MP3</span>
                  <span className="floating-sep">/</span>
                  <span>4K</span>
                </span>
              </span>
            </h1>

            <p className="hero-subtitle">
              Convert supported videos and full playlists into the format you need. Choose your quality, keep what matters, and download your files.
            </p>
          </div>

          <div className="hero-art" aria-hidden="true">
            {/* Revolving Bauhaus Dashed Radar Ring */}
            <div className="hero-radar-ring" />

            <div className="hero-floating-shapes">
              <span className="float-shape float-square" />
              <span className="float-shape float-circle" />
              <span className="float-shape float-triangle" />
              <span className="float-shape float-diamond" />
            </div>

            <div className="bauhaus-badge" title="Frame_Crunchbox Kinetic Core">
              <div className="badge-geo-corner" />
              <div className="badge-geo-circle" />
              <div className="badge-geo-square" />
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

            {/* Geometric Video Fetching Animation */}
            {isInfoLoading && (
              <GeometricVideoLoader title="Resolving Video Information" />
            )}

            {/* Configuration View: Two Columns (Left: Video Info, Right: Controls & Download) */}
            {metadata && (
              <div className="config-layout" ref={videoInfoRef} id="video-info-section">
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
                    onCancelDownload={handleCancelDownload}
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
          <div className="footer-brand-wrap">
            <div className="nav-logo-mark" aria-hidden="true">
              <span className="shape-square" />
              <span className="shape-circle" />
              <span className="shape-triangle" />
            </div>
            <span className="footer-brand">Frame_Crunchbox</span>
          </div>
          <p className="footer-copyright">
            Copyright © 2026 Frame_Crunchbox. All rights reserved.
          </p>
          <p className="footer-notice">
            Download only content you own or have permission to use. Respect platform terms of service and applicable copyright regulations.
          </p>
        </div>
      </footer>
    </div>
  );
}
