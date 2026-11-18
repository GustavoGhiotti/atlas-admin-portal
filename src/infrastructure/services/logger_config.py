import logging
from datetime import datetime, timedelta
from pathlib import Path


LOG_DIR = Path("logs")
LOG_FILE_PREFIX = "atlas"
LOG_RETENTION_DAYS = 7
LOG_FORMATTER = logging.Formatter("%(asctime)s | %(name)s | %(levelname)s | %(message)s")
_SHARED_HANDLER: logging.Handler | None = None


class DailyFileHandler(logging.FileHandler):
    def __init__(self, log_dir: Path, prefix: str, retention_days: int, encoding: str = "utf-8") -> None:
        self.log_dir = log_dir
        self.prefix = prefix
        self.retention_days = retention_days
        self.current_date = datetime.now().date()

        self.log_dir.mkdir(parents=True, exist_ok=True)
        super().__init__(str(self._build_log_path(self.current_date)), encoding=encoding)
        self._cleanup_old_files()

    def emit(self, record: logging.LogRecord) -> None:
        self._rotate_if_needed()
        super().emit(record)

    def _build_log_path(self, target_date) -> Path:
        return self.log_dir / f"{self.prefix}-{target_date:%Y-%m-%d}.log"

    def _rotate_if_needed(self) -> None:
        today = datetime.now().date()
        if today == self.current_date:
            return

        self.acquire()
        try:
            today = datetime.now().date()
            if today == self.current_date:
                return

            if self.stream:
                self.stream.close()
                self.stream = None

            self.baseFilename = str(self._build_log_path(today))
            self.stream = self._open()
            self.current_date = today
            self._cleanup_old_files()
        finally:
            self.release()

    def _cleanup_old_files(self) -> None:
        cutoff_date = datetime.now().date() - timedelta(days=self.retention_days - 1)
        prefix = f"{self.prefix}-"

        for log_file in self.log_dir.glob(f"{prefix}*.log"):
            date_part = log_file.stem.removeprefix(prefix)
            try:
                file_date = datetime.strptime(date_part, "%Y-%m-%d").date()
            except ValueError:
                continue

            if file_date < cutoff_date:
                try:
                    log_file.unlink()
                except OSError:
                    continue


def _get_shared_handler() -> logging.Handler:
    global _SHARED_HANDLER

    if _SHARED_HANDLER is None:
        _SHARED_HANDLER = DailyFileHandler(
            log_dir=LOG_DIR,
            prefix=LOG_FILE_PREFIX,
            retention_days=LOG_RETENTION_DAYS,
            encoding="utf-8",
        )
        _SHARED_HANDLER.setFormatter(LOG_FORMATTER)

    return _SHARED_HANDLER


def setup_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)
    logger.addHandler(_get_shared_handler())
    logger.propagate = False
    return logger
