import re
import socket
import ipaddress
from urllib.parse import urlsplit, urlunsplit, quote
from pathlib import Path
from typing import Optional

# Disallowed hostnames and metadata addresses
DISALLOWED_HOSTS = {
    "localhost",
    "127.0.0.1",
    "::1",
    "0.0.0.0",
    "metadata.google.internal",
    "instance-data",
}

def is_ip_restricted(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """
    Checks if an IP address belongs to private, loopback, link-local, multicast,
    or unspecified ranges.
    """
    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_unspecified
    ):
        return True
    return False


def validate_and_sanitize_url(raw_url: str) -> str:
    """
    Validates that a URL is safe to process:
    - Must be http or https
    - Hostname must be present and resolve only to public IP addresses
    - Blocks localhost, private IP ranges (RFC 1918), link-local (169.254.x), loopback, cloud metadata
    """
    if not raw_url or not isinstance(raw_url, str):
        raise ValueError("URL must be a non-empty string.")

    cleaned_url = raw_url.strip()
    if len(cleaned_url) > 2048:
        raise ValueError("URL exceeds maximum allowed length.")

    parsed = urlsplit(cleaned_url)
    if parsed.scheme.lower() not in ("http", "https"):
        raise ValueError("Only HTTP and HTTPS URLs are allowed.")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL must contain a valid hostname.")

    hostname_lower = hostname.lower()

    if hostname_lower in DISALLOWED_HOSTS or hostname_lower.endswith(".local") or hostname_lower.endswith(".internal"):
        raise ValueError("Requests to local or private hostnames are forbidden.")

    # Try to parse as direct IP
    try:
        ip = ipaddress.ip_address(hostname_lower)
        if is_ip_restricted(ip):
            raise ValueError("Requests to private, loopback, or internal IP addresses are forbidden.")
    except ValueError as e:
        if "forbidden" in str(e):
            raise
        # Not a direct IP address, resolve via DNS
        try:
            addr_info = socket.getaddrinfo(hostname, None)
            for item in addr_info:
                ip_str = item[4][0]
                resolved_ip = ipaddress.ip_address(ip_str)
                if is_ip_restricted(resolved_ip):
                    raise ValueError("Resolved address is within a private or restricted network range.")
        except socket.gaierror:
            raise ValueError(f"Could not resolve hostname '{hostname}'.")

    return cleaned_url


def sanitize_filename(name: str, default_name: str = "download") -> str:
    """
    Sanitizes a string to be safely used in Content-Disposition and filesystem operations.
    Removes path traversal, control characters, fullwidth lookalikes, and reserved symbols.
    """
    if not name:
        return default_name

    # Replace fullwidth / unicode lookalikes of reserved filesystem chars
    unicode_replacements = {
        "：": " - ",
        "⧸": " - ",
        "＼": " - ",
        "？": "",
        "＊": "",
        "＂": "",
        "＜": "",
        "＞": "",
        "｜": " - ",
    }
    for bad_char, replacement in unicode_replacements.items():
        name = name.replace(bad_char, replacement)

    # Remove directory separators and path traversal
    name = name.replace("\\", "_").replace("/", "_")
    name = re.sub(r"\.\.+", "_", name)

    # Remove control characters and characters reserved on Windows/Linux
    cleaned = re.sub(r'[\x00-\x1f\x7f<>:"/\\|?*]', "", name)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip(". _")

    if not cleaned:
        cleaned = default_name

    # Truncate length safely preserving extension
    if len(cleaned) > 160:
        parts = cleaned.rsplit(".", 1)
        if len(parts) == 2 and len(parts[1]) <= 6:
            base, ext = parts
            cleaned = base[: 160 - len(ext) - 1] + "." + ext
        else:
            cleaned = cleaned[:160]

    return cleaned


def make_content_disposition_header(filename: str) -> str:
    """
    Creates an RFC 6266 / RFC 5987 compliant Content-Disposition header.
    Standard filename parameter MUST be strictly 7-bit ASCII to prevent
    UnicodeEncodeError in ASGI / HTTP servers, while filename* carries the
    full UTF-8 encoded filename for modern browsers.
    """
    # 7-bit ASCII safe fallback for filename="..."
    ascii_name = re.sub(r'[^\x20-\x7E]', '_', filename)
    ascii_name = ascii_name.replace('"', '').replace('\\', '').strip()
    if not ascii_name or ascii_name == Path(filename).suffix:
        ext = Path(filename).suffix or ".mp4"
        ascii_name = f"download{ext}"

    utf8_encoded = quote(filename, encoding="utf-8")
    return f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{utf8_encoded}'


def mask_url_for_logging(url: str) -> str:
    """
    Masks query parameters that may contain sensitive credentials/tokens.
    """
    try:
        parsed = urlsplit(url)
        # Keep scheme, host, path, omit query string in logs to avoid leaking tokens
        return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))
    except Exception:
        return "[redacted-url]"
