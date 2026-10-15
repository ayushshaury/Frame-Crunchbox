import os
import shutil
import time
import logging
from pathlib import Path
from typing import Union

logger = logging.getLogger("cleanup")

def cleanup_path(target_path: Union[str, Path]) -> None:
    """
    Safely removes a file or directory tree without raising exceptions.
    """
    try:
        path = Path(target_path)
        if not path.exists():
            return
        if path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
            logger.info("Removed temporary directory: %s", path)
        else:
            path.unlink(missing_ok=True)
            logger.info("Removed temporary file: %s", path)
    except Exception as e:
        logger.warning("Error cleaning up path '%s': %s", target_path, e)


def cleanup_stale_directories(base_dir: Union[str, Path], max_age_seconds: int = 1800) -> int:
    """
    Removes temporary directories older than max_age_seconds (default 30 mins)
    created by interrupted or abandoned downloads.
    Returns the count of removed directories.
    """
    cleaned_count = 0
    now = time.time()
    try:
        base_path = Path(base_dir)
        if not base_path.exists():
            return 0

        for item in base_path.iterdir():
            if item.is_dir():
                try:
                    mtime = item.stat().st_mtime
                    if now - mtime > max_age_seconds:
                        shutil.rmtree(item, ignore_errors=True)
                        cleaned_count += 1
                        logger.info("Cleaned stale temporary directory: %s", item)
                except Exception as ex:
                    logger.debug("Could not inspect/remove %s: %s", item, ex)
    except Exception as e:
        logger.warning("Error during stale directory cleanup in '%s': %s", base_dir, e)

    return cleaned_count
