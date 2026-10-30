import os
import re
import time
import sqlite3
import threading
import tkinter as tk
from tkinter import messagebox
from typing import Optional, Callable, List, Tuple, Any
import requests

try:
    import ctypes
    ctypes.windll.shcore.SetProcessDpiAwareness(1)
except Exception:
    try:
        import ctypes
        ctypes.windll.user32.SetProcessDPIAware()
    except Exception:
        pass


STANDARD_CLAIM_TYPES = [
    {
        "id": "CR_CALL",
        "short_name": "CR - Call / IVR",
        "label": "CR - Call / IVR (14 mins)",
        "target_minutes": 14,
        "target_seconds": 840,
    },
    {
        "id": "CR_PORTAL",
        "short_name": "CR - Review / Portal",
        "label": "CR - Review / Portal (4 mins)",
        "target_minutes": 4,
        "target_seconds": 240,
    },
    {
        "id": "AP_WRITTEN",
        "short_name": "AP - Review / Written",
        "label": "AP - Review / Written (18 mins)",
        "target_minutes": 18,
        "target_seconds": 1080,
    },
    {
        "id": "AP_CALL",
        "short_name": "AP - Call / Conference",
        "label": "AP - Call / Conference (30 mins)",
        "target_minutes": 30,
        "target_seconds": 1800,
    },
    {
        "id": "SI_CALL",
        "short_name": "SI - Call / IVR",
        "label": "SI - Call / IVR (7 mins)",
        "target_minutes": 7,
        "target_seconds": 420,
    },
    {
        "id": "SI_PORTAL",
        "short_name": "SI - Review / Portal",
        "label": "SI - Review / Portal (2 mins)",
        "target_minutes": 2,
        "target_seconds": 120,
    },
    {
        "id": "DM_CLINICAL",
        "short_name": "DM - Clinical / Auth",
        "label": "DM - Clinical / Auth (13 mins)",
        "target_minutes": 13,
        "target_seconds": 780,
    },
    {
        "id": "DM_ADMIN",
        "short_name": "DM - Admin / Coding",
        "label": "DM - Admin / Coding (8 mins)",
        "target_minutes": 8,
        "target_seconds": 480,
    },
    {
        "id": "PPA_POSTING",
        "short_name": "PPA - Review / Posting",
        "label": "PPA - Review / Posting (3 mins)",
        "target_minutes": 3,
        "target_seconds": 180,
    },
    {
        "id": "RO_DISPUTE",
        "short_name": "RO - Review / Dispute",
        "label": "RO - Review / Dispute (13 mins)",
        "target_minutes": 13,
        "target_seconds": 780,
    },
]

# Shared NovaArc Auth Token Cache and persistent session for desktop agent and dialog
_NOVAARC_AUTH_CACHE = {"token": None, "expires_at": 0.0}
_AGENT_HTTP_SESSION = requests.Session()


def get_cached_novaarc_token() -> Optional[str]:
    now = time.time()
    token = _NOVAARC_AUTH_CACHE.get("token")
    if token and now < _NOVAARC_AUTH_CACHE.get("expires_at", 0):
        return token
    try:
        resp = _AGENT_HTTP_SESSION.post(
            "https://novaarc-backend-i4qm.onrender.com/auth/login",
            json={"email": "client_leadership@novaarc.local", "password": "password123"},
            timeout=6.0
        )
        if resp.status_code == 200:
            token = resp.json().get("access_token")
            _NOVAARC_AUTH_CACHE["token"] = token
            _NOVAARC_AUTH_CACHE["expires_at"] = now + 1800
            return token
    except Exception as e:
        print(f"[NovaArc API] Token fetch notice: {e}")
    return None


def fetch_single_claim_live(raw_id: str) -> Optional[dict]:
    """Directly fetches live claim record from NovaArc backend in <200ms with keep-alive connection & cached bearer token."""
    clean = (raw_id or "").strip().upper()
    digits = re.findall(r"\d+", clean)
    cid_arg = digits[0] if digits else clean.replace("CLM-", "").replace("CLM", "").strip()
    if not cid_arg:
        return None
    token = get_cached_novaarc_token()
    if not token:
        return None
    try:
        r = _AGENT_HTTP_SESSION.get(
            f"https://novaarc-backend-i4qm.onrender.com/claims/{cid_arg}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=3.5
        )
        if r.status_code == 200:
            return r.json()
        elif r.status_code == 401:
            _NOVAARC_AUTH_CACHE["token"] = None
            fresh_token = get_cached_novaarc_token()
            if fresh_token:
                r2 = _AGENT_HTTP_SESSION.get(
                    f"https://novaarc-backend-i4qm.onrender.com/claims/{cid_arg}",
                    headers={"Authorization": f"Bearer {fresh_token}"},
                    timeout=3.5
                )
                if r2.status_code == 200:
                    return r2.json()
    except Exception as e:
        print(f"[NovaArc API] Fetch claim {raw_id} notice: {e}")

    # Fallback to scanning all claims list (instantly discovers newly created claims)
    try:
        all_claims = fetch_all_claims_live()
        for item in all_claims:
            item_c = str(item.get("claim_id") or item.get("id") or "").strip().upper()
            if not item_c:
                continue
            item_clean = f"CLM-{item_c}" if not item_c.startswith("CLM") else item_c
            if item_c == cid_arg or item_clean == clean or item_c == clean or normalize_claim_key(item_clean) == normalize_claim_key(clean):
                return item
    except Exception as e:
        print(f"[NovaArc API] Fetch claim {raw_id} fallback scan notice: {e}")

    return None


def fetch_all_claims_live() -> List[dict]:
    """Fetches full claims list from NovaArc backend in background."""
    token = get_cached_novaarc_token()
    if not token:
        return []
    try:
        r = _AGENT_HTTP_SESSION.get(
            "https://novaarc-backend-i4qm.onrender.com/claims",
            headers={"Authorization": f"Bearer {token}"},
            timeout=4.0
        )
        if r.status_code == 200:
            data = r.json()
            return data if isinstance(data, list) else data.get("items", [])
    except Exception as e:
        print(f"[NovaArc API] Fetch all claims notice: {e}")
    return []


def format_platform_status_display(status_str: str) -> str:
    """Converts internal status keys into human-readable NovaArc platform labels."""
    norm = (status_str or "").strip().lower()
    mapping = {
        "claim_resubmission_call_ivr": "RESUBMIT CLAIM (CALL/IVR)",
        "claim_resubmission_review_portal": "RESUBMIT CLAIM (PORTAL)",
        "appeals_standard_claim_appeal_review_written": "STANDARD APPEAL (WRITTEN)",
        "appeals_complex_peer_to_peer_appeal_call_conference": "COMPLEX APPEAL (PEER-TO-PEER)",
        "status_inquiry_claim_status_check_call_ivr": "STATUS INQUIRY (CALL/IVR)",
        "status_inquiry_claim_status_check_review_portal": "STATUS INQUIRY (PORTAL)",
        "denial_clinical_authorization_denial": "CLINICAL / AUTH DENIAL",
        "denial_administrative_coding_denial": "ADMIN / CODING DENIAL",
        "payment_contractual_adjustment_write_off": "PAID / CONTRACTUAL ADJ",
        "refunds_overpayments_refund_dispute": "REFUND / DISPUTE",
        "paid": "PAID",
        "denied": "DENIED",
        "in_process": "IN PROCESS",
        "acknowledged": "ACKNOWLEDGED",
        "created": "CREATED",
        "submitted": "SUBMITTED",
        "appealed": "APPEALED",
    }
    return mapping.get(norm, (status_str or "").strip().upper())


