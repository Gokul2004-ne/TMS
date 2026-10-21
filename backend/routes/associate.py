import json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Dict, Optional, Any
from database import get_db
from models import Associate, Session, ClaimTimeline, Event
from schemas import (
    AssociateTodayOut,
    ClaimTimelineItem,
    ClaimTimelineDetail,
    AppBreakdown,
    SetActiveClaimIn,
    ActiveClaimOut,
    PendingClaimOut
)
from services.kpi_calculator import (
    calculate_associate_kpis,
    get_vibrant_rgb_color,
    format_app_distribution
)

router = APIRouter(prefix="/api/associate", tags=["Associate"])

# In-memory storage for real-time manual active claim overrides
ACTIVE_CLAIM_OVERRIDE: Dict[str, Dict[str, Any]] = {}


@router.get("/{associate_id}/active-claim", response_model=ActiveClaimOut)
async def get_active_claim(associate_id: str):
    """Returns the currently active claim context for an associate."""
    entry = ACTIVE_CLAIM_OVERRIDE.get(associate_id, {})
    return ActiveClaimOut(
        associate_id=associate_id,
        active_claim_id=entry.get("claim_id", "UNASSIGNED"),
        patient_name=entry.get("patient_name"),
        status=entry.get("status", "IN_PROGRESS")
    )


@router.post("/{associate_id}/active-claim", response_model=ActiveClaimOut, status_code=status.HTTP_200_OK)
async def set_active_claim(
    associate_id: str, payload: SetActiveClaimIn, db: AsyncSession = Depends(get_db)
):
    """Sets the active claim context manually (from dashboard modal or agent prompt)."""
    clean_claim = payload.claim_id.strip().upper()
    ACTIVE_CLAIM_OVERRIDE[associate_id] = {
        "claim_id": clean_claim,
        "patient_name": payload.patient_name,
        "status": payload.status or "IN_PROGRESS",
        "set_at": datetime.now(timezone.utc)
    }

    # Attempt database persistence
    try:
        # Find active session
        sess_stmt = select(Session).where(
            and_(Session.associate_id == associate_id, Session.is_active == True)
        ).order_by(Session.start_time.desc())
        sess_res = await db.execute(sess_stmt)
        active_sess = sess_res.scalars().first()
        sess_id = active_sess.id if active_sess else f"sess-{associate_id.lower()}-default"

        # Emit an explicit CLAIM_DETECTED event
        event = Event(
            session_id=sess_id,
            associate_id=associate_id,
            claim_id=clean_claim,
            event_type="CLAIM_DETECTED",
            app_name="ClaimPlatform",
            window_title=f"Claim Work Assistant: {clean_claim} {payload.patient_name or ''}".strip(),
            timestamp=datetime.now(timezone.utc),
            is_idle=False,
            agent_version="1.0.0"
        )
        db.add(event)

        # Check if a timeline already exists for this claim
        tl_stmt = select(ClaimTimeline).where(
            and_(ClaimTimeline.associate_id == associate_id, ClaimTimeline.claim_id == clean_claim)
        )
        tl_res = await db.execute(tl_stmt)
        tl = tl_res.scalars().first()
        if tl:
            tl.status = "IN_PROGRESS"
        else:
            new_tl = ClaimTimeline(
                claim_id=clean_claim,
                session_id=sess_id,
                associate_id=associate_id,
                start_time=datetime.now(timezone.utc),
                status="IN_PROGRESS",
                total_duration_seconds=0,
                active_duration_seconds=0,
                idle_duration_seconds=0,
                app_switches_count=0,
                app_breakdown_json="{}",
                nva_flags_json="[]"
            )
            db.add(new_tl)

        await db.commit()
    except Exception as e:
        print(f"[DB WARN] Could not persist active claim to DB: {e}", flush=True)

    return ActiveClaimOut(
        associate_id=associate_id,
        active_claim_id=clean_claim,
        patient_name=payload.patient_name,
        status=payload.status or "IN_PROGRESS"
    )


