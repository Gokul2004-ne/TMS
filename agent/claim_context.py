from datetime import datetime
from typing import Optional, Tuple


class ClaimContextManager:
    """
    Manages the ACTIVE CLAIM CONTEXT state machine.
    Attributes all subsequent application activities to the active claim
    until a new claim is detected or current claim is closed.
    """

    def __init__(self):
        self.active_claim_id: Optional[str] = None
        self.claim_start_time: Optional[datetime] = None
        self.detection_source: str = "NONE"  # AUTO, DIALOG, MANUAL

    def update_detected_claim(self, detected_claim_id: Optional[str]) -> Tuple[Optional[str], bool]:
        """
        Processes a newly detected claim ID from the window tracker.
        Returns (active_claim_id, has_switched).
        """
        if not detected_claim_id:
            # Maintain active claim context even when switching between helper apps
            # (Excel, Browser, Notepad, etc.)
            return self.active_claim_id, False

        # If a different claim ID is explicitly detected in the window title:
        if detected_claim_id != self.active_claim_id:
            old_claim = self.active_claim_id
            self.active_claim_id = detected_claim_id
            self.claim_start_time = datetime.utcnow()
            self.detection_source = "AUTO"
            return self.active_claim_id, True

        return self.active_claim_id, False

    def set_manual_claim(self, claim_id: str, source: str = "MANUAL"):
        """Manually sets the active claim context (e.g. from dialog prompt)."""
        self.active_claim_id = claim_id.strip().upper()
        self.claim_start_time = datetime.utcnow()
        self.detection_source = source

    def close_active_claim(self) -> Optional[str]:
        """Closes the currently active claim context."""
        closed = self.active_claim_id
        self.active_claim_id = None
        self.claim_start_time = None
        self.detection_source = "NONE"
        return closed

    def get_current_claim_id(self) -> str:
        """Returns the current claim ID or 'UNASSIGNED' if no claim is active."""
        return self.active_claim_id or "UNASSIGNED"