# NovaArc RCM platform claims catalog with live status and standard benchmarks
PLATFORM_CLAIMS_CATALOG = {
    "CLM-607": {
        "status": "STANDARD APPEAL (WRITTEN)",
        "patient": "MRN126225",
        "provider": "Dr. Amanda Davis",
        "payer": "Payer 10",
        "short_name": "AP - Review / Written",
        "target_minutes": 18,
        "target_seconds": 1080
    },
    "CLM-606": {
        "status": "PAID",
        "patient": "MRN126225",
        "provider": "Dr. Amanda Davis",
        "payer": "Payer 11",
        "short_name": "PPA - Review / Posting",
        "target_minutes": 3,
        "target_seconds": 180
    },
    "CLM-605": {
        "status": "STATUS INQUIRY (CALL/IVR)",
        "patient": "MRN126225",
        "provider": "Dr. Amanda Davis",
        "payer": "Payer 10",
        "short_name": "SI - Call / IVR",
        "target_minutes": 7,
        "target_seconds": 420
    },
    "CLM-604": {
        "status": "PAID",
        "patient": "MRN126225",
        "provider": "Dr. Amanda Davis",
        "payer": "Payer 11",
        "short_name": "PPA - Review / Posting",
        "target_minutes": 3,
        "target_seconds": 180
    },
    "CLM-603": {
        "status": "PAID",
        "patient": "MRN126225",
        "provider": "Dr. Amanda Davis",
        "payer": "Payer 11",
        "short_name": "PPA - Review / Posting",
        "target_minutes": 3,
        "target_seconds": 180
    },
    "CLM-602": {
        "status": "PAID",
        "patient": "MRN126225",
        "provider": "Dr. Amanda Davis",
        "payer": "Payer 11",
        "short_name": "PPA - Review / Posting",
        "target_minutes": 3,
        "target_seconds": 180
    },
    "CLM-601": {
        "status": "PAID",
        "patient": "MRN126225",
        "provider": "Dr. Amanda Davis",
        "payer": "Payer 11",
        "short_name": "PPA - Review / Posting",
        "target_minutes": 3,
        "target_seconds": 180
    },
    "CLM-472": {
        "status": "DENIED",
        "patient": "MRN550664",
        "provider": "Dr. Emily Rodriguez",
        "payer": "Payer 14",
        "short_name": "DM - Clinical / Auth",
        "target_minutes": 13,
        "target_seconds": 780
    },
    "CLM-428": {
        "status": "DENIED",
        "patient": "MRN872246",
        "provider": "Dr. James Wilson",
        "payer": "Payer 16",
        "short_name": "DM - Clinical / Auth",
        "target_minutes": 13,
        "target_seconds": 780
    },
    "CLM-463": {
        "status": "IN PROCESS",
        "patient": "MRN716886",
        "provider": "Dr. Emily Rodriguez",
        "payer": "Payer 15",
        "short_name": "SI - Call / IVR",
        "target_minutes": 7,
        "target_seconds": 420
    },
    "CLM-316": {
        "status": "ACKNOWLEDGED",
        "patient": "MRN383060",
        "provider": "Dr. Amanda Davis",
        "payer": "Payer 11",
        "short_name": "SI - Review / Portal",
        "target_minutes": 2,
        "target_seconds": 120
    },
    "CLM-523": {
        "status": "IN PROCESS",
        "patient": "MRN944151",
        "provider": "Dr. James Wilson",
        "payer": "Payer 9",
        "short_name": "SI - Call / IVR",
        "target_minutes": 7,
        "target_seconds": 420
    },
    "CLM-379": {
        "status": "IN PROCESS",
        "patient": "MRN392075",
        "provider": "Dr. Jennifer Martinez",
        "payer": "Payer 15",
        "short_name": "SI - Call / IVR",
        "target_minutes": 7,
        "target_seconds": 420
    },
    "CLM-551": {
        "status": "CREATED",
        "patient": "MRN517821",
        "provider": "Dr. Michael Chen",
        "payer": "Payer 12",
        "short_name": "CR - Call / IVR",
        "target_minutes": 14,
        "target_seconds": 840
    },
    "CLM-595": {
        "status": "CREATED",
        "patient": "MRN835911",
        "provider": "Dr. Lisa Anderson",
        "payer": "Payer 11",
        "short_name": "CR - Call / IVR",
        "target_minutes": 14,
        "target_seconds": 840
    },
    "CLM-358": {
        "status": "IN PROCESS",
        "patient": "MRN159642",
        "provider": "Dr. Christopher Miller",
        "payer": "Payer 15",
        "short_name": "SI - Call / IVR",
        "target_minutes": 7,
        "target_seconds": 420
    },
    "CLM-475": {
        "status": "IN PROCESS",
        "patient": "MRN969693",
        "provider": "Dr. David Brown",
        "payer": "Payer 13",
        "short_name": "SI - Call / IVR",
        "target_minutes": 7,
        "target_seconds": 420
    },
    "CLM-338": {
        "status": "IN PROCESS",
        "patient": "MRN468203",
        "provider": "Dr. James Wilson",
        "payer": "Payer 13",
        "short_name": "SI - Call / IVR",
        "target_minutes": 7,
        "target_seconds": 420
    },
    "CLM-571": {
        "status": "IN PROCESS",
        "patient": "MRN126225",
        "provider": "Dr. Jennifer Martinez",
        "payer": "Payer 15",
        "short_name": "SI - Call / IVR",
        "target_minutes": 7,
        "target_seconds": 420
    },
    "CLM-418": {
        "status": "APPEALED",
        "patient": "MRN125611",
        "provider": "Dr. Sarah Johnson",
        "payer": "Payer 11",
        "short_name": "AP - Review / Written",
        "target_minutes": 18,
        "target_seconds": 1080
    },
    "CLM-424": {
        "status": "IN PROCESS",
        "patient": "MRN800305",
        "provider": "Dr. David Brown",
        "payer": "Payer 10",
        "short_name": "SI - Call / IVR",
        "target_minutes": 7,
        "target_seconds": 420
    },
    "CLM-307": {
        "status": "IN PROCESS",
        "patient": "MRN237235",
        "provider": "Dr. Emily Rodriguez",
        "payer": "Payer 9",
        "short_name": "SI - Call / IVR",
        "target_minutes": 7,
        "target_seconds": 420
    },
    "CLM-593": {
        "status": "PAID",
        "patient": "MRN102260",
        "provider": "Dr. Lisa Anderson",
        "payer": "Payer 16",
        "short_name": "PPA - Review / Posting",
        "target_minutes": 3,
        "target_seconds": 180
    },
    "CLM-513": {
        "status": "ACKNOWLEDGED",
        "patient": "MRN820892",
        "provider": "Dr. Christopher Miller",
        "payer": "Payer 15",
        "short_name": "SI - Review / Portal",
        "target_minutes": 2,
        "target_seconds": 120
    },
    "CLM-398": {
        "status": "IN PROCESS",
        "patient": "MRN392075",
        "provider": "Dr. Robert Taylor",
        "payer": "Payer 10",
        "short_name": "SI - Call / IVR",
        "target_minutes": 7,
        "target_seconds": 420
    },
    "CLM-563": {
        "status": "CREATED",
        "patient": "MRN710805",
        "provider": "Dr. Emily Rodriguez",
        "payer": "Payer 16",
        "short_name": "CR - Call / IVR",
        "target_minutes": 14,
        "target_seconds": 840
    },
    "CLM-427": {
        "status": "DENIED",
        "patient": "MRN865179",
        "provider": "Dr. Amanda Davis",
        "payer": "Payer 9",
        "short_name": "DM - Clinical / Auth",
        "target_minutes": 13,
        "target_seconds": 780
    },
    "CLM-302": {
        "status": "DENIED",
        "patient": "MRN532322",
        "provider": "Dr. Robert Taylor",
        "payer": "Payer 16",
        "short_name": "DM - Clinical / Auth",
        "target_minutes": 13,
        "target_seconds": 780
    },
    "CLM-344": {
        "status": "APPEALED",
        "patient": "MRN287241",
        "provider": "Dr. Robert Taylor",
        "payer": "Payer 9",
        "short_name": "AP - Review / Written",
        "target_minutes": 18,
        "target_seconds": 1080
    },
    "CLM-443": {
        "status": "SUBMITTED",
        "patient": "MRN996865",
        "provider": "Dr. Michael Chen",
        "payer": "Payer 12",
        "short_name": "CR - Review / Portal",
        "target_minutes": 4,
        "target_seconds": 240
    },
    "CLM-304": {
        "status": "APPEALED",
        "patient": "MRN810219",
        "provider": "Dr. James Wilson",
        "payer": "Payer 10",
        "short_name": "AP - Review / Written",
        "target_minutes": 18,
        "target_seconds": 1080
    },
    "CLM-470": {
        "status": "SUBMITTED",
        "patient": "MRN340062",
        "provider": "Dr. Emily Rodriguez",
        "payer": "Payer 10",
        "short_name": "CR - Review / Portal",
        "target_minutes": 4,
        "target_seconds": 240
    },
    "CLM-375": {
        "status": "IN PROCESS",
        "patient": "MRN884309",
        "provider": "Dr. Emily Rodriguez",
        "payer": "Payer 10",
        "short_name": "SI - Call / IVR",
        "target_minutes": 7,
        "target_seconds": 420
    },
    "CLM-421": {
        "status": "IN PROCESS",
        "patient": "MRN867460",
        "provider": "Dr. James Wilson",
        "payer": "Payer 14",
        "short_name": "SI - Call / IVR",
        "target_minutes": 7,
        "target_seconds": 420
    },
    "CLM-478": {
        "status": "IN PROCESS",
        "patient": "MRN820892",
        "provider": "Dr. Jennifer Martinez",
        "payer": "Payer 14",
        "short_name": "SI - Call / IVR",
        "target_minutes": 7,
        "target_seconds": 420
    },
    "CLM-550": {
        "status": "APPEALED",
        "patient": "MRN878480",
        "provider": "Dr. David Brown",
        "payer": "Payer 16",
        "short_name": "AP - Review / Written",
        "target_minutes": 18,
        "target_seconds": 1080
    },
    "CLM-545": {
        "status": "APPEALED",
        "patient": "MRN905934",
        "provider": "Dr. Christopher Miller",
        "payer": "Payer 16",
        "short_name": "AP - Review / Written",
        "target_minutes": 18,
        "target_seconds": 1080
    },
    "CLM-442": {
        "status": "PAID",
        "patient": "MRN694916",
        "provider": "Dr. Emily Rodriguez",
        "payer": "Payer 15",
        "short_name": "PPA - Review / Posting",
        "target_minutes": 3,
        "target_seconds": 180
    },
    "CLM-579": {
        "status": "SUBMITTED",
        "patient": "MRN672092",
        "provider": "Dr. Christopher Miller",
        "payer": "Payer 14",
        "short_name": "CR - Review / Portal",
        "target_minutes": 4,
        "target_seconds": 240
    },
    "CLM-376": {
        "status": "CREATED",
        "patient": "MRN694916",
        "provider": "Dr. Sarah Johnson",
        "payer": "Payer 14",
        "short_name": "CR - Call / IVR",
        "target_minutes": 14,
        "target_seconds": 840
    },
    "CLM-560": {
        "status": "DENIED",
        "patient": "MRN300896",
        "provider": "Dr. Emily Rodriguez",
        "payer": "Payer 14",
        "short_name": "DM - Clinical / Auth",
        "target_minutes": 13,
        "target_seconds": 780
    },
    "CLM-483": {
        "status": "APPEALED",
        "patient": "MRN922157",
        "provider": "Dr. Robert Taylor",
        "payer": "Payer 10",
        "short_name": "AP - Review / Written",
        "target_minutes": 18,
        "target_seconds": 1080
    },
    "CLM-343": {
        "status": "APPEALED",
        "patient": "MRN358607",
        "provider": "Dr. Jennifer Martinez",
        "payer": "Payer 10",
        "short_name": "AP - Review / Written",
        "target_minutes": 18,
        "target_seconds": 1080
    },
    "CLM-538": {
        "status": "APPEALED",
        "patient": "MRN383060",
        "provider": "Dr. Jennifer Martinez",
        "payer": "Payer 12",
        "short_name": "AP - Review / Written",
        "target_minutes": 18,
        "target_seconds": 1080
    },
    "CLM-527": {
        "status": "IN PROCESS",
        "patient": "MRN719176",
        "provider": "Dr. Michael Chen",
        "payer": "Payer 10",
        "short_name": "SI - Call / IVR",
        "target_minutes": 7,
        "target_seconds": 420
    },
    "CLM-566": {
        "status": "PAID",
        "patient": "MRN385577",
        "provider": "Dr. Lisa Anderson",
        "payer": "Payer 12",
        "short_name": "PPA - Review / Posting",
        "target_minutes": 3,
        "target_seconds": 180
    },
    "CLM-564": {
        "status": "IN PROCESS",
        "patient": "MRN300896",
        "provider": "Dr. Jennifer Martinez",
        "payer": "Payer 16",
        "short_name": "SI - Call / IVR",
        "target_minutes": 7,
        "target_seconds": 420
    },
    "CLM-503": {
        "status": "DENIED",
        "patient": "MRN517821",
        "provider": "Dr. Emily Rodriguez",
        "payer": "Payer 13",
        "short_name": "DM - Clinical / Auth",
        "target_minutes": 13,
        "target_seconds": 780
    },
    "CLM-387": {
        "status": "IN PROCESS",
        "patient": "MRN853240",
        "provider": "Dr. Jennifer Martinez",
        "payer": "Payer 10",
        "short_name": "SI - Call / IVR",
        "target_minutes": 7,
        "target_seconds": 420
    },
    "CLM-363": {
        "status": "DENIED",
        "patient": "MRN640490",
        "provider": "Dr. Sarah Johnson",
        "payer": "Payer 16",
        "short_name": "DM - Clinical / Auth",
        "target_minutes": 13,
        "target_seconds": 780
    }
}


