import logging
import os
import shutil
import socket
import subprocess
import time
from typing import Optional

logger = logging.getLogger("pot_service")

POT_PROCESS: Optional[subprocess.Popen] = None
POT_HOST = "127.0.0.1"
POT_PORT = 4416


def is_pot_server_running(host: str = POT_HOST, port: int = POT_PORT, timeout: float = 0.5) -> bool:
    """
    Checks if the local or configured bgutil POT HTTP server is accepting connections.
    """
    try:
        from app.config import settings
        if settings.POT_BASE_URL:
            from urllib.parse import urlparse
            p = urlparse(settings.POT_BASE_URL)
            host = p.hostname or host
            port = p.port or port
    except Exception:
        pass

    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def find_pot_binary() -> Optional[str]:
    """
    Finds the bgutil-pot binary if installed in the system.
    """
    candidates = [
        shutil.which("bgutil-pot"),
        "/usr/local/bin/bgutil-pot",
        "/usr/bin/bgutil-pot",
        os.path.join(os.getcwd(), "bgutil-pot"),
        os.path.join(os.getcwd(), "bgutil-pot.exe"),
    ]
    for c in candidates:
        if c and os.path.isfile(c) and os.access(c, os.X_OK if hasattr(os, "X_OK") else os.R_OK):
            return c
    return None


def start_pot_server() -> bool:
    """
    Starts the background bgutil-pot server daemon if available and not already running.
    """
    global POT_PROCESS

    if is_pot_server_running():
        logger.info("POT provider server already active on %s:%d", POT_HOST, POT_PORT)
        return True

    binary = find_pot_binary()
    if not binary:
        logger.info("bgutil-pot binary not found on host; POT provider server will not be spawned.")
        return False

    try:
        logger.info("Launching bgutil-pot server from %s on %s:%d...", binary, POT_HOST, POT_PORT)
        POT_PROCESS = subprocess.Popen(
            [binary, "server", "--host", POT_HOST, "--port", str(POT_PORT)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        # Wait up to 2.5 seconds for the server to bind
        start_time = time.time()
        while time.time() - start_time < 2.5:
            if is_pot_server_running(timeout=0.2):
                logger.info("bgutil-pot server successfully started and listening on %s:%d (PID %d)", POT_HOST, POT_PORT, POT_PROCESS.pid)
                return True
            time.sleep(0.1)

        logger.warning("bgutil-pot server was started but did not respond on port %d within timeout", POT_PORT)
        return False
    except Exception as e:
        logger.error("Failed to spawn bgutil-pot server: %s", e, exc_info=True)
        return False


def stop_pot_server() -> None:
    """
    Stops the background bgutil-pot server daemon if it was spawned by this process.
    """
    global POT_PROCESS
    if POT_PROCESS is not None:
        try:
            logger.info("Terminating bgutil-pot server (PID %d)...", POT_PROCESS.pid)
            POT_PROCESS.terminate()
            POT_PROCESS.wait(timeout=2.0)
        except Exception:
            POT_PROCESS.kill()
        finally:
            POT_PROCESS = None
