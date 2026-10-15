import pytest
from app.utils.security import (
    validate_and_sanitize_url,
    sanitize_filename,
    make_content_disposition_header,
    mask_url_for_logging
)

def test_valid_urls():
    assert validate_and_sanitize_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    assert validate_and_sanitize_url("http://vimeo.com/76979871") == "http://vimeo.com/76979871"

def test_invalid_schemes():
    with pytest.raises(ValueError, match="Only HTTP and HTTPS URLs are allowed"):
        validate_and_sanitize_url("ftp://example.com/file.mp4")
    with pytest.raises(ValueError, match="Only HTTP and HTTPS URLs are allowed"):
        validate_and_sanitize_url("file:///etc/passwd")
    with pytest.raises(ValueError, match="Only HTTP and HTTPS URLs are allowed"):
        validate_and_sanitize_url("javascript:alert(1)")

def test_ssrf_protection_localhost_and_private():
    # Direct localhost names
    with pytest.raises(ValueError, match="forbidden"):
        validate_and_sanitize_url("http://localhost:8000/api")
    with pytest.raises(ValueError, match="forbidden"):
        validate_and_sanitize_url("http://127.0.0.1:8080/test")
    # Private IP addresses
    with pytest.raises(ValueError, match="forbidden"):
        validate_and_sanitize_url("http://192.168.1.1/admin")
    with pytest.raises(ValueError, match="forbidden"):
        validate_and_sanitize_url("http://10.0.0.5/secrets")
    with pytest.raises(ValueError, match="forbidden"):
        validate_and_sanitize_url("http://172.16.0.1/")
    # Cloud metadata endpoint
    with pytest.raises(ValueError, match="forbidden"):
        validate_and_sanitize_url("http://169.254.169.254/latest/meta-data")

def test_sanitize_filename():
    assert sanitize_filename("safe_video.mp4") == "safe_video.mp4"
    # Strips path traversal sequences and characters
    sanitized = sanitize_filename("../../etc/passwd.mp4")
    assert "/" not in sanitized
    assert "\\" not in sanitized
    assert ".." not in sanitized
    assert sanitize_filename("bad:name*with?chars.webm") == "badnamewithchars.webm"
    assert sanitize_filename("") == "download"

    # Fullwidth unicode colon and solidus
    fullwidth = "L4： Introduction to DBMS⧸1： test [123].mp4"
    sanitized_fullwidth = sanitize_filename(fullwidth)
    assert "：" not in sanitized_fullwidth
    assert "⧸" not in sanitized_fullwidth

def test_make_content_disposition_header_ascii_safe():
    unicode_name = "L4： Introduction to DBMS⧸1： data [s1Jb-NJNpT4].mp4"
    header = make_content_disposition_header(unicode_name)
    # The header must encode cleanly in ISO-8859-1 (latin-1) for ASGI/Uvicorn compliance
    encoded = header.encode("latin-1")
    assert encoded is not None
    assert "filename*=" in header

def test_mask_url_for_logging():
    masked = mask_url_for_logging("https://example.com/watch?v=123&token=SECRET_TOKEN_456")
    assert "SECRET_TOKEN_456" not in masked
    assert "https://example.com/watch" in masked