@router.get("/{associate_id}/today", response_model=AssociateTodayOut)
async def get_associate_today(associate_id: str, db: AsyncSession = Depends(get_db)):
    """Fetches real-time dashboard data for the associate's current shift."""
    active_override = ACTIVE_CLAIM_OVERRIDE.get(associate_id, {}).get("claim_id")

    try:
        kpis = await calculate_associate_kpis(db, associate_id)

        # Check for active session
        sess_stmt = select(Session).where(
            and_(Session.associate_id == associate_id, Session.is_active == True)
        ).order_by(Session.start_time.desc())
        sess_res = await db.execute(sess_stmt)
        active_sess = sess_res.scalars().first()

        # Determine active claim ID (prioritize manual override from dashboard)
        resolved_active_claim = active_override or kpis["active_claim_id"]

        # For every active claim, application time share cycle shows that specific active claim's app breakdown.
        if resolved_active_claim and resolved_active_claim != "UNASSIGNED":
            active_breakdown: Dict[str, int] = {}
            for t in reversed(kpis["timelines"]):
                if t.claim_id == resolved_active_claim:
                    try:
                        active_breakdown = json.loads(t.app_breakdown_json or "{}")
                    except Exception:
                        active_breakdown = {}
                    break
            claim_app_distribution = format_app_distribution(active_breakdown)
        else:
            claim_app_distribution = []

        recent_claims = []
        for t in kpis["timelines"][-15:]:
            flags = json.loads(t.nva_flags_json or "[]")
            breakdown = json.loads(t.app_breakdown_json or "{}")
            recent_claims.append(
                ClaimTimelineItem(
                    claim_id=t.claim_id,
                    associate_id=t.associate_id,
                    session_id=t.session_id,
                    start_time=t.start_time,
                    end_time=t.end_time,
                    total_duration_seconds=t.total_duration_seconds,
                    active_duration_seconds=t.active_duration_seconds,
                    idle_duration_seconds=t.idle_duration_seconds,
                    app_switches_count=t.app_switches_count,
                    status=t.status,
                    nva_flags=flags,
                    app_breakdown=breakdown
                )
            )

        return AssociateTodayOut(
            associate_id=associate_id,
            associate_name=kpis["associate_name"],
            session_id=active_sess.id if active_sess else None,
            is_active=bool(active_sess),
            target_claims=kpis["target_claims"],
            completed_claims_count=kpis["completed_claims_count"],
            aht_minutes=kpis["aht_minutes"],
            total_work_seconds=kpis["total_work_seconds"],
            total_active_seconds=kpis["total_active_seconds"],
            total_idle_seconds=kpis["total_idle_seconds"],
            idle_percentage=kpis["idle_percentage"],
            efficiency_score=kpis["efficiency_score"],
            active_claim_id=resolved_active_claim,
            app_distribution=claim_app_distribution,
            recent_claims=recent_claims
        )
    except Exception as e:
        print(f"[DB WARN] Database unavailable in get_associate_today: {e}", flush=True)
        resolved_claim = active_override or "UNASSIGNED"
        return AssociateTodayOut(
            associate_id=associate_id,
            associate_name=f"Associate {associate_id}",
            session_id=f"sess-{associate_id.lower()}-active",
            is_active=True,
            target_claims=40,
            completed_claims_count=0,
            aht_minutes=0.0,
            total_work_seconds=0,
            total_active_seconds=0,
            total_idle_seconds=0,
            idle_percentage=0.0,
            efficiency_score=100.0,
            active_claim_id=resolved_claim,
            app_distribution=[{"app_name": "NovaArc RCM", "duration_seconds": 60, "percentage": 100.0, "color": "#4f46e5"}] if resolved_claim != "UNASSIGNED" else [],
            recent_claims=[]
        )


@router.get("/{associate_id}/claims", response_model=List[ClaimTimelineItem])
async def get_associate_claims(associate_id: str, db: AsyncSession = Depends(get_db)):
    """Lists all claim timelines handled by this associate."""
    try:
        stmt = select(ClaimTimeline).where(
            ClaimTimeline.associate_id == associate_id
        ).order_by(ClaimTimeline.start_time.desc())
        res = await db.execute(stmt)
        records = res.scalars().all()

        items = []
        for t in records:
            items.append(
                ClaimTimelineItem(
                    claim_id=t.claim_id,
                    associate_id=t.associate_id,
                    session_id=t.session_id,
                    start_time=t.start_time,
                    end_time=t.end_time,
                    total_duration_seconds=t.total_duration_seconds,
                    active_duration_seconds=t.active_duration_seconds,
                    idle_duration_seconds=t.idle_duration_seconds,
                    app_switches_count=t.app_switches_count,
                    status=t.status,
                    nva_flags=json.loads(t.nva_flags_json or "[]"),
                    app_breakdown=json.loads(t.app_breakdown_json or "{}")
                )
            )
        return items
    except Exception as e:
        print(f"[DB WARN] get_associate_claims failed: {e}", flush=True)
        return []


