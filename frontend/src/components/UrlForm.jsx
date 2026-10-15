import React, { useState } from "react";
import { Clipboard, ArrowRight, Loader2 } from "lucide-react";

export default function UrlForm({ onSearch, isLoading, disabled, defaultUrl = "" }) {
  const [url, setUrl] = useState(defaultUrl);
  const [inputError, setInputError] = useState("");

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        setInputError("");
      }
    } catch {
      setInputError("Clipboard access was blocked by your browser. Please paste the link manually.");
    }
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
          Video URL
        </label>
        <span style={{ fontSize: "0.75rem", color: "var(--text-subtle)", letterSpacing: "0.04em" }}>
          STEP 01
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="url-input-group">
          <input
            id="media-url-input"
            type="url"
            className="url-text-field"
            placeholder="Paste a video link here…"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (inputError) setInputError("");
            }}
            disabled={isLoading || disabled}
            autoComplete="off"
            spellCheck="false"
          />

          <div className="url-input-actions">
            <button
              type="button"
              className="btn-paste"
              onClick={handlePaste}
              title="Paste URL from clipboard"
              disabled={isLoading || disabled}
            >
              <Clipboard size={14} />
              <span>Paste</span>
            </button>

            <button
              type="submit"
              className="btn-submit-fetch"
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
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>

        <div className="url-helper-note">
          <span>Use a link to content you own or are authorized to download.</span>
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
