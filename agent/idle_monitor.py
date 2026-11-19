import time
import sys
from typing import Optional

# Native Windows GetLastInputInfo API for zero-lag, permission-free global idle detection
is_windows = sys.platform == "win32"
if is_windows:
    import ctypes

    class LASTINPUTINFO(ctypes.Structure):
        _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]


class IdleMonitor:
    """Monitors system-wide user inactivity (idle time) on Windows."""

    def __init__(self, idle_threshold_sec: int = 60):
        self.idle_threshold_sec = idle_threshold_sec
        self._last_active_time = time.time()
        self._was_idle = False

    def get_idle_seconds(self) -> float:
        """Returns the number of seconds since the last mouse or keyboard input."""
        if is_windows:
            try:
                lii = LASTINPUTINFO()
                lii.cbSize = ctypes.sizeof(LASTINPUTINFO)
                if ctypes.windll.user32.GetLastInputInfo(ctypes.byref(lii)):
                    millis = ctypes.windll.kernel32.GetTickCount() - lii.dwTime
                    return max(0.0, millis / 1000.0)
            except Exception:
                pass

        # Fallback simulated time
        return max(0.0, time.time() - self._last_active_time)

    def is_idle(self) -> bool:
        """Checks if current idle duration exceeds the configured threshold."""
        return self.get_idle_seconds() >= self.idle_threshold_sec

    def check_idle_transition(self) -> Optional[str]:
        """
        Detects transitions between active and idle states.
        Returns 'IDLE_START' if newly idle, 'IDLE_END' if newly resumed, or None.
        """
        currently_idle = self.is_idle()
        transition = None

        if currently_idle and not self._was_idle:
            transition = "IDLE_START"
            self._was_idle = True
        elif not currently_idle and self._was_idle:
            transition = "IDLE_END"
            self._was_idle = False

        return transition