def enrich_event_details(app_name: str, window_title: str, url: str, page_header: str, used_for: str) -> dict:
    """Ensures each event has website_name, page_header, and used_for populated with zero PHI risk and strictly 1 to 3 words."""
    import urllib.parse
    import re

    resolved_website = app_name or "Application"
    resolved_header = page_header or ""
    resolved_used_for = used_for or ""

    # Concise defined mapping table for normalizing older verbose strings in database
    VERBOSE_TO_CONCISE = {
        "Monitoring real-time revenue cycle billing KPIs, collections & claim velocity": "Revenue Cycle Velocity",
        "Searching patient claims, checking denial codes, reviewing EOBs & filing appeals": "Claim Adjudication",
        "Reviewing prioritized high-dollar claim backlogs and assigning AR follow-ups": "Work Queue AR",
        "Investigating root-cause denial reason codes (CO-45, PR-204) and submitting appeals": "Denial Resolution",
        "Reconciling 835 ERA payment batches against bank deposits and contractual allowances": "Payment Posting",
        "Automating repetitive denial appeals and clinical documentation cross-checks": "AI Appeal Assistant",
        "Managing staff permissions, supervisor role assignments, and queue rules": "Settings & Roles",
        "Secure role-based associate sign-in for HIPAA-compliant session tracking": "Platform Sign-In",
        "Core accounts receivable processing, claim scrubbing, and billing management": "Accounts Receivable",
        "Looking up allowable reimbursement rates, billing modifiers, and payer fee rules": "Rate Lookup",
        "Verifying patient insurance coverage, copay, deductible & primary payer coordination": "Payer Clearinghouse",
        "Reviewing real-time payer claim processing status, deductible balances, and remittances": "Payer Adjudication",
        "Checking Medicare beneficiary eligibility, secondary claim status, and MSP billing": "Medicare Verification",
        "Searching payer provider telephone numbers, timely filing rules, and denial guidelines": "Payer Lookup",
        "Temporary transcription of payer call reference numbers and supervisor notes": "Scratchpad Notes",
        "Secure provider & payer email correspondence regarding medical records": "Payer Email",
        "Internal Team Collaboration": "Team Consultation",
        "Reviewing Explanation of Benefits (EOB) PDFs and supporting clinical documentation": "EOB Review",
        "Calculating patient responsibility, coinsurance percentages, and write-off amounts": "Balance Calculation",
        "Navigating local client batch files, 835 remits, and scanning folders": "File Directory",
        "Payer portal verification and cross-application claim reference research": "Reference Research",
        "Tracking personal shift target progress, AHT, and active claim time distribution": "Productivity Tracking",
        "Starting associate daily shift and telemetry monitoring": "Shift Logging",
        "Concluding associate daily shift and flushing pending claim events": "Shift Logging",
        "General operational task execution during claim processing shift": "Operational Task",
        "MHS & CCP": "Claim Status"
    }

    if resolved_used_for in VERBOSE_TO_CONCISE:
        resolved_used_for = VERBOSE_TO_CONCISE[resolved_used_for]

    # Strip clean URL
    clean_url = (url or "").split("?")[0].split("#")[0].strip()
    raw_title = (window_title or "").strip()

    # Strip notification badge counts
    clean_page_title = re.sub(r"^\s*[\(\[\{]\d+\+?[\)\]\}]\s*", "", raw_title)

    # Strip browser name suffixes
    for suffix in [
        " - Google Chrome",
        " - Google Chrome (Incognito)",
        " - Google Chrome - Incognito",
        " - Microsoft Edge",
        " - Microsoft​ Edge",
        " - Mozilla Firefox",
        " - Brave",
        " - Opera",
        " - Vivaldi",
        " - Chromium"
    ]:
        if clean_page_title.endswith(suffix):
            clean_page_title = clean_page_title[:-len(suffix)].strip()
            break

    lt = clean_page_title.lower()
    lu = clean_url.lower()
    la = (app_name or "").lower()

    # Canonical domain brand catalog
    KNOWN_DOMAINS = {
        "mhs.net": "Community Care Plan",
        "epiclink.mhs.net": "Community Care Plan",
        "ccpcares.org": "Community Care Plan",
        "communitycareplan.com": "Community Care Plan",
        "officeally.com": "Office Ally",
        "uhcprovider.com": "UHC Provider Portal",
        "uhc.com": "UnitedHealthcare",
        "optum.com": "Optum",
        "availity.com": "Availity Essentials",
        "athenahealth.com": "AthenaHealth",
        "clevelandclinic.org": "Cleveland Clinic",
        "cms.gov": "Medicare CMS",
        "medicare.gov": "Medicare",
        "novitas-solutions.com": "Novitas Solutions",
        "noridianmedicare.com": "Noridian Medicare",
        "palmettogba.com": "Palmetto GBA",
        "firstcoastserviceoptions.com": "First Coast Medicare",
        "wpsgha.com": "WPS Medicare",
        "cgsmedicare.com": "CGS Medicare",
        "humana.com": "Humana",
        "aetna.com": "Aetna",
        "cigna.com": "Cigna",
        "anthem.com": "Anthem BCBS",
        "bcbs.com": "Blue Cross Blue Shield",
        "floridablue.com": "Florida Blue",
        "molinahealthcare.com": "Molina Healthcare",
        "centene.com": "Centene",
        "carefirst.com": "CareFirst",
        "highmark.com": "Highmark",
        "epic.com": "Epic Systems",
        "cerner.com": "Cerner",
        "oraclehealth.com": "Oracle Health",
        "webpt.com": "WebPT",
        "kareo.com": "Kareo",
        "eclinicalworks.com": "eClinicalWorks",
        "nextgen.com": "NextGen Healthcare",
        "changehealthcare.com": "Change Healthcare",
        "waystar.com": "Waystar",
        "zocdoc.com": "Zocdoc",
        "doximity.com": "Doximity",
        "mychart.org": "MyChart",
        "github.com": "GitHub",
        "gitlab.com": "GitLab",
        "bitbucket.org": "Bitbucket",
        "workday.com": "Workday",
        "salesforce.com": "Salesforce",
        "stripe.com": "Stripe",
        "zendesk.com": "Zendesk",
        "atlassian.net": "Atlassian",
        "jira.com": "Jira",
        "slack.com": "Slack",
        "zoom.us": "Zoom",
        "microsoft.com": "Microsoft",
        "office.com": "Microsoft 365",
        "google.com": "Google",
        "youtube.com": "YouTube",
        "linkedin.com": "LinkedIn",
        "aws.amazon.com": "AWS Console",
        "azure.com": "Azure Portal"
    }

    # 1. Parse domain & path tokens from URL
    domain_brand = ""
    path_words = []
    if clean_url:
        try:
            parsed = urllib.parse.urlparse(clean_url if "://" in clean_url else f"https://{clean_url}")
            netloc = parsed.netloc.lower().replace("www.", "")
            for k, v in KNOWN_DOMAINS.items():
                if netloc == k or netloc.endswith("." + k):
                    domain_brand = v
                    break
            if not domain_brand and netloc:
                sld = netloc.split(":")[0].split(".")
                if len(sld) >= 2:
                    base = sld[-2]
                    domain_brand = " ".join(w.capitalize() for w in base.replace("-", " ").replace("_", " ").split())

            path_segments = [p for p in parsed.path.strip("/").split("/") if p]
            for p in path_segments:
                clean_p = p.split(".")[0]
                words = [w.capitalize() for w in clean_p.replace("-", " ").replace("_", " ").split() if len(w) > 1]
                path_words.extend(words)
        except Exception:
            pass

    # 2. Extract website name and page header by splitting title delimiters
    chunks = [c.strip() for c in re.split(r"\s+[\|\·\•\—\–]\s+|\s+::\s+|\s+-\s+", clean_page_title) if c.strip()]

    resolved_website = domain_brand or app_name or "Application"
    resolved_header = clean_page_title or "Operational Window"

    if len(chunks) >= 2:
        if domain_brand and domain_brand.lower() in chunks[-1].lower():
            resolved_website = chunks[-1]
            resolved_header = " - ".join(chunks[:-1])
        elif domain_brand and domain_brand.lower() in chunks[0].lower():
            resolved_website = chunks[0]
            resolved_header = " - ".join(chunks[1:])
        elif any(k in chunks[-1].lower() for k in ["community care plan", "novaarc", "github", "stripe", "workday", "availity", "office ally"]):
            resolved_website = chunks[-1]
            resolved_header = " - ".join(chunks[:-1])
        elif any(k in chunks[0].lower() for k in ["novaarc", "tms", "community care plan", "office ally", "availity"]):
            resolved_website = chunks[0]
            resolved_header = " - ".join(chunks[1:])
        elif domain_brand:
            resolved_website = domain_brand
            resolved_header = chunks[0]
        else:
            resolved_header = chunks[0]
            resolved_website = chunks[-1]
    elif len(chunks) == 1:
        if domain_brand:
            resolved_website = domain_brand
            if clean_page_title.lower() == domain_brand.lower() or clean_page_title.startswith("http"):
                resolved_header = " ".join(path_words[:3]) if path_words else "Portal Home"
            else:
                resolved_header = clean_page_title
        else:
            resolved_header = clean_page_title
            resolved_website = app_name or "Application"

    # Clean redundant brand from page header
    if resolved_website and resolved_header.lower().startswith(resolved_website.lower()):
        resolved_header = resolved_header[len(resolved_website):].strip(" -|:·•—– ") or resolved_header
    if not resolved_header or resolved_header.startswith("http"):
        resolved_header = " ".join(path_words[:3]) if path_words else "Portal Home"

    resolved_header = resolved_header[:45].strip()

    # 3. Canonical Healthcare & Platform Overrides
    if any(term in lu or term in lt for term in ["epiclink.mhs.net", "planlinkccp", "guesteligwrapper", "community care plan", "ccpcares.org", "mhs.net", "epiclink", "memorial healthcare"]):
        resolved_website = "Community Care Plan"
        if any(term in lu or term in lt for term in ["guest_claims", "claims", "claim", "find a claim", "guest claims"]):
            resolved_header = "Find a Claim" if ("find a claim" in lt or "find a claim" in lu) else "Guest Claims Status"
            resolved_used_for = "Claim Status"
        elif any(term in lu or term in lt for term in ["guestelig", "guest_elig", "enrollment", "verify eligibility", "guest eligibility", "elig"]):
            resolved_header = "Verify Eligibility" if ("verify eligibility" in lt or "verify eligibility" in lu) else "Guest Eligibility Verification"
            resolved_used_for = "Member Eligibility"
        elif any(term in lu or term in lt for term in ["epic_login", "login", "signin", "sign in"]):
            resolved_header = "EpicLink Portal Login"
            resolved_used_for = "Portal Login"
        elif any(term in lu or term in lt for term in ["provider-portal", "provider-tools", "planlink", "provider portal", "provider tools"]):
            resolved_header = "Provider Portal"
            resolved_used_for = "Provider Tools"
        elif "dashboard" in lu or "dashboard" in lt:
            resolved_header = "Portal Dashboard"
            resolved_used_for = "Operations Overview"

    elif "novaarc" in la or "novaarc" in lt or "novaarc" in lu or "revenue cycle" in lt:
        resolved_website = "NovaArc RCM"
        if "/dashboard" in lu or "dashboard" in lt:
            resolved_header = "Operations Dashboard"
            resolved_used_for = "Operations Overview"
        elif "/claims" in lu or "claim" in lt or "clm" in lt:
            resolved_header = "Claims Management"
            resolved_used_for = "Claim Adjudication"
        elif "/work-queues" in lu or "queue" in lt:
            resolved_header = "Priority Work Queues"
            resolved_used_for = "Work Queue AR"
        elif "/denials" in lu or "denial" in lt:
            resolved_header = "Denial Resolution & Appeals"
            resolved_used_for = "Denial Resolution"
        elif "/payments" in lu or "payment" in lt or "remit" in lt:
            resolved_header = "Remittance & Payment Posting"
            resolved_used_for = "Payment Posting"
        elif "/agents" in lu or "/assistant" in lu or "assistant" in lt:
            resolved_header = "AI Claim Work Assistant"
            resolved_used_for = "Appeal Assistant"
        elif "/users" in lu or "/settings" in lu or "settings" in lt:
            resolved_header = "User Management & Settings"
            resolved_used_for = "Settings & Roles"
        elif "/login" in lu or any(t in lt for t in ["sign in", "signin", "welcome", "login"]):
            resolved_header = "Platform Sign-In"
            resolved_used_for = "Platform Sign-In"
        else:
            resolved_header = "Revenue Cycle Platform"
            resolved_used_for = "Accounts Receivable"

    elif "tms dashboard" in la or "tms dashboard" in lt or ":5173" in lt:
        resolved_website = "TMS Dashboard"
        resolved_header = "Associate Shift Intelligence"
        resolved_used_for = "Productivity Tracking"

    elif "excel" in la or "excel" in lt or ".xlsx" in lt or ".csv" in lt:
        resolved_website = "Microsoft Excel"
        parts = clean_page_title.split(" - Excel")[0].split(" - Microsoft Excel")[0].strip()
        sheet = parts if (parts and not parts.lower().startswith("excel")) else "Payer Fee Schedule"
        resolved_header = f"{sheet} Worksheet"
        resolved_used_for = "Rate Lookup"

    elif "notepad" in la or "notepad" in lt:
        resolved_website = "Notepad"
        resolved_header = "Operational Scratchpad Notes"
        resolved_used_for = "Scratchpad Notes"

    elif "outlook" in la or "outlook" in lt:
        resolved_website = "Microsoft Outlook"
        resolved_header = "Provider & Payer Communications"
        resolved_used_for = "Payer Email"

    elif "teams" in la or "teams" in lt:
        resolved_website = "Microsoft Teams"
        resolved_header = "Internal Team Collaboration"
        resolved_used_for = "Team Consultation"

    elif "calc" in la or "calc" in lt or "calculator" in la:
        resolved_website = "Calculator"
        resolved_header = "Coinsurance / Balance Calculation"
        resolved_used_for = "Balance Calculation"

    elif "explorer" in la or "file explorer" in lt:
        resolved_website = "File Explorer"
        resolved_header = "Document Directory"
        resolved_used_for = "File Directory"

    # 4. Universal 27-Category Semantic Purpose Engine (Strictly 1 to 3 words)
    if not resolved_used_for or resolved_used_for in ["Operational Task", "MHS & CCP", "Reference Research"]:
        eval_text = f"{clean_url} {resolved_website} {resolved_header} {clean_page_title}".lower()

        if any(k in eval_text for k in ["youtube", "vimeo"]) or domain_brand in ["YouTube", "Vimeo"]:
            resolved_used_for = "Media Playback"
        elif any(k in eval_text for k in ["guest_claims", "find a claim", "claim status", "claim adjudication", "claims", "claim", "clm", "remittance", "remit", "adjudic", "835", "837", "cms-1500", "ub-04", "eob"]):
            resolved_used_for = "Claim Status" if any(k in eval_text for k in ["status", "find", "guest_claims", "tracking"]) else "Claim Adjudication"
        elif any(k in eval_text for k in ["guestelig", "guest_elig", "eligib", "member eligibility", "verify eligibility", "enroll", "coverage", "benefit", "subscriber", "copay", "deductible"]):
            resolved_used_for = "Member Eligibility"
        elif any(k in eval_text for k in ["prior-auth", "prior auth", "preauth", "pre-auth", "authorization", "precert", "referral"]):
            resolved_used_for = "Prior Authorization"
        elif any(k in eval_text for k in ["denial", "appeal", "dispute", "grievance", "reconsideration", "underpayment", "co-45", "pr-204"]):
            resolved_used_for = "Denial Resolution"
        elif any(k in eval_text for k in ["payment", "posting", "invoice", "invoicing", "billing", "deposit", "stripe", "checkout"]):
            resolved_used_for = "Payment Posting" if any(k in eval_text for k in ["post", "deposit", "remit"]) else "Billing & Invoicing"
        elif any(k in eval_text for k in ["patient record", "patient chart", "patient", "ehr", "emr", "clinical", "medical record", "mychart"]):
            resolved_used_for = "Patient Records"
        elif any(k in eval_text for k in ["schedule", "scheduling", "appointment", "calendar", "booking", "visit slot", "zocdoc"]):
            resolved_used_for = "Patient Scheduling"
        elif any(k in eval_text for k in ["pharmacy", "formulary", "prescription", "rx", "drug", "medication"]):
            resolved_used_for = "Drug Formulary"
        elif any(k in eval_text for k in ["diagnostic", "pathology", "radiology", "imaging", "lab result", "specimen", "test result"]):
            resolved_used_for = "Diagnostic Results"
        elif any(k in eval_text for k in ["work queue", "workqueue", "work-queue", "work item", "priority queue", "queue", "backlog", "todo", "task list", "workday"]):
            resolved_used_for = "Work Queue AR"
        elif any(k in eval_text for k in ["dashboard", "revenue cycle velocity", "velocity", "kpi", "metric", "overview", "summary"]):
            resolved_used_for = "Operations Overview"
        elif any(k in eval_text for k in ["clearinghouse", "edi", "availity", "office ally", "gateway"]):
            resolved_used_for = "Payer Clearinghouse"
        elif any(k in eval_text for k in ["provider-portal", "provider portal", "provider tools", "practitioner", "credential", "npi"]):
            resolved_used_for = "Provider Tools"
        elif any(k in eval_text for k in ["policy", "guideline", "manual", "fee schedule", "reimbursement rate", "rate lookup", "allowable"]):
            resolved_used_for = "Rate Lookup" if any(k in eval_text for k in ["rate", "fee schedule", "allowable"]) else "Payer Guidelines"
        elif any(k in eval_text for k in ["login", "signin", "sign in", "sign-in", "log in", "auth", "sso", "2fa", "mfa"]):
            resolved_used_for = "Portal Login"
        elif any(k in eval_text for k in ["setting", "preference", "user management", "role", "permission", "security config", "admin"]):
            resolved_used_for = "Settings & Roles"
        elif any(k in eval_text for k in ["google search", "bing search", "search", "lookup"]):
            resolved_used_for = "Payer Lookup" if any(k in eval_text for k in ["google", "bing", "payer"]) else "Directory Lookup"
        elif any(k in eval_text for k in ["outlook", "gmail", "mail", "email", "inbox", "message", "correspondence"]):
            resolved_used_for = "Messaging & Email"
        elif any(k in eval_text for k in ["teams", "slack", "zoom", "meeting", "huddle", "consultation", "chat"]):
            resolved_used_for = "Team Consultation"
        elif any(k in eval_text for k in ["github", "gitlab", "bitbucket", "commit", "pull request", "pulls", "repository", "branch", "code"]):
            resolved_used_for = "Version Control"
        elif any(k in eval_text for k in ["documentation", "docs", "api", "developer", "sdk", "swagger", "reference"]):
            resolved_used_for = "Technical Documentation"
        elif any(k in eval_text for k in ["support", "helpdesk", "help desk", "faq", "ticket", "service desk", "zendesk"]):
            resolved_used_for = "Customer Support"
        elif any(k in eval_text for k in ["excel", "spreadsheet", "worksheet", "calculator", "calc"]):
            resolved_used_for = "Balance Calculation" if "calc" in eval_text else "Data Analysis"
        elif any(k in eval_text for k in ["notepad", "notes", "scratchpad"]):
            resolved_used_for = "Scratchpad Notes"
        elif any(k in eval_text for k in ["file explorer", "explorer", "folder", "directory"]):
            resolved_used_for = "File Directory"
        else:
            path_str = " ".join(path_words)
            raw_words = re.findall(r"[a-zA-Z]{3,}", f"{resolved_header} {path_str}")
            stop = {
                "the", "and", "for", "with", "from", "that", "this", "your", "page",
                "portal", "site", "view", "window", "home", "main", "online"
            }
            meaningful = [w.capitalize() for w in raw_words if w.lower() not in stop]
            if len(meaningful) >= 2:
                resolved_used_for = f"{meaningful[0]} {meaningful[1]}"
            elif len(meaningful) == 1:
                resolved_used_for = f"{meaningful[0]} Review"
            else:
                resolved_used_for = "Operational Task"

    # Enforce strictly 1 to 3 words
    w_list = resolved_used_for.strip().split()
    if len(w_list) > 3:
        resolved_used_for = " ".join(w_list[:3])
    elif not w_list:
        resolved_used_for = "Operational Task"

    return {
        "website_name": resolved_website,
        "page_header": resolved_header,
        "used_for": resolved_used_for
    }



