import React, { useState, useRef } from "react";
import { Clipboard, ArrowRight, Loader2, X, Check, Link2, Play, ListVideo, Globe, Sparkles } from "lucide-react";

export default function UrlForm({ onSearch, isLoading, disabled, defaultUrl = "" }) {
  const [url, setUrl] = useState(defaultUrl);
  const [inputError, setInputError] = useState("");
  const [isPasted, setIsPasted] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const pasteTimerRef = useRef(null);

  // URL type detection for joyful interactive feedback
  const detectUrlType = (input) => {
    const str = (input || "").trim().toLowerCase();
    if (!str) return null;
    if (str.includes("youtube.com/playlist") || str.includes("list=")) {
      return { type: "playlist", label: "YouTube Playlist Link", color: "var(--accent-blue)", icon: ListVideo };
    }
    if (str.includes("youtube.com") || str.includes("youtu.be")) {
      return { type: "youtube", label: "YouTube Video Link", color: "var(--accent-red)", icon: Play };
    }
    try {
      const p = new URL(str);
      if (p.protocol === "http:" || p.protocol === "https:") {
        return { type: "web", label: "Direct Web Stream Link", color: "#C59B27", icon: Globe };
      }
    } catch {}
    return { type: "typing", label: "Entering Address…", color: "var(--text-subtle)", icon: Link2 };
  };

  const detected = detectUrlType(url);
  const LeadingIcon = detected?.icon || Link2;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        setInputError("");
        setIsPasted(true);
        if (pasteTimerRef.current) clearTimeout(pasteTimerRef.current);
        pasteTimerRef.current = setTimeout(() => setIsPasted(false), 1600);
      }
    } catch {
      setInputError("Clipboard access was blocked by your browser. Please paste the link manually.");
    }
  };

  const handleClear = () => {
    setUrl("");
    setInputError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setInputError("Please enter or paste a video URL.");
      return;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setInputError("Please enter a valid HTTP or HTTPS address.");
        return;
      }
    } catch {
      setInputError("Please enter a valid, complete web address (e.g. https://...).");
      return;
    }

    setInputError("");
    onSearch(trimmed);
  };

  return (
    <div>
      <div className="workspace-label-bar">
        <label htmlFor="media-url-input" className="workspace-label">
          <span className="label-marker" />
          <span>Video URL</span>
        </label>
        <span className="workspace-step-tag">
          STEP 01
        </span>
      </div>

      <form onSubmit={handleSubmit} className="url-form-root">
        <div className={`url-input-group ${isFocused ? "url-group-focused" : ""} ${url.trim() ? "url-group-has-content" : ""}`}>
          {/* Animated Top Bauhaus Scanning Track */}
          <div className="bauhaus-scanner-track" aria-hidden="true">
            <span className="scanner-segment seg-red" />
            <span className="scanner-segment seg-yellow" />
            <span className="scanner-segment seg-blue" />
          </div>

          {/* Interactive Leading Geometric Badge */}
          <div className={`url-lead-badge ${detected ? `lead-${detected.type}` : ""}`} title={detected?.label || "Paste stream link"}>
            <LeadingIcon size={15} className="lead-icon" />
          </div>

          <input
            id="media-url-input"
            type="url"
            className="url-text-field"
            placeholder="Paste a video link here… (e.g. https://www.youtube.com/watch?v=...)"
            value={url}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onChange={(e) => {
              setUrl(e.target.value);
              if (inputError) setInputError("");
            }}
            disabled={isLoading || disabled}
            autoComplete="off"
            spellCheck="false"
          />

          {/* Joyful Clear Button when input has text */}
          {url && !isLoading && !disabled && (
            <button
              type="button"
              className="btn-clear-url"
              onClick={handleClear}
              title="Clear input"
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
              title="Paste URL from clipboard"
              disabled={isLoading || disabled}
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
              className={`btn-submit-fetch ${url.trim() ? "btn-fetch-active" : ""}`}
              disabled={isLoading || !url.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="spin-fast" />
                  <span>Fetching…</span>
                </>
              ) : (
                <>
                  <span>Fetch video</span>
                  <ArrowRight size={16} className="fetch-arrow-icon" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Interactive Helper / Detection Pill */}
        <div className="url-helper-row">
          {detected && detected.type !== "typing" ? (
            <div className={`url-detect-pill pill-${detected.type}`}>
              <Sparkles size={11} />
              <span>{detected.label} recognized</span>
            </div>
          ) : (
            <span className="url-default-hint">
              Use a link to content you own or are authorized to download. Supports 4K UHD, 1080p, and MP3 audio.
            </span>
          )}
        </div>

        {inputError && (
          <div className="bauhaus-alert alert-type-error">
            <strong>Input Error:</strong> {inputError}
          </div>
        )}
      </form>
    </div>
  );
}
