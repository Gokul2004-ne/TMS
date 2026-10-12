"""Unit tests for Universal Website, Sub-page Heading, and 1-3 Word Used For Resolution Engine."""

import pytest
from agent.tracker import WindowTracker
from backend.routes.associate import enrich_event_details


@pytest.fixture
def tracker():
    return WindowTracker()


TEST_SCENARIOS = [
    # 1. Community Care Plan / MHS claims vs eligibility
    (
        "Chrome",
        "Community Care Plan - Guest Claims Status - Google Chrome",
        "https://epiclink.mhs.net/GuestEligWrapper/guest_claims_main.asp?claim=123",
        "Community Care Plan",
        "Guest Claims Status",
        "Claim Status"
    ),
    (
        "Chrome",
        "Community Care Plan - Guest Eligibility Verification - Google Chrome",
        "https://epiclink.mhs.net/GuestEligWrapper/guesteligwrapper.asp",
        "Community Care Plan",
        "Guest Eligibility Verification",
        "Member Eligibility"
    ),
    (
        "Edge",
        "Find a Claim | Community Care Plan - Microsoft Edge",
        "https://communitycareplan.com/claims",
        "Community Care Plan",
        "Find a Claim",
        "Claim Status"
    ),
    # 2. NovaArc RCM platform subpages
    (
        "NovaArc RCM",
        "NovaArc RCM - Claims Management",
        "http://localhost:5173/claims",
        "NovaArc RCM",
        "Claims Management",
        "Claim Adjudication"
    ),
    (
        "NovaArc RCM",
        "NovaArc RCM - Priority Work Queues",
        "http://localhost:5173/work-queues",
        "NovaArc RCM",
        "Priority Work Queues",
        "Work Queue AR"
    ),
    (
        "NovaArc RCM",
        "NovaArc RCM - Operations Dashboard",
        "http://localhost:5173/dashboard",
        "NovaArc RCM",
        "Operations Dashboard",
        "Operations Overview"
    ),
    (
        "NovaArc RCM",
        "NovaArc RCM - Denial Resolution & Appeals",
        "http://localhost:5173/denials",
        "NovaArc RCM",
        "Denial Resolution & Appeals",
        "Denial Resolution"
    ),
    (
        "NovaArc RCM",
        "NovaArc RCM - Remittance & Payment Posting",
        "http://localhost:5173/payments",
        "NovaArc RCM",
        "Remittance & Payment Posting",
        "Payment Posting"
    ),
    # 3. Arbitrary Healthcare & Enterprise Websites
    (
        "Chrome",
        "(14) Pull Requests · Gokul2004-ne/TMS · GitHub - Google Chrome",
        "https://github.com/Gokul2004-ne/TMS/pulls",
        "GitHub",
        "Pull Requests - Gokul2004-ne/TMS",
        "Version Control"
    ),
    (
        "Chrome",
        "Patient Appointments - AthenaHealth - Google Chrome",
        "https://athenahealth.com/portal/appointments",
        "AthenaHealth",
        "Patient Appointments",
        "Patient Records"
    ),
    (
        "Edge",
        "Invoices - Stripe - Microsoft Edge",
        "https://stripe.com/dashboard/invoices",
        "Stripe",
        "Invoices",
        "Billing & Invoicing"
    ),
    (
        "Chrome",
        "Inbox - Workday - Google Chrome",
        "https://app.workday.com/wday/authgwy/inbox",
        "Workday",
        "Inbox",
        "Work Queue AR"
    ),
    (
        "Chrome",
        "Medical Billing Tutorial - YouTube - Google Chrome",
        "https://www.youtube.com/watch?v=123",
        "YouTube",
        "Medical Billing Tutorial",
        "Media Playback"
    ),
    (
        "Chrome",
        "Florida Blue Provider Phone Number - Google Search - Google Chrome",
        "https://www.google.com/search?q=florida+blue",
        "Google Search",
        "Florida Blue Provider Phone Number",
        "Payer Lookup"
    ),
    (
        "Chrome",
        "https://custom-health-portal.org/records/patient-102",
        "https://custom-health-portal.org/records/patient-102",
        "Custom Health Portal",
        "Records Patient 102",
        "Patient Records"
    ),
    (
        "Chrome",
        "Quarterly Compliance Review - Acme Corp - Google Chrome",
        "https://acme-corp.com/compliance/review",
        "Acme Corp",
        "Quarterly Compliance Review",
        "Quarterly Compliance"
    ),
    # 4. Desktop Tools
    (
        "Excel",
        "Medicare_Fee_Schedule_2026.xlsx - Excel",
        "",
        "Microsoft Excel",
        "Medicare_Fee_Schedule_2026.xlsx Worksheet",
        "Rate Lookup"
    ),
    (
        "Notepad",
        "Scratch_Notes.txt - Notepad",
        "",
        "Notepad",
        "Operational Scratchpad Notes",
        "Scratchpad Notes"
    ),
    (
        "MS Teams",
        "RCM General - Microsoft Teams",
        "",
        "Microsoft Teams",
        "Internal Team Collaboration",
        "Team Consultation"
    ),
]


@pytest.mark.parametrize("app,title,url,expected_site,expected_hdr,expected_used", TEST_SCENARIOS)
def test_tracker_resolve_page_identity(tracker, app, title, url, expected_site, expected_hdr, expected_used):
    clean_url, site, hdr, used = tracker.resolve_page_identity(app, title, url)
    
    assert site == expected_site
    assert hdr == expected_hdr
    assert used == expected_used
    
    # Strictly enforce 1 to 3 words
    word_count = len(used.split())
    assert 1 <= word_count <= 3, f"used_for must be 1 to 3 words: '{used}' has {word_count} words"


@pytest.mark.parametrize("app,title,url,expected_site,expected_hdr,expected_used", TEST_SCENARIOS)
def test_backend_enrich_event_details(app, title, url, expected_site, expected_hdr, expected_used):
    result = enrich_event_details(app, title, url, "", "")
    
    assert result["website_name"] == expected_site
    assert result["page_header"] == expected_hdr
    assert result["used_for"] == expected_used
    
    # Strictly enforce 1 to 3 words
    word_count = len(result["used_for"].split())
    assert 1 <= word_count <= 3, f"used_for must be 1 to 3 words: '{result['used_for']}' has {word_count} words"
