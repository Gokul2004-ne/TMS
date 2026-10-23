import os
import sqlite3
import csv
from datetime import datetime, timezone
from typing import Optional, Tuple


import sys

def get_persistent_storage_dir() -> str:
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


class ClaimContextManager:
    """
    Manages the ACTIVE CLAIM CONTEXT state machine.
    Attributes all subsequent application activities to the active claim
    until a new claim is detected or current claim is closed.
    Tracks and persists the lastly worked claim/denial ID automatically.
    """

    def __init__(self):
        self.active_claim_id: Optional[str] = None
        self.claim_start_time: Optional[datetime] = None
        self.active_claim_type: str = "CR - Call / IVR"
        self.active_target_minutes: int = 14
        self.active_target_seconds: int = 840
        self.detection_source: str = "NONE"  # AUTO, DIALOG, MANUAL
        self.storage_dir = get_persistent_storage_dir()
        self.cache_file_path = os.path.join(self.storage_dir, ".last_worked_claim")
        self.last_worked_claim_id: Optional[str] = self._discover_initial_last_claim()

    def _discover_initial_last_claim(self, exclude_claim_id: Optional[str] = None) -> Optional[str]:
        """Automatically discovers the most recent claim worked by this associate."""
        clean_exclude = (exclude_claim_id or "").strip().upper()

        # 1. From local persistent cache file
        try:
            if os.path.exists(self.cache_file_path):
                with open(self.cache_file_path, "r", encoding="utf-8") as f:
                    val = f.read().strip()
                    if val and val != "UNASSIGNED" and "NONE" not in val.upper():
                        val_up = val.upper()
                        if not clean_exclude or val_up != clean_exclude:
                            return val_up
        except Exception:
            pass

        # 2. From SQLite database (most recent non-unassigned claim)
        try:
            db_path = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tms.db"))
            if os.path.exists(db_path):
                con = sqlite3.connect(db_path)
                cur = con.cursor()
                if clean_exclude:
                    cur.execute(
                        "SELECT claim_id FROM claim_timelines WHERE claim_id IS NOT NULL AND claim_id != 'UNASSIGNED' AND UPPER(claim_id) != ? ORDER BY id DESC LIMIT 1",
                        (clean_exclude,)
                    )
                else:
                    cur.execute(
                        "SELECT claim_id FROM claim_timelines WHERE claim_id IS NOT NULL AND claim_id != 'UNASSIGNED' ORDER BY id DESC LIMIT 1"
                    )
                row = cur.fetchone()
                if not row:
                    if clean_exclude:
                        cur.execute(
                            "SELECT claim_id FROM events WHERE claim_id IS NOT NULL AND claim_id != 'UNASSIGNED' AND UPPER(claim_id) != ? ORDER BY id DESC LIMIT 1",
                            (clean_exclude,)
                        )
                    else:
                        cur.execute(
                            "SELECT claim_id FROM events WHERE claim_id IS NOT NULL AND claim_id != 'UNASSIGNED' ORDER BY id DESC LIMIT 1"
                        )
                    row = cur.fetchone()
                con.close()
                if row and row[0] and row[0] != "UNASSIGNED":
                    val = str(row[0]).strip().upper()
                    if not clean_exclude or val != clean_exclude:
                        self._save_last_claim(val)
                        return val
        except Exception:
            pass

        # 3. From TMS_Completed_Claims.csv
        try:
            csv_path = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "TMS_Completed_Claims.csv"))
            if os.path.exists(csv_path):
                with open(csv_path, "r", encoding="utf-8") as f:
                    rows = list(csv.reader(f))
                    for r in reversed(rows):
                        if len(r) > 4:
                            cid = str(r[4]).strip().upper()
                            if cid and cid != "UNASSIGNED" and cid != "CLAIM ID":
                                if not clean_exclude or cid != clean_exclude:
                                    self._save_last_claim(cid)
                                    return cid
        except Exception:
            pass

        return None

    def _save_last_claim(self, claim_id: str):
        """Persists the lastly worked claim to disk so it survives restarts."""
        try:
            clean = claim_id.strip().upper()
            if clean and clean != "UNASSIGNED" and "NONE" not in clean:
                with open(self.cache_file_path, "w", encoding="utf-8") as f:
                    f.write(clean)
        except Exception:
            pass

    def record_worked_claim(self, claim_id: str):
        """Records a claim as having been worked and updates lastly worked state."""
        clean = (claim_id or "").strip().upper()
        if clean and clean != "UNASSIGNED" and "NONE" not in clean:
            self.last_worked_claim_id = clean
            self._save_last_claim(clean)

    def get_last_worked_claim_id(self, exclude_claim_id: Optional[str] = None) -> str:
        """Returns the lastly worked claim/denial ID, discovering if necessary."""
        clean_exclude = (exclude_claim_id or "").strip().upper()
        if self.last_worked_claim_id:
            if not clean_exclude or self.last_worked_claim_id != clean_exclude:
                return self.last_worked_claim_id
        discovered = self._discover_initial_last_claim(exclude_claim_id=clean_exclude)
        if discovered:
            self.last_worked_claim_id = discovered
            return discovered
        if self.last_worked_claim_id and self.last_worked_claim_id != clean_exclude:
            return self.last_worked_claim_id
        return ""

    def update_detected_claim(self, detected_claim_id: Optional[str]) -> Tuple[Optional[str], bool]:
        """
        Processes a newly detected claim ID from the window tracker.
        Returns (active_claim_id, has_switched).
        """
        if not detected_claim_id:
            # Maintain active claim context even when switching between helper apps
            return self.active_claim_id, False

        clean_detected = detected_claim_id.strip().upper()

        # If a different claim ID is explicitly detected in the window title:
        if clean_detected != self.active_claim_id:
            old_claim = self.active_claim_id
            if old_claim and old_claim != "UNASSIGNED" and old_claim != clean_detected:
                self.record_worked_claim(old_claim)

            self.active_claim_id = clean_detected
            self.claim_start_time = datetime.now(timezone.utc)
            self.detection_source = "AUTO"
            return self.active_claim_id, True

        return self.active_claim_id, False

    def set_manual_claim(
        self,
        claim_id: str,
        source: str = "MANUAL",
        claim_type: str = "CR - Call / IVR",
        target_minutes: int = 14,
        target_seconds: int = 840
    ):
        """Manually sets the active claim context (e.g. from dialog prompt)."""
        clean = claim_id.strip().upper()
        if self.active_claim_id and self.active_claim_id != "UNASSIGNED" and self.active_claim_id != clean:
            self.record_worked_claim(self.active_claim_id)
        self.active_claim_id = clean
        self.active_claim_type = claim_type
        self.active_target_minutes = target_minutes
        self.active_target_seconds = target_seconds
        self.claim_start_time = datetime.now(timezone.utc)
        self.detection_source = source

    def close_active_claim(self) -> Optional[str]:
        """Closes the currently active claim context."""
        closed = self.active_claim_id
        if closed and closed != "UNASSIGNED":
            self.record_worked_claim(closed)
        self.active_claim_id = None
        self.claim_start_time = None
        self.detection_source = "NONE"
        return closed

    def get_current_claim_id(self) -> str:
        """Returns the current claim ID or 'UNASSIGNED' if no claim is active."""
        return self.active_claim_id or "UNASSIGNED"

    def clear_claim(self):
        """Clears the active claim context and resets to UNASSIGNED."""
        if self.active_claim_id and self.active_claim_id != "UNASSIGNED":
            self.record_worked_claim(self.active_claim_id)
        self.active_claim_id = "UNASSIGNED"
        self.claim_start_time = None
        self.detection_source = "NONE"