def match_claim_status_benchmark(status_str: str) -> dict:
    """Universal status-to-benchmark mapper matching NovaArc RCM definitions."""
    raw = (status_str or "").strip()
    norm = raw.upper().replace("-", "_").replace("/", "_").replace(" ", "_")

    # Appeals
    if "APPEAL" in norm:
        if any(k in norm for k in ["COMPLEX", "PEER", "CONFERENCE", "CALL"]):
            return {"short_name": "AP - Call / Conference", "target_minutes": 30, "target_seconds": 1800, "status": "COMPLEX APPEAL (PEER-TO-PEER)"}
        return {"short_name": "AP - Review / Written", "target_minutes": 18, "target_seconds": 1080, "status": "STANDARD APPEAL (WRITTEN)"}

    # Status Inquiry / Follow-up (checked BEFORE generic Call/IVR to prevent misclassification)
    if any(k in norm for k in ["STATUS", "INQUIRY", "FOLLOW_UP", "STATUS_INQUIRY"]):
        if any(k in norm for k in ["PORTAL", "REVIEW", "ONLINE", "BATCH"]):
            return {"short_name": "SI - Review / Portal", "target_minutes": 2, "target_seconds": 120, "status": "STATUS INQUIRY (PORTAL)"}
        return {"short_name": "SI - Call / IVR", "target_minutes": 7, "target_seconds": 420, "status": "STATUS INQUIRY (CALL/IVR)"}

    # Denial Management
    if any(k in norm for k in ["DENIAL", "DENIED"]):
        if any(k in norm for k in ["ADMIN", "CODING", "MODIFIER", "NCCI"]):
            return {"short_name": "DM - Admin / Coding", "target_minutes": 8, "target_seconds": 480, "status": "ADMIN / CODING DENIAL"}
        return {"short_name": "DM - Clinical / Auth", "target_minutes": 13, "target_seconds": 780, "status": "CLINICAL / AUTH DENIAL"}

    # Payment Posting & Adjustments
    if any(k in norm for k in ["PAID", "POSTING", "PAYMENT", "ADJUSTMENT", "WRITE_OFF", "CONTRACTUAL"]):
        return {"short_name": "PPA - Review / Posting", "target_minutes": 3, "target_seconds": 180, "status": "PAID / CONTRACTUAL ADJ"}

    # Refunds & Overpayments
    if any(k in norm for k in ["REFUND", "OVERPAYMENT", "DISPUTE"]):
        return {"short_name": "RO - Review / Dispute", "target_minutes": 13, "target_seconds": 780, "status": "REFUND / DISPUTE"}

    # Claim Resubmission
    if any(k in norm for k in ["RESUBMIT", "RESUBMISSION"]):
        if any(k in norm for k in ["PORTAL", "REVIEW", "ELECTRONIC"]):
            return {"short_name": "CR - Review / Portal", "target_minutes": 4, "target_seconds": 240, "status": "RESUBMIT CLAIM (PORTAL)"}
        return {"short_name": "CR - Call / IVR", "target_minutes": 14, "target_seconds": 840, "status": "RESUBMIT CLAIM (CALL/IVR)"}

    # NovaArc Legacy Statuses
    if "IN_PROCESS" in norm:
        return {"short_name": "SI - Call / IVR", "target_minutes": 7, "target_seconds": 420, "status": "IN PROCESS"}
    if "ACKNOWLEDGED" in norm:
        return {"short_name": "SI - Review / Portal", "target_minutes": 2, "target_seconds": 120, "status": "ACKNOWLEDGED"}
    if "SUBMITTED" in norm:
        return {"short_name": "CR - Review / Portal", "target_minutes": 4, "target_seconds": 240, "status": "SUBMITTED"}
    if "CREATED" in norm:
        return {"short_name": "CR - Review / Portal", "target_minutes": 4, "target_seconds": 240, "status": "CREATED"}

    # Generic Fallback
    if any(k in norm for k in ["CALL", "IVR", "TELEPHONE"]):
        return {"short_name": "CR - Call / IVR", "target_minutes": 14, "target_seconds": 840, "status": raw.upper() or "RESUBMIT CLAIM (CALL/IVR)"}
    if any(k in norm for k in ["PORTAL", "WEB", "ONLINE"]):
        return {"short_name": "CR - Review / Portal", "target_minutes": 4, "target_seconds": 240, "status": raw.upper() or "RESUBMIT CLAIM (PORTAL)"}

    return {"short_name": "CR - Review / Portal", "target_minutes": 4, "target_seconds": 240, "status": raw.upper() or "RESUBMIT CLAIM (PORTAL)"}


