import React, { useState, useRef } from "react";
import { fetchPlaylistInfo, downloadMediaStream } from "../services/api";
import {
  ListVideo,
  Play,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clipboard,
  Square,
  CheckSquare,
  StopCircle,
  Sliders,
  ExternalLink,
  Cpu,
  DownloadCloud,
  XCircle,
  Ban,
  X,
  Check,
  Sparkles,
  ArrowRight
} from "lucide-react";
import GeometricVideoLoader from "./GeometricVideoLoader";

function formatDuration(seconds) {
  if (typeof seconds !== "number" || isNaN(seconds) || seconds <= 0) {
    return null;
  }
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function PlaylistQueue() {
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);
  const [playlistError, setPlaylistError] = useState("");
  const [playlistData, setPlaylistData] = useState(null);

  // Selected item IDs for batch queue
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Global format choices for the queue/items (720p default ensures fast batch downloads)
  const [queueMode, setQueueMode] = useState("video");
  const [queueContainer, setQueueContainer] = useState("mp4");
  const [queueQuality, setQueueQuality] = useState("720p");
  const [queueAudioFormat, setQueueAudioFormat] = useState("mp3");

  // Queue runner state
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(null);
  const [activeItemTitle, setActiveItemTitle] = useState("");
  const [queueItemStatuses, setQueueItemStatuses] = useState({}); // { [id]: 'pending' | 'downloading' | 'completed' | 'error' }
  const [currentItemProgress, setCurrentItemProgress] = useState(null);

  // Ref to cancel queue
  const cancelQueueRef = useRef(false);
  const currentAbortControllerRef = useRef(null);
  const playlistContentRef = useRef(null);

  // Joyful input feedback states
  const [isPasted, setIsPasted] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const pasteTimerRef = useRef(null);

  React.useEffect(() => {
    if (playlistData && playlistContentRef.current) {
      const timer = setTimeout(() => {
        playlistContentRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [playlistData]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPlaylistUrl(text.trim());
        setPlaylistError("");
        setIsPasted(true);
        if (pasteTimerRef.current) clearTimeout(pasteTimerRef.current);
        pasteTimerRef.current = setTimeout(() => setIsPasted(false), 1600);
      }
    } catch {
      setPlaylistError("Clipboard access blocked. Please paste the playlist link manually.");
    }
  };

  const handleClear = () => {
    setPlaylistUrl("");
    setPlaylistError("");
  };

  const handleFetchPlaylist = async (e) => {
    e.preventDefault();
    const trimmed = playlistUrl.trim();
    if (!trimmed) {
      setPlaylistError("Please enter a playlist URL.");
      return;
    }

    setIsLoadingPlaylist(true);
    setPlaylistError("");
    setPlaylistData(null);
    setQueueItemStatuses({});
    setCurrentQueueIndex(null);

    try {
      const data = await fetchPlaylistInfo(trimmed);
      setPlaylistData(data);
      // Select all by default
      const allIds = new Set(data.items.map((i) => i.id));
      setSelectedIds(allIds);
    } catch (err) {
      setPlaylistError(err.message || "Failed to fetch playlist entries. Please verify the URL.");
    } finally {
      setIsLoadingPlaylist(false);
    }
  };

  const toggleSelectAll = () => {
    if (!playlistData) return;
    if (selectedIds.size === playlistData.items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(playlistData.items.map((i) => i.id)));
    }
  };

  const toggleSelectItem = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Download a single video directly ("one at a time")
  const downloadSingleItem = async (item) => {
    const controller = new AbortController();
    currentAbortControllerRef.current = controller;

    setQueueItemStatuses((prev) => ({ ...prev, [item.id]: "downloading" }));
    setActiveItemTitle(item.title);
    setCurrentItemProgress({ percent: 0, phase: "starting", message: "Connecting to source…" });

    const payload = {
      url: item.url,
      mode: queueMode,
      container: queueContainer,
      quality: queueQuality,
      audio_format: queueAudioFormat,
    };

    try {
      await downloadMediaStream(
        payload,
        (p) => {
          setCurrentItemProgress(p);
        },
        controller.signal
      );
      setQueueItemStatuses((prev) => ({ ...prev, [item.id]: "completed" }));
    } catch (err) {
      if (err.name === "AbortError") {
        setQueueItemStatuses((prev) => ({ ...prev, [item.id]: "cancelled" }));
      } else {
        console.error("Single item download error:", err);
        setQueueItemStatuses((prev) => ({ ...prev, [item.id]: "error" }));
      }
    } finally {
      currentAbortControllerRef.current = null;
      setCurrentItemProgress(null);
      setActiveItemTitle("");
    }
  };

  const cancelActiveDownload = () => {
    if (currentAbortControllerRef.current) {
      currentAbortControllerRef.current.abort();
    }
  };

  // Run entire queue sequentially
  const startQueueDownload = async () => {
    if (!playlistData || selectedIds.size === 0) return;

    cancelQueueRef.current = false;
    setIsQueueRunning(true);

    const itemsToProcess = playlistData.items.filter((item) => selectedIds.has(item.id));

    for (let i = 0; i < itemsToProcess.length; i++) {
      if (cancelQueueRef.current) break;

      const item = itemsToProcess[i];
      setCurrentQueueIndex(i);
      setActiveItemTitle(item.title);
      setQueueItemStatuses((prev) => ({ ...prev, [item.id]: "downloading" }));
      setCurrentItemProgress({ percent: 0, phase: "starting", message: "Connecting to source…" });

      const payload = {
        url: item.url,
        mode: queueMode,
        container: queueContainer,
        quality: queueQuality,
        audio_format: queueAudioFormat,
      };

      const controller = new AbortController();
      currentAbortControllerRef.current = controller;

      try {
        await downloadMediaStream(
          payload,
          (p) => {
            setCurrentItemProgress(p);
          },
          controller.signal
        );
        setQueueItemStatuses((prev) => ({ ...prev, [item.id]: "completed" }));
      } catch (err) {
        if (err.name === "AbortError" || cancelQueueRef.current) {
          setQueueItemStatuses((prev) => ({ ...prev, [item.id]: "cancelled" }));
          break;
        } else {
          console.error(`Queue item ${item.title} failed:`, err);
          setQueueItemStatuses((prev) => ({ ...prev, [item.id]: "error" }));
        }
      } finally {
        currentAbortControllerRef.current = null;
      }

      // Small pause between queue downloads so the browser registers the file save
      if (i < itemsToProcess.length - 1 && !cancelQueueRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    setIsQueueRunning(false);
    setCurrentQueueIndex(null);
    setCurrentItemProgress(null);
    setActiveItemTitle("");
  };

  const stopQueueDownload = () => {
    cancelQueueRef.current = true;
    if (currentAbortControllerRef.current) {
      currentAbortControllerRef.current.abort();
    }
    setIsQueueRunning(false);
    setCurrentItemProgress(null);
    setActiveItemTitle("");
  };

  const activePercent = currentItemProgress?.percent !== null && currentItemProgress?.percent !== undefined
    ? Math.min(100, Math.max(0, currentItemProgress.percent))
    : 0;

  return (
    <section className="workspace-box">
      <div className="workspace-label-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ListVideo size={18} color="var(--accent-red)" />
          <span className="workspace-label">Playlist &amp; Batch Queue</span>
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--text-subtle)", letterSpacing: "0.04em" }}>
          FAST QUEUE
        </span>
      </div>

      <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
        Fetch any public playlist. Download videos <strong>one at a time</strong> or run a sequential <strong>queue</strong> with your chosen format.
      </p>

      {/* Playlist URL Input */}
      <form onSubmit={handleFetchPlaylist} className="url-form-root">
        <div className={`url-input-group ${isFocused ? "url-group-focused" : ""} ${playlistUrl.trim() ? "url-group-has-content" : ""}`}>
          {/* Animated Top Bauhaus Scanning Track */}
          <div className="bauhaus-scanner-track" aria-hidden="true">
            <span className="scanner-segment seg-red" />
            <span className="scanner-segment seg-yellow" />
            <span className="scanner-segment seg-blue" />
          </div>

          {/* Interactive Leading Playlist Badge */}
          <div className="url-lead-badge lead-playlist" title="Playlist Queue Link">
            <ListVideo size={16} className="lead-icon" />
          </div>

          <input
            type="url"
            className="url-text-field"
            placeholder="Paste a playlist URL (e.g., https://www.youtube.com/playlist?list=...)"
            value={playlistUrl}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onChange={(e) => {
              setPlaylistUrl(e.target.value);
              if (playlistError) setPlaylistError("");
            }}
            disabled={isLoadingPlaylist || isQueueRunning}
            spellCheck="false"
          />

          {/* Joyful Clear Button */}
          {playlistUrl && !isLoadingPlaylist && !isQueueRunning && (
            <button
              type="button"
              className="btn-clear-url"
              onClick={handleClear}
              title="Clear playlist URL"
              aria-label="Clear URL"
            >
              <X size={14} />
            </button>
          )}

          <div className="url-input-actions">
            <button
              type="button"
              className={`btn-paste ${isPasted ? "btn-paste-success" : ""}`}
              onClick={handlePaste}
              title="Paste playlist link from clipboard"
              disabled={isLoadingPlaylist || isQueueRunning}
            >
              {isPasted ? (
                <>
                  <Check size={14} className="paste-check-icon" />
                  <span className="paste-btn-text">Pasted!</span>
                </>
              ) : (
                <>
                  <Clipboard size={14} className="paste-clip-icon" />
                  <span className="paste-btn-text">Paste</span>
                </>
              )}
            </button>

            <button
              type="submit"
              className={`btn-submit-fetch ${playlistUrl.trim() ? "btn-fetch-active" : ""}`}
              disabled={isLoadingPlaylist || !playlistUrl.trim() || isQueueRunning}
            >
              {isLoadingPlaylist ? (
                <>
                  <Loader2 size={16} className="spin-fast" />
                  <span>Reading Fast…</span>
                </>
              ) : (
                <>
                  <span>Fetch Playlist</span>
                  <ArrowRight size={16} className="fetch-arrow-icon" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Real-time recognition pill */}
        <div className="url-helper-row">
          {playlistUrl.includes("list=") ? (
            <div className="url-detect-pill pill-playlist">
              <Sparkles size={11} />
              <span>Playlist stream recognized · Ready to fetch all items</span>
            </div>
          ) : (
            <span className="url-default-hint">
              Supports standard YouTube playlists and user mixes. All items will be displayed with duration, quality, and batch selectors.
            </span>
          )}
        </div>

        {playlistError && (
          <div className="bauhaus-alert alert-type-error" style={{ marginTop: "1rem" }}>
            <strong>Playlist Error:</strong> {playlistError}
          </div>
        )}

        {/* Geometric Playlist Loading Animation */}
        {isLoadingPlaylist && (
          <GeometricVideoLoader title="Resolving Playlist Entries & Streams" />
        )}
      </form>

      {/* Playlist Content & Controls */}
      {playlistData && (
        <div ref={playlistContentRef} style={{ marginTop: "2rem", borderTop: "2px solid var(--border-subtle)", paddingTop: "1.5rem" }}>
          {/* Header Summary */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
            <div>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 700 }}>
                {playlistData.title}
              </h3>
              <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                Found <strong>{playlistData.total_items}</strong> videos · Selected <strong>{selectedIds.size}</strong> for queue
              </div>
            </div>

            {playlistData.webpage_url && (
              <a
                href={playlistData.webpage_url}
                target="_blank"
                rel="noopener noreferrer"
                className="source-outlink"
              >
                <span>View on {playlistData.extractor}</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          {/* Global Output Format Bar */}
          <div className="collapsible-details" style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "0.75rem", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.8125rem", textTransform: "uppercase" }}>
              <Sliders size={14} />
              <span>Export Settings For Queue &amp; Individual Downloads</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  TYPE
                </label>
                <select
                  value={queueMode}
                  onChange={(e) => setQueueMode(e.target.value)}
                  disabled={isQueueRunning}
                  style={{ width: "100%", padding: "0.4rem 0.5rem", border: "1.5px solid var(--border-color)", background: "var(--bg-white)" }}
                >
                  <option value="video">Video with Audio</option>
                  <option value="audio">Audio Only</option>
                </select>
              </div>

              {queueMode === "video" ? (
                <>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                      CONTAINER
                    </label>
                    <select
                      value={queueContainer}
                      onChange={(e) => setQueueContainer(e.target.value)}
                      disabled={isQueueRunning}
                      style={{ width: "100%", padding: "0.4rem 0.5rem", border: "1.5px solid var(--border-color)", background: "var(--bg-white)" }}
                    >
                      <option value="mp4">MP4</option>
                      <option value="webm">WebM</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                      TARGET QUALITY
                    </label>
                    <select
                      value={queueQuality}
                      onChange={(e) => setQueueQuality(e.target.value)}
                      disabled={isQueueRunning}
                      style={{ width: "100%", padding: "0.4rem 0.5rem", border: "1.5px solid var(--border-color)", background: "var(--bg-white)" }}
                    >
                      <option value="720p">720p HD (Recommended — Fast)</option>
                      <option value="1080p">1080p FHD</option>
                      <option value="best">Best Available (Full Quality)</option>
                      <option value="480p">480p SD</option>
                      <option value="360p">360p Low (Ultra Fast)</option>
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    AUDIO FORMAT
                  </label>
                  <select
                    value={queueAudioFormat}
                    onChange={(e) => setQueueAudioFormat(e.target.value)}
                    disabled={isQueueRunning}
                    style={{ width: "100%", padding: "0.4rem 0.5rem", border: "1.5px solid var(--border-color)", background: "var(--bg-white)" }}
                  >
                    <option value="mp3">MP3 (192 kbps)</option>
                    <option value="m4a">M4A (AAC)</option>
                    <option value="best">Original stream</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Queue Actions Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
            <button
              type="button"
              className="btn-secondary-action"
              onClick={toggleSelectAll}
              disabled={isQueueRunning}
            >
              {selectedIds.size === playlistData.items.length ? <CheckSquare size={14} /> : <Square size={14} />}
              <span>{selectedIds.size === playlistData.items.length ? "Deselect All" : "Select All"}</span>
            </button>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              {isQueueRunning ? (
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={stopQueueDownload}
                  style={{ borderColor: "var(--accent-red)", color: "var(--accent-red)" }}
                >
                  <StopCircle size={15} />
                  <span>Stop Queue</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary-download"
                  style={{ width: "auto", padding: "0.6rem 1.25rem", fontSize: "0.875rem" }}
                  onClick={startQueueDownload}
                  disabled={selectedIds.size === 0}
                >
                  <Download size={15} />
                  <span>Start Queue ({selectedIds.size} Videos)</span>
                </button>
              )}
            </div>
          </div>

          {/* Real Percentage Queue Progress Box */}
          {(isQueueRunning || currentItemProgress) && (
            <div className="bauhaus-progress-tray" style={{ marginBottom: "1.25rem" }}>
              <div className="progress-status-row">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {currentItemProgress?.phase === "remuxing" ? (
                    <Cpu size={14} className="spin-fast" color="var(--accent-red)" />
                  ) : currentItemProgress?.phase === "streaming" ? (
                    <DownloadCloud size={14} className="spin-fast" color="var(--accent-blue)" />
                  ) : (
                    <Loader2 size={14} className="spin-fast" color="var(--accent-red)" />
                  )}
                  <span>
                    {isQueueRunning && currentQueueIndex !== null
                      ? `Queue Active · Video ${currentQueueIndex + 1} of ${selectedIds.size}: `
                      : "Processing: "}
                    <strong>{activeItemTitle ? `"${activeItemTitle.slice(0, 40)}…"` : "Media"}</strong>
                    {" — "}
                    {currentItemProgress?.phase === "remuxing"
                      ? "Packaging media with FFmpeg (99%)…"
                      : currentItemProgress?.phase === "streaming"
                      ? `Saving to your device (${currentItemProgress?.speed || "transferring"})…`
                      : currentItemProgress?.phase === "downloading"
                      ? `Downloading stream from source (${currentItemProgress?.speed || "active"})…`
                      : "Connecting to source…"}
                  </span>
                </span>

                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--accent-blue)", fontSize: "1rem" }}>
                  {activePercent}%
                </span>
              </div>

              {/* Solid Progress Fill Bar with real % */}
              <div className="progress-track-frame">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${Math.max(3, activePercent)}%`,
                    background: currentItemProgress?.phase === "streaming" ? "var(--accent-blue)" : "var(--accent-red)",
                    transition: "width 250ms ease"
                  }}
                />
              </div>

              {/* Speed & ETA metrics */}
              <div className="progress-byte-meta" style={{ marginTop: "0.4rem" }}>
                <span>
                  {currentItemProgress?.received > 0 && formatBytes(currentItemProgress.received)}
                  {currentItemProgress?.total > 0 && ` / ${formatBytes(currentItemProgress.total)}`}
                </span>
                <span>
                  {currentItemProgress?.speed && `${currentItemProgress.speed}`}
                  {currentItemProgress?.speed && currentItemProgress?.eta && " · "}
                  {currentItemProgress?.eta && `ETA ${currentItemProgress.eta}`}
                </span>
              </div>
            </div>
          )}

          {/* Videos Table */}
          <div style={{ border: "2px solid var(--border-color)", background: "var(--bg-white)", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "var(--bg-ivory)", borderBottom: "2px solid var(--border-color)" }}>
                  <th style={{ padding: "0.75rem", width: 40, textAlign: "center" }}>#</th>
                  <th style={{ padding: "0.75rem", width: 40, textAlign: "center" }}>Select</th>
                  <th style={{ padding: "0.75rem", width: 90 }}>Preview</th>
                  <th style={{ padding: "0.75rem" }}>Title</th>
                  <th style={{ padding: "0.75rem", width: 90 }}>Duration</th>
                  <th style={{ padding: "0.75rem", width: 140, textAlign: "right" }}>Action / Status</th>
                </tr>
              </thead>
              <tbody>
                {playlistData.items.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  const status = queueItemStatuses[item.id];
                  const isDownloadingThis = status === "downloading";
                  const isCompletedThis = status === "completed";
                  const isErrorThis = status === "error";
                  const isCancelledThis = status === "cancelled";

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        background: isDownloadingThis ? "rgba(36, 87, 214, 0.08)" : "transparent"
                      }}
                    >
                      <td style={{ padding: "0.75rem", textAlign: "center", fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-subtle)" }}>
                        {item.index.toString().padStart(2, "0")}
                      </td>

                      <td style={{ padding: "0.75rem", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectItem(item.id)}
                          disabled={isQueueRunning}
                          style={{ cursor: "pointer", width: 16, height: 16, accentColor: "var(--accent-red)" }}
                        />
                      </td>

                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        <div style={{ width: 72, height: 42, background: "var(--bg-ivory)", border: "1px solid var(--border-color)", overflow: "hidden", position: "relative" }}>
                          {item.thumbnail ? (
                            <img src={item.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Play size={14} color="var(--text-subtle)" />
                            </div>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: "0.75rem", fontWeight: 600 }}>
                        <div style={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.title}>
                          {item.title}
                        </div>
                        {item.uploader && (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 400 }}>
                            {item.uploader}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "0.75rem", fontFamily: "var(--font-display)", fontSize: "0.8125rem" }}>
                        {formatDuration(item.duration) || "—"}
                      </td>

                      <td style={{ padding: "0.75rem", textAlign: "right" }}>
                        {isCompletedThis ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#2E7D32", fontWeight: 700, fontSize: "0.8125rem" }}>
                            <CheckCircle size={14} />
                            <span>Done</span>
                          </span>
                        ) : isDownloadingThis ? (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--accent-red)", fontWeight: 700, fontSize: "0.8125rem" }}>
                              <Loader2 size={14} className="spin-fast" />
                              <span>{activePercent !== null ? `${activePercent}%` : "Active"}</span>
                            </span>
                            <button
                              type="button"
                              className="btn-row-cancel"
                              onClick={cancelActiveDownload}
                              title="Cancel this download"
                            >
                              <XCircle size={12} />
                              <span>Cancel</span>
                            </button>
                          </div>
                        ) : isCancelledThis ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-muted)", fontWeight: 600, fontSize: "0.8125rem" }}>
                            <Ban size={13} />
                            <span>Cancelled</span>
                          </span>
                        ) : isErrorThis ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--accent-red)", fontWeight: 700, fontSize: "0.8125rem" }}>
                            <AlertCircle size={14} />
                            <span>Error</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary-action"
                            style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                            onClick={() => downloadSingleItem(item)}
                            disabled={isQueueRunning}
                            title="Download this video directly"
                          >
                            <Download size={12} />
                            <span>Download</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
