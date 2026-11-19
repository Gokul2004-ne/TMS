from typing import List, Dict, Any


class NVAEngine:
    """
    Rules-based Non-Value-Added (NVA) analysis engine for Accounts Receivable claims.
    
    TODO [Member 3 - AI Engine]:
    Implement the 5 core NVA rules to detect process friction:
    1. EXCEL_OVERUSE: Excel active time >= 40% of total duration (min duration 180s).
    2. APP_SWITCHING: Application context switches >= 8 per claim.
    3. LONG_IDLE: Accumulated inactive idle duration >= 180s.
    4. OUTLIER: Total handling time >= 1200s (20 mins).
    5. REWORK: Multiple touches on the same claim (touches >= 2).
    
    See ai/README.md for detailed specifications, boundary test cases, and guidance.
    """

    EXCEL_OVERUSE_THRESHOLD = 0.40        # 40% of total active time
    EXCEL_MIN_DURATION_SEC = 180         # Minimum claim time to trigger Excel alert (3 mins)
    APP_SWITCH_THRESHOLD = 8              # Max acceptable context switches per claim
    IDLE_DURATION_THRESHOLD_SEC = 180     # Max acceptable continuous/accumulated idle (3 mins)
    OUTLIER_DURATION_THRESHOLD_SEC = 1200 # Max acceptable handling time (20 mins)
    REWORK_TOUCH_THRESHOLD = 2            # Re-opening claim 2+ times

    def analyze_claim(self, claim: Dict[str, Any]) -> List[str]:
        """
        Runs the 5 NVA rules on a single claim timeline dictionary.
        Returns a list of detected NVA flag strings.
        """
        flags: List[str] = []

        total_sec = claim.get("total_duration_seconds", 0)
        active_sec = claim.get("active_duration_seconds", 0)
        idle_sec = claim.get("idle_duration_seconds", 0)
        switches = claim.get("app_switches_count", 0)
        app_breakdown = claim.get("app_breakdown", {})
        touches = claim.get("touches_count") or claim.get("touch_count") or 1

        if total_sec <= 0:
            total_sec = active_sec + idle_sec

        # Return early only if all metrics are absent or zero
        if total_sec <= 0 and switches == 0 and touches <= 1 and not app_breakdown:
            return flags

        # Rule 1: Excel Overuse
        excel_sec = app_breakdown.get("Excel", 0)
        if total_sec >= self.EXCEL_MIN_DURATION_SEC and (excel_sec / total_sec) >= self.EXCEL_OVERUSE_THRESHOLD:
            flags.append("EXCEL_OVERUSE")

        # Rule 2: Excessive App Switching
        if switches >= self.APP_SWITCH_THRESHOLD:
            flags.append("APP_SWITCHING")

        # Rule 3: Long Idle Incidents
        if idle_sec >= self.IDLE_DURATION_THRESHOLD_SEC:
            flags.append("LONG_IDLE")

        # Rule 4: Outlier Claim Duration
        if total_sec >= self.OUTLIER_DURATION_THRESHOLD_SEC:
            flags.append("OUTLIER")

        # Rule 5: Rework / Multiple Touches
        if touches >= self.REWORK_TOUCH_THRESHOLD:
            flags.append("REWORK")

        return flags

    # Alias for flexibility
    evaluate_claim = analyze_claim

    def batch_analyze(self, claims: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Analyzes a list of claims and appends 'nva_flags' to each item."""
        enriched = []
        for c in claims:
            item = dict(c)
            item["nva_flags"] = self.analyze_claim(item)
            enriched.append(item)
        return enriched