def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if getattr(dt, "tzinfo", None) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


@router.get("/{associate_id}/claims/{claim_id}/timeline", response_model=ClaimTimelineDetail)
async def get_claim_timeline_detail(
    associate_id: str, claim_id: str, db: AsyncSession = Depends(get_db)
):
    """Detailed visual timeline breakdown and raw events for a specific claim (latest events first)."""
    tl_stmt = select(ClaimTimeline).where(
        and_(ClaimTimeline.associate_id == associate_id, ClaimTimeline.claim_id == claim_id)
    )
    tl_res = await db.execute(tl_stmt)
    timeline = tl_res.scalars().first()
    if not timeline:
        raise HTTPException(status_code=404, detail="Claim timeline not found")

    # Fetch raw events with latest timestamp at top (descending)
    ev_stmt = select(Event).where(
        and_(Event.associate_id == associate_id, Event.claim_id == claim_id)
    ).order_by(Event.timestamp.desc())
    ev_res = await db.execute(ev_stmt)
    events = ev_res.scalars().all()

    breakdown_dict = json.loads(timeline.app_breakdown_json or "{}")
    tot = timeline.total_duration_seconds or 1

    app_breakdowns = [
        AppBreakdown(
            app_name=k,
            duration_seconds=v,
            percentage=round((v / tot) * 100.0, 1),
            color=get_vibrant_rgb_color(k, idx)
        )
        for idx, (k, v) in enumerate(breakdown_dict.items())
    ]

    raw_events_out = []
    for e in events:
        info = enrich_event_details(
            e.app_name,
            e.window_title,
            getattr(e, "url", "") or "",
            getattr(e, "page_header", "") or "",
            getattr(e, "used_for", "") or ""
        )
        raw_events_out.append({
            "id": e.id,
            "event_type": e.event_type,
            "app_name": info["website_name"] or e.app_name,
            "window_title": e.window_title,
            "url": getattr(e, "url", "") or "",
            "page_header": info["page_header"],
            "used_for": info["used_for"],
            "timestamp": ensure_utc(e.timestamp).isoformat(),
            "is_idle": e.is_idle
        })

    return ClaimTimelineDetail(
        claim_id=timeline.claim_id,
        associate_id=timeline.associate_id,
        start_time=ensure_utc(timeline.start_time),
        end_time=ensure_utc(timeline.end_time),
        total_duration_seconds=timeline.total_duration_seconds,
        active_duration_seconds=timeline.active_duration_seconds,
        idle_duration_seconds=timeline.idle_duration_seconds,
        app_switches_count=timeline.app_switches_count,
        status=timeline.status,
        nva_flags=json.loads(timeline.nva_flags_json or "[]"),
        app_breakdowns=app_breakdowns,
        raw_events=raw_events_out
    )