def normalize_claim_key(k: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", k or "").upper()


def resolve_platform_claim(raw_id: str, catalog: Optional[dict] = None) -> Optional[dict]:
    if not raw_id:
        return None
    if catalog is None:
        catalog = PLATFORM_CLAIMS_CATALOG
    clean = raw_id.strip().upper()
    norm = normalize_claim_key(clean)
    if not norm:
        return None

    # 1. Exact key match
    if clean in catalog:
        res = dict(catalog[clean])
        res["claim_id"] = clean
        res["is_verified"] = True
        return res

    # 2. Flexible normalized match (e.g. CLM-605, CLM605, or 605)
    target_norms = {norm}
    if not norm.startswith("CLM"):
        target_norms.add(f"CLM{norm}")
    else:
        target_norms.add(norm[3:])

    for cid, info in catalog.items():
        cid_norm = normalize_claim_key(cid)
        cid_strip = cid_norm[3:] if cid_norm.startswith("CLM") else cid_norm
        if cid_norm in target_norms or cid_strip in target_norms:
            res = dict(info)
            res["claim_id"] = cid
            res["is_verified"] = True
            return res

    # 3. Dynamic claim recognition candidate - strictly requires NovaArc platform validation
    digits = re.findall(r"\d+", clean)
    canon_id = f"CLM-{digits[0]}" if (digits and not clean.startswith("CLM")) else clean
    res = {
        "claim_id": canon_id,
        "status": "VERIFYING PLATFORM CLAIM...",
        "patient": "Platform Patient",
        "provider": "Dr. Amanda Davis",
        "payer": "Assigned Payer",
        "short_name": "Detecting...",
        "target_minutes": None,
        "target_seconds": None,
        "is_verifying": True,
        "is_verified": False,
        "is_dynamic": True
    }
    return res


DEFAULT_RUNNING_CLAIMS: List[Tuple[str, str, str]] = []


class ClaimDialog:
    """
    System-wide Executive Floating Dialogue Box (Claim Work Assistant).
    Adheres to UI/UX Pro Design System:
    - Obsidian Header with Cobalt Accents & Emerald Pulse Indicator
    - Seamless automated claim type & benchmark AHT detection from platform status
    - Blue "Claims Section" quick launcher with top-right corner minimization & center restore
    - Strict distraction prevention (blocks app switching & unapproved websites)
    - Always-on-Top without focus-stealing loops
    """

    def __init__(
        self,
        on_submit: Optional[Callable[[str, Any], None]] = None,
        on_cancel: Optional[Callable[[], None]] = None,
        on_close_claim: Optional[Callable[[str, str], None]] = None,
        on_status_change: Optional[Callable[[str, str], None]] = None,
        running_claims: Optional[List[Any]] = None,
        associate_id: str = "EMP101",
        api_base_url: str = "https://tms-backend-50047231328.development.catalystappsail.in",
    ):
        self.on_submit = on_submit
        self.on_cancel = on_cancel
        self.on_close_claim = on_close_claim
        self.on_status_change = on_status_change
        self.associate_id = associate_id
        self.api_base_url = api_base_url.rstrip("/")
        # Normalize running claims to mutable list of [cid, desc, status]
        raw_list = running_claims if running_claims is not None else DEFAULT_RUNNING_CLAIMS
        self.running_claims = [[item[0], item[1], item[2]] for item in raw_list]
        self.claim_regex = re.compile(r"\b(?:CLM|CLAIM)[-_]?\d+\b", re.IGNORECASE)
        self.dropdown_visible = False
        self._is_minimized = False
        self.platform_catalog = dict(PLATFORM_CLAIMS_CATALOG)

        # Merge running claims into platform catalog
        for rc in self.running_claims:
            if rc and rc[0] and rc[0] != "UNASSIGNED":
                cid = rc[0].strip().upper()
                if cid not in self.platform_catalog:
                    st = rc[2] if len(rc) > 2 else "RESUBMIT CLAIM (CALL/IVR)"
                    self.platform_catalog[cid] = {
                        "status": st,
                        "patient": rc[1] if len(rc) > 1 else "Shift Claim",
                        "provider": "Assigned Provider",
                        "payer": "Assigned Payer",
                        "short_name": "CR - Call / IVR",
                        "target_minutes": 14,
                        "target_seconds": 840,
                    }

        # Background dynamic sync of employee's live daily claims pool from NovaArc & TMS backend
        def _sync_catalog():
            try:
                # 1. Sync directly from NovaArc RCM Live Backend API
                try:
                    tok_resp = requests.post(
                        "https://novaarc-backend-i4qm.onrender.com/auth/login",
                        json={"email": "client_leadership@novaarc.local", "password": "password123"},
                        timeout=4.0
                    )
                    if tok_resp.status_code == 200:
                        t = tok_resp.json().get("access_token")
                        if t:
                            c_resp = requests.get(
                                "https://novaarc-backend-i4qm.onrender.com/claims",
                                headers={"Authorization": f"Bearer {t}"},
                                timeout=5.0
                            )
                            if c_resp.status_code == 200:
                                live_items = c_resp.json()
                                if isinstance(live_items, list):
                                    for item in live_items:
                                        raw_c = str(item.get("claim_id") or item.get("id")).strip().upper()
                                        clean_c = f"CLM-{raw_c}" if not raw_c.startswith("CLM") else raw_c
                                        raw_st = item.get("status") or "created"
                                        bm = match_claim_status_benchmark(raw_st)
                                        p_obj = item.get("patient") or {}
                                        mrn_val = p_obj.get("mrn") if isinstance(p_obj, dict) else (item.get("patient_mrn") or "MRN-PATIENT")
                                        prov_obj = item.get("provider") or {}
                                        prov_name = prov_obj.get("name") if isinstance(prov_obj, dict) else str(prov_obj or "Dr. Amanda Davis")
                                        self.platform_catalog[clean_c] = {
                                            "status": bm.get("status", raw_st.upper()),
                                            "patient": mrn_val,
                                            "provider": prov_name,
                                            "payer": f"Payer {item.get('payer_id')}" if item.get("payer_id") else "Assigned Payer",
                                            "short_name": bm.get("short_name", "CR - Call / IVR"),
                                            "target_minutes": bm.get("target_minutes", 14),
                                            "target_seconds": bm.get("target_seconds", 840),
                                        }
                except Exception:
                    pass

                # 2. Sync from TMS Backend APIs
                endpoints = [
                    f"{self.api_base_url}/api/associate/{self.associate_id}/claims-pool",
                    f"{self.api_base_url}/api/associate/platform-claims"
                ]
                for ep in endpoints:
                    try:
                        r = requests.get(ep, timeout=2.5)
                        if r.status_code == 200:
                            items = r.json()
                            if items and isinstance(items, list):
                                for it in items:
                                    c_id = it.get("claim_id")
                                    if c_id:
                                        clean_cid = str(c_id).strip().upper()
                                        st_val = it.get("status", "RESUBMIT CLAIM (CALL/IVR)")
                                        bm = match_claim_status_benchmark(st_val)
                                        self.platform_catalog[clean_cid] = {
                                            "status": bm.get("status", st_val),
                                            "patient": it.get("patient", "MRN"),
                                            "provider": it.get("provider", "Provider"),
                                            "payer": it.get("payer", "Payer"),
                                            "short_name": it.get("claim_type") or bm.get("short_name", "CR - Call / IVR"),
                                            "target_minutes": it.get("target_minutes") or bm.get("target_minutes", 14),
                                            "target_seconds": it.get("target_seconds") or bm.get("target_seconds", 840),
                                        }
                                break
                    except Exception:
                        continue
            except Exception:
                pass

        threading.Thread(target=_sync_catalog, daemon=True).start()

        # Windows OS hook, taskbar, and modal state handles
        self._kbd_hook = None
        self._mouse_hook = None
        self._hook_procs = []
        self._taskbar_hwnd = None
        self._sec_taskbar_hwnd = None
        self._is_closing = False
        self._top_hwnd = 0

    def show(
        self,
        current_claim: Optional[str] = None,
        platform_name: str = "NovaArc RCM",
        target_hwnd: int = 0,
        lastly_worked_claim: Optional[str] = None,
    ):
        root = tk.Tk()
        root.withdraw()
        root.title(f"Claim Work Assistant - {platform_name}")

        # Dimension specifications (perfectly balanced compact desktop assistant)
        base_w = 680
        h_collapsed = 420
        h_expanded = 660

        screen_w = root.winfo_screenwidth()
        screen_h = root.winfo_screenheight()
        pos_x = max(0, (screen_w - base_w) // 2)
        pos_y = max(0, (screen_h - h_collapsed) // 2)

        # Auto-resolve target_hwnd if empty or invalid
        try:
            import ctypes
            from ctypes import wintypes
            u32 = ctypes.windll.user32
            if not target_hwnd or not u32.IsWindow(target_hwnd):
                def _find_novaarc_target(h, _):
                    nonlocal target_hwnd
                    if u32.IsWindowVisible(h):
                        len_t = u32.GetWindowTextLengthW(h)
                        if len_t > 0:
                            buf = ctypes.create_unicode_buffer(len_t + 1)
                            u32.GetWindowTextW(h, buf, len_t + 1)
                            t = buf.value.lower()
                            if any(k in t for k in ["novaarc", "rcm", "revenue cycle", "krishna-caare", "novarc"]):
                                target_hwnd = h
                                return False
                    return True
                WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.wintypes.BOOL, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM)
                u32.EnumWindows(WNDENUMPROC(_find_novaarc_target), 0)
        except Exception:
            pass

        # Dynamic positioning and sizing according to target application window
        if target_hwnd:
            try:
                import ctypes
                from ctypes import wintypes
                u32 = ctypes.windll.user32

                class RECT(ctypes.Structure):
                    _fields_ = [
                        ("left", wintypes.LONG),
                        ("top", wintypes.LONG),
                        ("right", wintypes.LONG),
                        ("bottom", wintypes.LONG),
                    ]

                if u32.IsWindow(target_hwnd):
                    # If target application is minimized (iconic), restore it so the associate sees the platform
                    if u32.IsIconic(target_hwnd):
                        u32.ShowWindow(target_hwnd, 9)  # SW_RESTORE
                        u32.SetForegroundWindow(target_hwnd)

                    rect = RECT()
                    if u32.GetWindowRect(target_hwnd, ctypes.byref(rect)):
                        app_w = rect.right - rect.left
                        app_h = rect.bottom - rect.top

                        if app_w > 150 and app_h > 150:
                            # Fit dialog width comfortably inside target application
                            if app_w < 660:
                                base_w = max(450, app_w - 24)
                            else:
                                base_w = 660

                            # Center dialog precisely over target application window
                            pos_x = rect.left + max(0, (app_w - base_w) // 2)
                            pos_y = rect.top + max(20, (app_h - h_collapsed) // 2)
            except Exception as e:
                print(f"[Dialog] Application geometry fit notice: {e}")

        # Keep safely within visible screen boundaries
        pos_x = max(10, min(pos_x, screen_w - base_w - 10))
        pos_y = max(10, min(pos_y, screen_h - h_collapsed - 40))

        root.geometry(f"{base_w}x{h_collapsed}+{pos_x}+{pos_y}")
        root.resizable(False, False)

        # Enforce System-wide Always-On-Top cleanly without fighting Windows DWM / Win+Tab
        root.attributes("-topmost", True)
        root.lift()

        # Win32 HWND_TOPMOST reinforcement once on launch (no blinking loop)
        top_hwnd = 0
        try:
            import ctypes
            u32 = ctypes.windll.user32
            root.update_idletasks()
            hwnd = root.winfo_id()
            top_hwnd = u32.GetAncestor(hwnd, 2) or hwnd  # GA_ROOT
            self._top_hwnd = top_hwnd
            u32.SetWindowPos(top_hwnd, -1, 0, 0, 0, 0, 0x0001 | 0x0002)  # HWND_TOPMOST | SWP_NOSIZE | SWP_NOMOVE
            u32.SetForegroundWindow(top_hwnd)
        except Exception:
            pass

        self._is_closing = False

        # Clean non-intrusive floating mode (zero OS hooks, zero taskbar manipulation)
        self._kbd_hook = None
        self._mouse_hook = None
        self._hook_procs = []

        # Set initial focus smoothly to the entry field
        def set_initial_focus():
            if self._is_closing:
                return
            try:
                entry_field.focus_force()
                if initial_val:
                    entry_field.select_range(0, tk.END)
                    entry_field.icursor(tk.END)
            except Exception:
                pass
        root.after(100, set_initial_focus)

        # --- Determine Lastly Worked Claim/Denial ---
        last_worked_val = (lastly_worked_claim or "").strip().upper()
        if not last_worked_val or "NONE" in last_worked_val or last_worked_val == "UNASSIGNED":
            try:
                from claim_context import ClaimContextManager
                mgr = ClaimContextManager()
                last_worked_val = mgr.get_last_worked_claim_id(exclude_claim_id=current_claim)
            except Exception:
                pass

        if not last_worked_val or "NONE" in last_worked_val or last_worked_val == "UNASSIGNED":
            for rc in self.running_claims:
                if len(rc) > 0 and rc[0]:
                    cid = str(rc[0]).strip().upper()
                    if cid and cid != "UNASSIGNED" and (not current_claim or cid != current_claim.strip().upper()):
                        last_worked_val = cid
                        break

        if not last_worked_val or "NONE" in last_worked_val or last_worked_val == "UNASSIGNED":
            # Quick in-memory cache check from running_claims (zero blocking latency)
            for rc in getattr(self, "running_claims", []):
                if len(rc) > 0 and rc[0]:
                    cid = str(rc[0]).strip().upper()
                    if cid and cid != "UNASSIGNED" and (not current_claim or cid != current_claim.strip().upper()):
                        last_worked_val = cid
                        break

        if not last_worked_val or "NONE" in last_worked_val or last_worked_val == "UNASSIGNED":
            # Deep discovery from database or CSV
            try:
                db_path = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tms.db"))
                if os.path.exists(db_path):
                    con = sqlite3.connect(db_path)
                    cur = con.cursor()
                    cur.execute(
                        "SELECT claim_id FROM events WHERE claim_id IS NOT NULL AND claim_id != 'UNASSIGNED' ORDER BY id DESC LIMIT 1"
                    )
                    row = cur.fetchone()
                    con.close()
                    if row and row[0]:
                        last_worked_val = str(row[0]).strip().upper()
            except Exception:
                pass

        if not last_worked_val or "NONE" in last_worked_val:
            last_worked_val = "None (Shift Start)"

        # --- Top Banner: Lastly worked claim/denial (prominent, bold, large) ---
        last_worked_bar = tk.Frame(root, bg="#0f172a", padx=16, pady=8)
        last_worked_bar.pack(fill="x", side="top")

        lbl_prefix = tk.Label(
            last_worked_bar,
            text="lastly worked claim/denial: ",
            font=("Segoe UI", 9, "bold"),
            fg="#94a3b8",
            bg="#0f172a"
        )
        lbl_prefix.pack(side="left")

        lbl_claim = tk.Label(
            last_worked_bar,
            text=last_worked_val,
            font=("Consolas", 15, "bold"),
            fg="#4ade80",
            bg="#0f172a"
        )
        lbl_claim.pack(side="left", padx=(4, 0))

        # --- Top-Right Minimized Floating Chip Widget ---
        mini_frame = tk.Frame(root, bg="#064e3b", bd=2, relief="solid", highlightthickness=1, highlightbackground="#059669", cursor="hand2")

        mini_inner = tk.Frame(mini_frame, bg="#064e3b", cursor="hand2")
        mini_inner.pack(fill="both", expand=True, padx=12, pady=6)

        mini_icon = tk.Label(
            mini_inner,
            text="TMS",
            font=("Segoe UI", 8, "bold"),
            fg="#ffffff",
            bg="#059669",
            padx=6,
            pady=2,
            cursor="hand2"
        )
        mini_icon.pack(side="left", padx=(0, 8))

        mini_text_box = tk.Frame(mini_inner, bg="#064e3b", cursor="hand2")
        mini_text_box.pack(side="left", fill="both", expand=True)

        mini_title = tk.Label(
            mini_text_box,
            text="Claim Work Assistant",
            font=("Segoe UI", 9, "bold"),
            fg="#ffffff",
            bg="#064e3b",
            cursor="hand2"
        )
        mini_title.pack(anchor="w")

        mini_sub = tk.Label(
            mini_text_box,
            text="Click to return & enter claim",
            font=("Segoe UI", 8),
            fg="#a7f3d0",
            bg="#064e3b",
            cursor="hand2"
        )
        mini_sub.pack(anchor="w")

        mini_dot = tk.Label(
            mini_inner,
            text="ACTIVE",
            font=("Segoe UI", 7, "bold"),
            fg="#22c55e",
            bg="#111827",
            padx=5,
            pady=2,
            cursor="hand2"
        )
        mini_dot.pack(side="right")

        def open_claims_section_and_minimize():
            # 1. Locate the active NovaArc RCM browser window
            browser_hwnd = target_hwnd
            if not browser_hwnd or not u32.IsWindow(browser_hwnd):
                def _find_novaarc_cb(h, _):
                    nonlocal browser_hwnd
                    if u32.IsWindowVisible(h):
                        len_t = u32.GetWindowTextLengthW(h)
                        if len_t > 0:
                            buf = ctypes.create_unicode_buffer(len_t + 1)
                            u32.GetWindowTextW(h, buf, len_t + 1)
                            t = buf.value.lower()
                            if any(k in t for k in ["novaarc", "rcm", "revenue cycle", "krishna-caare"]):
                                browser_hwnd = h
                                return False
                    return True
                WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.wintypes.BOOL, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM)
                try:
                    u32.EnumWindows(WNDENUMPROC(_find_novaarc_cb), 0)
                except Exception:
                    pass

            navigated = False
            if browser_hwnd and u32.IsWindow(browser_hwnd):
                # Restore window if minimized and bring to foreground in-place
                if u32.IsIconic(browser_hwnd):
                    u32.ShowWindow(browser_hwnd, 9)  # SW_RESTORE
                u32.SetForegroundWindow(browser_hwnd)

                # Try in-place UIAutomation navigation (Invoke the 'Claims' link in the left sidebar)
                try:
                    import comtypes
                    from comtypes import client
                    ctypes.windll.ole32.CoInitialize(None)
                    mod = client.GetModule("UIAutomationCore.dll")
                    uia = client.CreateObject(mod.CUIAutomation, interface=mod.IUIAutomation)
                    elem = uia.ElementFromHandle(browser_hwnd)
                    if elem:
                        cond_name = uia.CreatePropertyCondition(30005, "Claims")  # UIA_NamePropertyId
                        claims_elem = elem.FindFirst(4, cond_name)  # TreeScope_Descendants
                        if claims_elem:
                            try:
                                pat_inv = claims_elem.GetCurrentPattern(10000)  # InvokePattern
                                if pat_inv:
                                    inv = pat_inv.QueryInterface(mod.IUIAutomationInvokePattern)
                                    inv.Invoke()
                                    navigated = True
                            except Exception:
                                pass

                        # Fallback: Set address bar URL in-place without opening a new tab
                        if not navigated:
                            cond_edit = uia.CreatePropertyCondition(30011, "address-edit-box")
                            edit_elem = elem.FindFirst(4, cond_edit)
                            if not edit_elem:
                                cond_type = uia.CreatePropertyCondition(30003, 50004)
                                edit_elem = elem.FindFirst(4, cond_type)
                            if edit_elem:
                                try:
                                    pat_val = edit_elem.GetCurrentPattern(10002)  # ValuePattern
                                    if pat_val:
                                        val_p = pat_val.QueryInterface(mod.IUIAutomationValuePattern)
                                        val_p.SetValue("https://krishna-caare.github.io/novaarc-rcm/#/claims")
                                        import time
                                        time.sleep(0.04)
                                        u32.PostMessageW(browser_hwnd, 0x0100, 0x0D, 0)  # WM_KEYDOWN VK_RETURN
                                        u32.PostMessageW(browser_hwnd, 0x0101, 0x0D, 0)  # WM_KEYUP VK_RETURN
                                        navigated = True
                                except Exception:
                                    pass
                except Exception as e:
                    print(f"[Dialog] In-place navigation notice: {e}")

            # Only fallback to external open if NO browser window was open at all
            if not navigated and not browser_hwnd:
                try:
                    import webbrowser
                    webbrowser.open("https://krishna-caare.github.io/novaarc-rcm/#/claims")
                except Exception:
                    pass

            self._is_minimized = True

            last_worked_bar.pack_forget()
            top_accent.pack_forget()
            header_frame.pack_forget()
            body_frame.pack_forget()

            mini_frame.pack(fill="both", expand=True)
            mini_w = 320
            mini_h = 50
            scr_w = root.winfo_screenwidth()
            root.geometry(f"{mini_w}x{mini_h}+{scr_w - mini_w - 20}+20")
            root.attributes("-topmost", True)
            root.lift()

        def restore_to_center(event=None):
            if not self._is_minimized:
                return
            self._is_minimized = False
            mini_frame.pack_forget()

            # ALWAYS recalculate the exact center of the screen dynamically
            scr_w = root.winfo_screenwidth()
            scr_h = root.winfo_screenheight()
            center_x = max(0, (scr_w - base_w) // 2)
            center_y = max(0, (scr_h - h_collapsed) // 2)

            root.geometry(f"{base_w}x{h_collapsed}+{center_x}+{center_y}")

            last_worked_bar.pack(fill="x", side="top")
            top_accent.pack(fill="x", side="top")
            header_frame.pack(fill="x", side="top")
            body_frame.pack(fill="both", expand=True)

            root.attributes("-topmost", True)
            root.lift()
            root.after(80, lambda: entry_field.focus_force())

            # Automatically sync latest claims created or edited while in NovaArc platform
            def _async_sync_on_restore():
                try:
                    all_live = fetch_all_claims_live()
                    for it in all_live:
                        rc = str(it.get("claim_id") or it.get("id") or "").strip().upper()
                        if not rc:
                            continue
                        cc = f"CLM-{rc}" if not rc.startswith("CLM") else rc
                        raw_st = it.get("status") or "created"
                        disp_st = format_platform_status_display(raw_st)
                        bm = match_claim_status_benchmark(raw_st)
                        p_obj = it.get("patient") or {}
                        mrn_val = p_obj.get("mrn") if isinstance(p_obj, dict) else (it.get("patient_mrn") or "MRN-PATIENT")
                        prov_obj = it.get("provider") or {}
                        prov_name = prov_obj.get("name") if isinstance(prov_obj, dict) else str(prov_obj or "Dr. Amanda Davis")
                        rec = {
                            "claim_id": cc,
                            "status": disp_st,
                            "patient": mrn_val,
                            "provider": prov_name,
                            "payer": f"Payer {it.get('payer_id')}" if it.get("payer_id") else "Assigned Payer",
                            "short_name": bm.get("short_name", "CR - Review / Portal"),
                            "target_minutes": bm.get("target_minutes", 4),
                            "target_seconds": bm.get("target_seconds", 240),
                            "is_verifying": False,
                            "is_dynamic": False
                        }
                        self.platform_catalog[cc] = rec
                        PLATFORM_CLAIMS_CATALOG[cc] = rec
                    # Re-validate current entry text if any
                    root.after(0, _on_entry_changed)
                except Exception:
                    pass
            threading.Thread(target=_async_sync_on_restore, daemon=True).start()

        # Drag & click handling for mini chip widget
        mini_drag = {"x": 0, "y": 0, "has_dragged": False}

        def on_mini_press(e):
            mini_drag["x"] = e.x
            mini_drag["y"] = e.y
            mini_drag["has_dragged"] = False

        def on_mini_motion(e):
            dx = e.x - mini_drag["x"]
            dy = e.y - mini_drag["y"]
            if abs(dx) > 3 or abs(dy) > 3:
                mini_drag["has_dragged"] = True
                cur_x = root.winfo_x()
                cur_y = root.winfo_y()
                root.geometry(f"+{cur_x + dx}+{cur_y + dy}")

        def on_mini_release(e):
            if not mini_drag["has_dragged"]:
                restore_to_center()

        for w in (mini_frame, mini_inner, mini_icon, mini_text_box, mini_title, mini_sub, mini_dot):
            w.bind("<ButtonPress-1>", on_mini_press)
            w.bind("<B1-Motion>", on_mini_motion)
            w.bind("<ButtonRelease-1>", on_mini_release)

        # --- Top Decorative Accent Line (Light Green) ---
        top_accent = tk.Frame(root, bg="#22c55e", height=3)
        top_accent.pack(fill="x", side="top")

        # --- Executive Header Bar (Natural sizing, clearly visible) ---
        header_frame = tk.Frame(root, bg="#090d16", padx=16, pady=10)
        header_frame.pack(fill="x", side="top")

        # Left Icon Badge (Light Green)
        icon_box = tk.Frame(header_frame, bg="#16a34a", width=30, height=30)
        icon_box.pack(side="left", padx=(0, 12))
        icon_box.pack_propagate(False)
        icon_lbl = tk.Label(
            icon_box,
            text="TMS",
            font=("Segoe UI", 8, "bold"),
            fg="#ffffff",
            bg="#16a34a"
        )
        icon_lbl.pack(expand=True)

        # Title & Subtitle Container
        title_box = tk.Frame(header_frame, bg="#090d16")
        title_box.pack(side="left")

        title_lbl = tk.Label(
            title_box,
            text="Claim Work Assistant",
            font=("Segoe UI", 12, "bold"),
            fg="#f8fafc",
            bg="#090d16"
        )
        title_lbl.pack(anchor="w")

        subtitle_lbl = tk.Label(
            title_box,
            text="Active session claim tracking",
            font=("Segoe UI", 9),
            fg="#86efac",
            bg="#090d16"
        )
        subtitle_lbl.pack(anchor="w")

        # Right Platform Badge
        clean_platform = "NovaArc RCM" if ("NovaArc" in platform_name or not platform_name) else platform_name
        if len(clean_platform) > 22:
            clean_platform = clean_platform[:19] + "..."

        right_badge_frame = tk.Frame(header_frame, bg="#1e293b", padx=10, pady=4, relief="solid", bd=1, highlightthickness=0)
        right_badge_frame.pack(side="right")

        pulse_dot = tk.Label(
            right_badge_frame,
            text="*",
            font=("Segoe UI", 9, "bold"),
            fg="#22c55e",
            bg="#1e293b"
        )
        pulse_dot.pack(side="left", padx=(0, 5))

        platform_badge = tk.Label(
            right_badge_frame,
            text=clean_platform,
            font=("Segoe UI", 8, "bold"),
            fg="#86efac",
            bg="#1e293b"
        )
        platform_badge.pack(side="left")

        # Prominent Action Button: Claims Section (Modern Emerald Accent)
        claims_section_btn = tk.Button(
            header_frame,
            text="Claims Section",
            font=("Segoe UI", 9, "bold"),
            fg="#ffffff",
            bg="#059669",
            activeforeground="#ffffff",
            activebackground="#047857",
            relief="flat",
            bd=0,
            padx=16,
            pady=6,
            cursor="hand2",
            command=open_claims_section_and_minimize
        )
        claims_section_btn.pack(side="right", padx=(0, 10))

        # --- Main Body Container ---
        body_frame = tk.Frame(root, bg="#ffffff", padx=22, pady=14)
        body_frame.pack(fill="both", expand=True)

        # Info Prompt Box
        prompt_box = tk.Frame(body_frame, bg="#ecfdf5", padx=14, pady=10, highlightthickness=1, highlightbackground="#a7f3d0")
        prompt_box.pack(fill="x", pady=(0, 12))

        prompt_title = tk.Label(
            prompt_box,
            text="Select or enter the claim you are working on",
            font=("Segoe UI", 9, "bold"),
            fg="#064e3b",
            bg="#ecfdf5",
            anchor="w"
        )
        prompt_title.pack(fill="x")

        prompt_sub = tk.Label(
            prompt_box,
            text="Claim type & target AHT will be automatically detected from your NovaArc platform status.",
            font=("Segoe UI", 8),
            fg="#047857",
            bg="#ecfdf5",
            anchor="w"
        )
        prompt_sub.pack(fill="x", pady=(2, 0))

        # Fields Container: Claim ID (Full width, Claim Type button removed)
        fields_container = tk.Frame(body_frame, bg="#ffffff")
        fields_container.pack(fill="x", pady=(0, 4))

        dd_label = tk.Label(
            fields_container,
            text="Claim ID",
            font=("Segoe UI", 9, "bold"),
            fg="#1e293b",
            bg="#ffffff"
        )
        dd_label.pack(anchor="w", pady=(0, 4))

        # Initial Claim value
        initial_val = current_claim if current_claim and current_claim != "UNASSIGNED" else ""
        entry_var = tk.StringVar(value=initial_val)

        # Input Row Frame (Full width)
        input_container = tk.Frame(fields_container, bg="#ffffff", highlightthickness=2, highlightbackground="#a7f3d0", highlightcolor="#059669")
        input_container.pack(fill="x")

        entry_field = tk.Entry(
            input_container,
            textvariable=entry_var,
            font=("Consolas", 12, "bold"),
            bg="#ffffff",
            fg="#022c22",
            relief="flat",
            bd=0
        )
        entry_field.pack(side="left", fill="x", expand=True, padx=(10, 4), ipady=6)

        # Dropdown Toggle Button (Select From List)
        toggle_btn = tk.Button(
            input_container,
            text="Select From List",
            font=("Segoe UI", 8, "bold"),
            bg="#ecfdf5",
            fg="#047857",
            activebackground="#d1fae5",
            activeforeground="#064e3b",
            relief="flat",
            bd=0,
            padx=14,
            pady=5,
            cursor="hand2"
        )
        toggle_btn.pack(side="right", padx=(2, 4), pady=3)

        # In-Dialog Status & Validation Feedback Box
        validation_box = tk.Frame(body_frame, bg="#f8fafc", padx=12, pady=8, highlightthickness=1, highlightbackground="#e2e8f0")
        validation_box.pack(fill="x", pady=(6, 8))

        val_icon = tk.Label(
            validation_box,
            text="READY",
            font=("Segoe UI", 7, "bold"),
            fg="#064e3b",
            bg="#d1fae5",
            padx=6,
            pady=3
        )
        val_icon.pack(side="left", padx=(0, 8))

        val_lbl = tk.Label(
            validation_box,
            text="Type your assigned Claim ID (e.g. CLM-605) or click 'Claims Section' to view in NovaArc RCM.",
            font=("Segoe UI", 9),
            fg="#64748b",
            bg="#f8fafc",
            anchor="w"
        )
        val_lbl.pack(side="left", fill="x", expand=True)

        detected_claim_holder = {"val": None}
        _last_sync_target = {"cid": None, "ts": 0.0}

        def _apply_live_ui(cid, st_disp, ct_disp, tgt_m_val):
            curr_val = entry_var.get().strip().upper()
            if self._is_closing or (curr_val != cid and normalize_claim_key(curr_val) != normalize_claim_key(cid)):
                return
            rec = self.platform_catalog.get(cid) or self.platform_catalog.get(f"CLM-{cid}") or self.platform_catalog.get(cid.replace("CLM-", ""))
            detected_claim_holder["val"] = rec
            validation_box.configure(bg="#f0fdf4", highlightbackground="#86efac")
            val_icon.configure(text="VERIFIED", font=("Segoe UI", 7, "bold"), fg="#15803d", bg="#dcfce7")
            val_lbl.configure(
                text=f"Platform Status: {st_disp}  |  {ct_disp} (Target: {tgt_m_val}m)",
                fg="#15803d",
                bg="#f0fdf4"
            )
            input_container.configure(highlightbackground="#16a34a", highlightcolor="#16a34a")

        def _apply_invalid_ui(cid):
            curr_val = entry_var.get().strip().upper()
            if self._is_closing or (curr_val != cid and normalize_claim_key(curr_val) != normalize_claim_key(cid)):
                return
            detected_claim_holder["val"] = None
            validation_box.configure(bg="#fef2f2", highlightbackground="#fca5a5")
            val_icon.configure(text="WARNING", font=("Segoe UI", 7, "bold"), fg="#b91c1c", bg="#fee2e2")
            val_lbl.configure(
                text=f"Warning: Claim '{curr_val or cid}' is not found in NovaArc claims section. Please select a valid claim.",
                fg="#b91c1c",
                bg="#fef2f2"
            )
            input_container.configure(highlightbackground="#ef4444", highlightcolor="#ef4444")

        def _trigger_live_sync(raw_id: str):
            clean_id = raw_id.strip().upper()
            now = time.time()
            if _last_sync_target.get("cid") == clean_id and (now - _last_sync_target.get("ts", 0)) < 1.0:
                return
            _last_sync_target["cid"] = clean_id
            _last_sync_target["ts"] = now

            def _worker():
                # 1. Direct query to NovaArc live API (<200ms with cached token)
                try:
                    s_info = fetch_single_claim_live(clean_id)
                    if s_info:
                        rc = str(s_info.get("claim_id") or s_info.get("id") or "").strip().upper()
                        cc = f"CLM-{rc}" if not rc.startswith("CLM") else rc
                        raw_st = s_info.get("status") or "created"
                        disp_st = format_platform_status_display(raw_st)
                        bm = match_claim_status_benchmark(raw_st)
                        ct_disp = bm.get("short_name", "CR - Review / Portal")
                        tgt_m_val = bm.get("target_minutes", 4)
                        tgt_s_val = bm.get("target_seconds", 240)
                        pat_info = s_info.get("patient") or {}
                        mrn = pat_info.get("mrn") if isinstance(pat_info, dict) else (s_info.get("patient_mrn") or "MRN-PATIENT")
                        payer = s_info.get("payer") or (f"Payer ID {s_info.get('payer_id')}" if s_info.get("payer_id") else "Assigned Payer")

                        rec = {
                            "claim_id": cc,
                            "status": disp_st,
                            "patient": mrn,
                            "provider": str(s_info.get("provider") or "Dr. Amanda Davis"),
                            "payer": payer if isinstance(payer, str) else "Assigned Payer",
                            "short_name": ct_disp,
                            "target_minutes": tgt_m_val,
                            "target_seconds": tgt_s_val,
                            "is_verifying": False,
                            "is_verified": True,
                            "is_dynamic": False
                        }
                        self.platform_catalog[cc] = rec
                        self.platform_catalog[clean_id] = rec
                        PLATFORM_CLAIMS_CATALOG[cc] = rec
                        PLATFORM_CLAIMS_CATALOG[clean_id] = rec
                        root.after(0, lambda: _apply_live_ui(clean_id, disp_st, ct_disp, tgt_m_val))
                        return
                except Exception as e:
                    print(f"[Dialog live sync] Direct fetch notice: {e}")

                # 2. Check TMS backend claims pool
                try:
                    r = requests.get(
                        f"{self.api_base_url}/api/associate/{self.associate_id}/claims-pool",
                        timeout=2.0
                    )
                    if r.status_code == 200:
                        items = r.json()
                        for it in items:
                            cid = str(it.get("claim_id") or "").strip().upper()
                            if cid == clean_id or normalize_claim_key(cid) == normalize_claim_key(clean_id):
                                raw_st = it.get("status", "RESUBMIT CLAIM (PORTAL)")
                                disp_st = format_platform_status_display(raw_st)
                                bm = match_claim_status_benchmark(raw_st)
                                ct_disp = it.get("claim_type") or bm.get("short_name", "CR - Review / Portal")
                                tgt_m_val = it.get("target_minutes") or bm.get("target_minutes", 4)
                                tgt_s_val = it.get("target_seconds") or bm.get("target_seconds", 240)
                                rec = {
                                    "claim_id": cid,
                                    "status": disp_st,
                                    "patient": it.get("patient", "MRN-PATIENT"),
                                    "provider": it.get("provider", "Dr. Amanda Davis"),
                                    "payer": it.get("payer", "Assigned Payer"),
                                    "short_name": ct_disp,
                                    "target_minutes": tgt_m_val,
                                    "target_seconds": tgt_s_val,
                                    "is_verifying": False,
                                    "is_verified": True,
                                    "is_dynamic": False
                                }
                                self.platform_catalog[cid] = rec
                                self.platform_catalog[clean_id] = rec
                                root.after(0, lambda: _apply_live_ui(clean_id, disp_st, ct_disp, tgt_m_val))
                                return
                except Exception:
                    pass

                # 3. Not found in NovaArc claims section! Show inline warning in dialog box
                root.after(0, lambda: _apply_invalid_ui(clean_id))

            threading.Thread(target=_worker, daemon=True).start()

        _debounce_timer = [None]

        def _do_entry_changed():
            raw_val = entry_var.get().strip().upper()
            if not raw_val:
                validation_box.configure(bg="#f8fafc", highlightbackground="#e2e8f0")
                val_icon.configure(text="READY", font=("Segoe UI", 7, "bold"), fg="#2563eb", bg="#dbeafe")
                val_lbl.configure(
                    text="Type your assigned Claim ID (e.g. CLM-605) or click 'Claims Section' to view in NovaArc RCM.",
                    fg="#64748b",
                    bg="#f8fafc"
                )
                detected_claim_holder["val"] = None
                input_container.configure(highlightbackground="#cbd5e1", highlightcolor="#16a34a")
                if self.dropdown_visible:
                    populate_dropdown_list("")
                return

            # Check if this claim is already active and currently tracked
            if current_claim and (raw_val == current_claim.strip().upper() or normalize_claim_key(raw_val) == normalize_claim_key(current_claim)):
                validation_box.configure(bg="#f0fdf4", highlightbackground="#86efac")
                val_icon.configure(text="ACTIVE", font=("Segoe UI", 7, "bold"), fg="#15803d", bg="#dcfce7")
                val_lbl.configure(
                    text=f"Claim '{raw_val}' is already active and currently being tracked.",
                    fg="#15803d",
                    bg="#f0fdf4"
                )
                input_container.configure(highlightbackground="#16a34a", highlightcolor="#16a34a")
                claim_match = resolve_platform_claim(raw_val, self.platform_catalog)
                if claim_match:
                    detected_claim_holder["val"] = claim_match
                if self.dropdown_visible:
                    populate_dropdown_list(raw_val)
                return

            claim_match = resolve_platform_claim(raw_val, self.platform_catalog)
            if claim_match:
                detected_claim_holder["val"] = claim_match
                st_name = claim_match.get("status", "VERIFYING PLATFORM CLAIM...")
                ct_name = claim_match.get("short_name", "Detecting...")
                tgt_m = claim_match.get("target_minutes")
                is_verifying = claim_match.get("is_verifying", False) or (tgt_m is None) or not claim_match.get("is_verified", False)

                if is_verifying:
                    validation_box.configure(bg="#f0f9ff", highlightbackground="#bae6fd")
                    val_icon.configure(text="VERIFYING", font=("Segoe UI", 7, "bold"), fg="#0284c7", bg="#e0f2fe")
                    val_lbl.configure(
                        text=f"Platform Claim: {claim_match.get('claim_id')}  |  Validating live against NovaArc claims section...",
                        fg="#0369a1",
                        bg="#f0f9ff"
                    )
                    input_container.configure(highlightbackground="#0284c7", highlightcolor="#0284c7")
                else:
                    validation_box.configure(bg="#f0fdf4", highlightbackground="#86efac")
                    val_icon.configure(text="VERIFIED", font=("Segoe UI", 7, "bold"), fg="#15803d", bg="#dcfce7")
                    val_lbl.configure(
                        text=f"Platform Status: {st_name}  |  {ct_name} (Target: {tgt_m}m)",
                        fg="#15803d",
                        bg="#f0fdf4"
                    )
                    input_container.configure(highlightbackground="#16a34a", highlightcolor="#16a34a")

                _trigger_live_sync(raw_val)
            else:
                if len(raw_val) >= 3:
                    validation_box.configure(bg="#f0f9ff", highlightbackground="#bae6fd")
                    val_icon.configure(text="VERIFYING", font=("Segoe UI", 7, "bold"), fg="#0284c7", bg="#e0f2fe")
                    val_lbl.configure(
                        text=f"Checking '{raw_val}' against NovaArc claims section...",
                        fg="#0369a1",
                        bg="#f0f9ff"
                    )
                    input_container.configure(highlightbackground="#0284c7", highlightcolor="#0284c7")
                    _trigger_live_sync(raw_val)
                else:
                    detected_claim_holder["val"] = None
                    validation_box.configure(bg="#f8fafc", highlightbackground="#e2e8f0")
                    val_icon.configure(text="READY", font=("Segoe UI", 7, "bold"), fg="#2563eb", bg="#dbeafe")
                    val_lbl.configure(
                        text="Type full Claim ID (e.g. CLM-605)...",
                        fg="#64748b",
                        bg="#f8fafc"
                    )
                    input_container.configure(highlightbackground="#cbd5e1", highlightcolor="#16a34a")

            if self.dropdown_visible:
                populate_dropdown_list(raw_val)

        def _on_entry_changed(*args):
            if _debounce_timer[0] is not None:
                try:
                    root.after_cancel(_debounce_timer[0])
                except Exception:
                    pass
            _debounce_timer[0] = root.after(300, _do_entry_changed)

        entry_var.trace_add("write", _on_entry_changed)

        # Trigger initial detection if initial_val was set
        if initial_val:
            root.after(50, _on_entry_changed)

        # Notification / Toast banner for completed claims
        toast_frame = tk.Frame(body_frame, bg="#ecfdf5", padx=8, pady=4, highlightthickness=1, highlightbackground="#10b981")
        toast_lbl = tk.Label(
            toast_frame,
            text="",
            font=("Segoe UI", 7, "bold"),
            fg="#065f46",
            bg="#ecfdf5"
        )
        toast_lbl.pack(side="left")

        def show_toast(msg: str):
            toast_lbl.configure(text=f"[OK] {msg}")
            toast_frame.pack(fill="x", pady=(0, 6), before=input_container)
            root.after(3500, lambda: toast_frame.pack_forget())

        # --- Dropdown Menu Panel (In-Window for 100% Stability & Zero-Glitch) ---
        dropdown_frame = tk.Frame(body_frame, bg="#ffffff", bd=1, relief="solid", highlightthickness=1, highlightbackground="#94a3b8")

        canvas = tk.Canvas(dropdown_frame, bg="#f8fafc", highlightthickness=0, height=170)
        scrollbar = tk.Scrollbar(dropdown_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg="#f8fafc")

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        claims_canvas_window = canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        def _on_claims_canvas_resize(e):
            canvas.itemconfig(claims_canvas_window, width=e.width)
        canvas.bind("<Configure>", _on_claims_canvas_resize)
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        def _scroll_canvas(target_canvas, delta):
            if not delta or not target_canvas.winfo_exists():
                return
            if abs(delta) >= 120:
                steps = int(-1 * (delta / 120) * 2)
            elif delta > 0:
                steps = -1
            else:
                steps = 1
            try:
                target_canvas.yview_scroll(steps, "units")
            except Exception:
                pass

        def _on_claims_mousewheel(event):
            _scroll_canvas(canvas, getattr(event, "delta", 0))

        canvas.bind("<MouseWheel>", _on_claims_mousewheel)
        scrollable_frame.bind("<MouseWheel>", _on_claims_mousewheel)
        dropdown_frame.bind("<MouseWheel>", _on_claims_mousewheel)
        scrollbar.bind("<MouseWheel>", _on_claims_mousewheel)

        def populate_dropdown_list(filter_text=""):
            for widget in scrollable_frame.winfo_children():
                widget.destroy()

            filt = filter_text.strip().upper()
            available_claims = []
            seen_cids = set()

            for cid, cdata in self.platform_catalog.items():
                seen_cids.add(cid.upper())
                pname = cdata.get("patient") or "Assigned Claim"
                st = cdata.get("status") or "IN_PROGRESS"
                ctype = cdata.get("short_name") or "CR - Call / IVR"
                available_claims.append((cid, pname, st, ctype))

            for rc in self.running_claims:
                if rc and rc[0] and rc[0].upper() not in seen_cids and rc[0] != "UNASSIGNED":
                    seen_cids.add(rc[0].upper())
                    available_claims.append((rc[0], rc[1] if len(rc) > 1 else "", rc[2] if len(rc) > 2 else "IN_PROGRESS", "CR - Call / IVR"))

            filtered_claims = [
                c for c in available_claims
                if not filt or filt in c[0].upper() or filt in c[1].upper() or filt in c[2].upper()
            ]

            if not filtered_claims:
                no_res = tk.Label(
                    scrollable_frame,
                    text="No matching claims found in platform claims section.",
                    font=("Segoe UI", 8),
                    fg="#b91c1c",
                    bg="#f8fafc",
                    pady=16
                )
                no_res.pack(fill="x")
                no_res.bind("<MouseWheel>", _on_claims_mousewheel)
                return

            for item in filtered_claims:
                cid = item[0]
                pname = item[1]
                curr_status = item[2]
                ctype_lbl = item[3]

                row = tk.Frame(scrollable_frame, bg="#ffffff", padx=10, pady=7, highlightthickness=1, highlightbackground="#e2e8f0")
                row.pack(fill="x", padx=4, pady=3)

                info_frame = tk.Frame(row, bg="#ffffff", cursor="hand2")
                info_frame.pack(side="left", fill="x", expand=True)

                cid_lbl = tk.Label(
                    info_frame,
                    text=cid,
                    font=("Consolas", 10, "bold"),
                    fg="#0f172a",
                    bg="#ffffff",
                    cursor="hand2"
                )
                cid_lbl.pack(side="left")

                pat_text = f" ({pname})" if pname else ""
                pat_lbl = tk.Label(
                    info_frame,
                    text=f"{pat_text}  |  {ctype_lbl}",
                    font=("Segoe UI", 8),
                    fg="#64748b",
                    bg="#ffffff",
                    cursor="hand2"
                )
                pat_lbl.pack(side="left", padx=(4, 0))

                s_bg = "#dcfce7" if "PAID" in curr_status.upper() else ("#fee2e2" if "DENI" in curr_status.upper() else "#fef3c7")
                s_fg = "#15803d" if "PAID" in curr_status.upper() else ("#b91c1c" if "DENI" in curr_status.upper() else "#b45309")

                status_lbl = tk.Label(
                    row,
                    text=curr_status,
                    font=("Segoe UI", 8, "bold"),
                    fg=s_fg,
                    bg=s_bg,
                    padx=8,
                    pady=2,
                    cursor="hand2"
                )
                status_lbl.pack(side="right")

                def _select_claim(selected_cid=cid):
                    entry_var.set(selected_cid)
                    toggle_dropdown(force_close=True)
                    entry_field.focus_set()

                for w in (row, info_frame, cid_lbl, pat_lbl, status_lbl):
                    w.bind("<Button-1>", lambda e, scid=cid: _select_claim(scid))
                    w.bind("<MouseWheel>", _on_claims_mousewheel)

        def toggle_dropdown(force_close=False):
            if self.dropdown_visible or force_close:
                dropdown_frame.pack_forget()
                root.geometry(f"{base_w}x{h_collapsed}+{pos_x}+{pos_y}")
                toggle_btn.configure(text="Select Existing", bg="#f0fdf4", fg="#15803d")
                self.dropdown_visible = False
            else:
                populate_dropdown_list(entry_var.get())
                dropdown_frame.pack(fill="x", pady=(0, 10), before=btn_frame)
                root.geometry(f"{base_w}x{h_expanded}+{pos_x}+{pos_y}")
                toggle_btn.configure(text="Close List", bg="#dcfce7", fg="#14532d")
                self.dropdown_visible = True
            root.lift()

        toggle_btn.configure(command=toggle_dropdown)

        def _on_global_mousewheel(event):
            if getattr(self, "dropdown_visible", False) and canvas.winfo_exists():
                _scroll_canvas(canvas, getattr(event, "delta", 0))
                return "break"

        root.bind_all("<MouseWheel>", _on_global_mousewheel)

        # --- Action Buttons Bar ---
        btn_frame = tk.Frame(body_frame, bg="#ffffff")
        btn_frame.pack(fill="x", side="bottom", pady=(14, 0))

        def _cleanup_and_close():
            if self._is_closing:
                return
            self._is_closing = True

            try:
                root.unbind_all('<MouseWheel>')
            except Exception:
                pass

            self._hook_procs.clear()
            self._taskbar_hwnd = None
            self._sec_taskbar_hwnd = None

            # 3. Restore input and foreground focus directly to target application
            if target_hwnd:
                try:
                    import ctypes
                    u32 = ctypes.windll.user32
                    if u32.IsWindow(target_hwnd):
                        if u32.IsIconic(target_hwnd):
                            u32.ShowWindow(target_hwnd, 9)
                        u32.SetForegroundWindow(target_hwnd)
                except Exception:
                    pass

            try:
                root.grab_release()
            except Exception:
                pass

            try:
                root.destroy()
            except Exception:
                pass

        def handle_confirm():
            raw_val = entry_var.get().strip().upper()
            if not raw_val:
                validation_box.configure(bg="#fef2f2", highlightbackground="#fca5a5")
                val_icon.configure(text="WARNING", font=("Segoe UI", 7, "bold"), fg="#b91c1c", bg="#fee2e2")
                val_lbl.configure(
                    text="Please enter the claim ID which is present in your login claims section (e.g. CLM-605).",
                    fg="#b91c1c",
                    bg="#fef2f2"
                )
                input_container.configure(highlightbackground="#ef4444", highlightcolor="#ef4444")
                entry_field.focus_set()
                return

            # If user confirms the already-active claim, close cleanly without error
            if current_claim and (raw_val == current_claim.strip().upper() or normalize_claim_key(raw_val) == normalize_claim_key(current_claim)):
                _cleanup_and_close()
                return

            claim_match = resolve_platform_claim(raw_val, self.platform_catalog)
            if not claim_match:
                validation_box.configure(bg="#fef2f2", highlightbackground="#fca5a5")
                val_icon.configure(text="WARNING", font=("Segoe UI", 7, "bold"), fg="#b91c1c", bg="#fee2e2")
                val_lbl.configure(
                    text=f"Warning: Claim '{raw_val}' is not found in NovaArc claims section. Please select a valid claim.",
                    fg="#b91c1c",
                    bg="#fef2f2"
                )
                input_container.configure(highlightbackground="#ef4444", highlightcolor="#ef4444")
                entry_field.focus_set()
                return

            final_claim = claim_match["claim_id"]

            # If claim is newly entered or not yet verified, synchronously validate against NovaArc platform claims
            if not claim_match.get("is_verified") or claim_match.get("is_verifying") or claim_match.get("target_minutes") is None:
                try:
                    s_live = fetch_single_claim_live(final_claim)
                    if s_live:
                        raw_st = s_live.get("status") or "created"
                        disp_st = format_platform_status_display(raw_st)
                        bm = match_claim_status_benchmark(raw_st)
                        claim_match["status"] = disp_st
                        claim_match["short_name"] = bm.get("short_name", "CR - Review / Portal")
                        claim_match["target_minutes"] = bm.get("target_minutes", 4)
                        claim_match["target_seconds"] = bm.get("target_seconds", 240)
                        claim_match["is_verifying"] = False
                        claim_match["is_verified"] = True
                        self.platform_catalog[final_claim] = claim_match
                        PLATFORM_CLAIMS_CATALOG[final_claim] = claim_match
                    else:
                        # NOT FOUND on NovaArc! Show warning in dialog and block starting!
                        detected_claim_holder["val"] = None
                        validation_box.configure(bg="#fef2f2", highlightbackground="#fca5a5")
                        val_icon.configure(text="WARNING", font=("Segoe UI", 7, "bold"), fg="#b91c1c", bg="#fee2e2")
                        val_lbl.configure(
                            text=f"Warning: Claim '{raw_val}' is not found in NovaArc claims section. Please select a valid claim.",
                            fg="#b91c1c",
                            bg="#fef2f2"
                        )
                        input_container.configure(highlightbackground="#ef4444", highlightcolor="#ef4444")
                        entry_field.focus_set()
                        return
                except Exception:
                    pass

            if not claim_match.get("is_verified") or claim_match.get("target_minutes") is None:
                detected_claim_holder["val"] = None
                validation_box.configure(bg="#fef2f2", highlightbackground="#fca5a5")
                val_icon.configure(text="WARNING", font=("Segoe UI", 7, "bold"), fg="#b91c1c", bg="#fee2e2")
                val_lbl.configure(
                    text=f"Warning: Claim '{raw_val}' is not found in NovaArc claims section. Please select a valid claim.",
                    fg="#b91c1c",
                    bg="#fef2f2"
                )
                input_container.configure(highlightbackground="#ef4444", highlightcolor="#ef4444")
                entry_field.focus_set()
                return

            c_type = claim_match.get("short_name", "CR - Review / Portal")
            t_mins = claim_match.get("target_minutes", 4)
            t_secs = claim_match.get("target_seconds", 240)

            detected_type = {
                "id": claim_match.get("id") or "CR_PORTAL",
                "short_name": c_type,
                "label": f"{c_type} ({t_mins} mins)",
                "target_minutes": t_mins,
                "target_seconds": t_secs,
                "platform_status": claim_match.get("status")
            }

            _cleanup_and_close()
            if self.on_submit:
                try:
                    self.on_submit(final_claim, detected_type)
                except TypeError:
                    self.on_submit(final_claim)

        def handle_cancel():
            _cleanup_and_close()
            if self.on_cancel:
                self.on_cancel()

        cancel_btn = tk.Button(
            btn_frame,
            text="Cancel",
            command=handle_cancel,
            bg="#f4f4f5",
            fg="#27272a",
            activebackground="#e4e4e7",
            activeforeground="#18181b",
            relief="solid",
            bd=1,
            font=("Segoe UI", 10, "bold"),
            padx=28,
            pady=8,
            cursor="hand2"
        )
        cancel_btn.pack(side="left")

        submit_btn = tk.Button(
            btn_frame,
            text="Start Working Claim",
            command=handle_confirm,
            bg="#059669",
            fg="#ffffff",
            activebackground="#047857",
            activeforeground="#ffffff",
            relief="flat",
            bd=0,
            font=("Segoe UI", 10, "bold"),
            padx=32,
            pady=8,
            cursor="hand2"
        )
        submit_btn.pack(side="right")

        # Keyboard bindings
        root.bind("<Return>", lambda e: handle_confirm())
        root.bind("<Escape>", lambda e: toggle_dropdown(force_close=True) if self.dropdown_visible else handle_cancel())
        root.bind("<Down>", lambda e: toggle_dropdown() if not self.dropdown_visible else None)
        root.protocol("WM_DELETE_WINDOW", handle_cancel)

        # Initial focus & smooth instantaneous reveal (zero white box or flicker)
        entry_field.focus_set()
        root.deiconify()

        try:
            root.mainloop()
        finally:
            if not self._is_closing:
                _cleanup_and_close()


if __name__ == "__main__":
    def on_done(cid):
        print(f"Active claim context confirmed: {cid}")

    dialog = ClaimDialog(on_submit=on_done, running_claims=[
        ("CLM-001", "Shift Claim", "IN_PROGRESS"),
        ("CLM-002", "Shift Claim", "COMPLETED")
    ])
    dialog.show(current_claim="CLM-001", platform_name="NovaArc RCM")