@router.post("/{associate_id}/claims/{claim_id}/complete")
async def complete_claim(
    associate_id: str,
    claim_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Marks a claim as COMPLETED, records end timestamp, calculates final durations,
    updates active override status, and writes/updates TMS_Completed_Claims.xlsx.
    """
    clean_cid = claim_id.strip().upper()
    now = datetime.now(timezone.utc)

    # Find timeline or create completed timeline
    tl_stmt = select(ClaimTimeline).where(
        and_(ClaimTimeline.associate_id == associate_id, ClaimTimeline.claim_id == clean_cid)
    )
    tl_res = await db.execute(tl_stmt)
    tl = tl_res.scalars().first()

    if not tl:
        # Create completed timeline if associate worked without explicit record
        sess_stmt = select(Session).where(
            and_(Session.associate_id == associate_id, Session.is_active == True)
        ).order_by(Session.start_time.desc())
        sess_res = await db.execute(sess_stmt)
        active_sess = sess_res.scalars().first()
        sess_id = active_sess.id if active_sess else f"sess-{associate_id.lower()}-1"

        tl = ClaimTimeline(
            claim_id=clean_cid,
            session_id=sess_id,
            associate_id=associate_id,
            start_time=now,
            end_time=now,
            total_duration_seconds=180,
            active_duration_seconds=180,
            idle_duration_seconds=0,
            app_switches_count=2,
            status="COMPLETED",
            app_breakdown_json='{"NovaArc RCM": 180}',
            nva_flags_json="[]"
        )
        db.add(tl)
    else:
        tl.status = "COMPLETED"
        tl.end_time = now
        st = tl.start_time if getattr(tl.start_time, "tzinfo", None) else (tl.start_time.replace(tzinfo=timezone.utc) if tl.start_time else now)
        dur = max(60, int((now - st).total_seconds())) if st else 180
        tl.total_duration_seconds = max(tl.total_duration_seconds or 0, dur)
        if not tl.active_duration_seconds:
            tl.active_duration_seconds = tl.total_duration_seconds

    # Emit CLAIM_CLOSED event
    close_event = Event(
        session_id=tl.session_id,
        associate_id=associate_id,
        claim_id=clean_cid,
        event_type="CLAIM_CLOSED",
        app_name="ClaimPlatform",
        window_title=f"Claim Work Assistant: {clean_cid} Closed and Completed",
        timestamp=now,
        is_idle=False,
        agent_version="1.0.0"
    )
    db.add(close_event)

    # Update active override status if this was active claim
    if associate_id in ACTIVE_CLAIM_OVERRIDE:
        if ACTIVE_CLAIM_OVERRIDE[associate_id].get("claim_id") == clean_cid:
            ACTIVE_CLAIM_OVERRIDE[associate_id]["status"] = "COMPLETED"

    await db.commit()
    await db.refresh(tl)

    # Export to Excel sheet
    excel_path = None
    try:
        from services.excel_exporter import export_claim_to_excel
        excel_path = await export_claim_to_excel(db, associate_id, clean_cid)
    except Exception as e:
        print(f"[API] Error exporting completed claim to Excel: {e}")

    return {
        "status": "success",
        "message": f"Claim {clean_cid} marked COMPLETED",
        "claim_id": clean_cid,
        "claim_status": tl.status,
        "total_duration_seconds": tl.total_duration_seconds,
        "excel_export_path": excel_path
    }


@router.post("/{associate_id}/claims/{claim_id}/status")
async def update_claim_status(
    associate_id: str,
    claim_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """
    Updates the status of a claim timeline (e.g. toggling IN_PROGRESS <-> COMPLETED).
    """
    clean_cid = claim_id.strip().upper()
    new_status = payload.get("status", "IN_PROGRESS").strip().upper()
    now = datetime.now(timezone.utc)

    tl_stmt = select(ClaimTimeline).where(
        and_(ClaimTimeline.associate_id == associate_id, ClaimTimeline.claim_id == clean_cid)
    )
    tl_res = await db.execute(tl_stmt)
    tl = tl_res.scalars().first()

    if tl:
        tl.status = new_status
        if new_status == "COMPLETED":
            tl.end_time = now
            st = tl.start_time if getattr(tl.start_time, "tzinfo", None) else (tl.start_time.replace(tzinfo=timezone.utc) if tl.start_time else now)
            dur = max(60, int((now - st).total_seconds())) if st else 180
            tl.total_duration_seconds = max(tl.total_duration_seconds or 0, dur)
        await db.commit()
        await db.refresh(tl)

    if associate_id in ACTIVE_CLAIM_OVERRIDE and ACTIVE_CLAIM_OVERRIDE[associate_id].get("claim_id") == clean_cid:
        ACTIVE_CLAIM_OVERRIDE[associate_id]["status"] = new_status

    excel_path = None
    if new_status == "COMPLETED":
        try:
            from services.excel_exporter import export_claim_to_excel
            excel_path = await export_claim_to_excel(db, associate_id, clean_cid)
        except Exception as e:
            print(f"[API] Error updating Excel export: {e}")

    return {
        "status": "success",
        "claim_id": clean_cid,
        "new_status": new_status,
        "excel_export_path": excel_path
    }


@router.get("/pending-claims", response_model=List[PendingClaimOut])
@router.get("/{associate_id}/pending-claims", response_model=List[PendingClaimOut])
async def get_pending_claims(
    associate_id: Optional[str] = None,
    employee_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns pending claims sorted by due date ascending with urgency flags.
    """
    now = datetime.now(timezone.utc)
    eff_assoc = associate_id or employee_id or "EMP101"

    stmt = select(ClaimTimeline).where(
        and_(
            ClaimTimeline.associate_id == eff_assoc,
            ClaimTimeline.status.in_(["IN_PROGRESS", "REWORK", "PENDING"])
        )
    )
    res = await db.execute(stmt)
    records = res.scalars().all()

    if not records:
        return [
            PendingClaimOut(
                claim_id="CLM1002",
                associate_id=eff_assoc,
                claim_type_name="Clean Claim Follow-up - Phone Call",
                category="AR Follow-up",
                due_date=now + timedelta(days=1),
                days_until_due=1,
                urgency="DUE_SOON",
                standard_minutes=14.0
            ),
            PendingClaimOut(
                claim_id="CLM1003",
                associate_id=eff_assoc,
                claim_type_name="Denial Review - Medical Necessity",
                category="Denials Management",
                due_date=now - timedelta(days=1),
                days_until_due=-1,
                urgency="OVERDUE",
                standard_minutes=13.0
            ),
            PendingClaimOut(
                claim_id="CLM1004",
                associate_id=eff_assoc,
                claim_type_name="Appeals Submission - Standard",
                category="Appeals",
                due_date=now + timedelta(days=5),
                days_until_due=5,
                urgency="ON_TRACK",
                standard_minutes=18.0
            )
        ]

    pending_list = []
    for r in records:
        assign_d = r.start_time
        due_d = assign_d + timedelta(days=3) if assign_d else now + timedelta(days=3)
        due_tz = due_d if getattr(due_d, "tzinfo", None) else due_d.replace(tzinfo=timezone.utc)
        diff_days = int((due_tz - now).total_seconds() / 86400.0)

        if diff_days < 0:
            urgency = "OVERDUE"
        elif diff_days <= 2:
            urgency = "DUE_SOON"
        else:
            urgency = "ON_TRACK"

        pending_list.append(
            PendingClaimOut(
                claim_id=r.claim_id,
                associate_id=r.associate_id,
                claim_type_name="Clean Claim Follow-up",
                category="AR Follow-up",
                due_date=due_d,
                days_until_due=diff_days,
                urgency=urgency,
                standard_minutes=14.0
            )
        )

    pending_list.sort(key=lambda x: x.due_date or now)
    return pending_list

