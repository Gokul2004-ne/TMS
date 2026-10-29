# Requirements Baseline & Verification Contract

## 1. Authentication & Platform Trigger Lifecycle
- **REQ-AUTH-01 (Sign-In Detection)**: When an associate navigates to NovaArc RCM and completes sign-in, the agent must detect `is_authenticated == True` and immediately pop the Claim Work Assistant dialog.
- **REQ-AUTH-02 (Pre-Auth Silence)**: While on the sign-in screen (`#/login`, `/login`, `signin`), the agent must NOT pop the dialog prematurely.
- **REQ-AUTH-03 (Logout Context Reset)**: When an associate logs out of NovaArc, the agent must immediately reset active claim context to `UNASSIGNED`, reset authentication flags, clear URL caches, and re-arm Phase 1 so subsequent logins trigger the dialog without delay.

## 2. Modal Claim Work Assistant (`agent/dialog.py`)
- **REQ-DLG-01 (Taskbar Preservation)**: The dialog MUST NEVER hide Windows Desktop Taskbar (`Shell_TrayWnd` or `Shell_SecondaryTrayWnd`). Taskbar must remain visible and unblocked at all times.
- **REQ-DLG-02 (Zero White Box Latency)**: Tkinter dialog initialization must not contain blocking synchronous network calls. Dialog must render completely in <15ms.
- **REQ-DLG-03 (App Switch Guard)**: If the user switches away from NovaArc to an external application before the dialog appears, the agent must abort showing the dialog over the external app and defer until the user returns to NovaArc.
- **REQ-DLG-04 (Return to Platform Trigger)**: Returning from an external application back to NovaArc must pop the dialog if no claim is active or if switching back to platform context.
- **REQ-DLG-05 (Locking & Minimized Mode)**: While dialog is open in modal mode, outside clicks and tab switching are constrained. Clicking 'Claims Section' minimizes the dialog to a floating chip; clicking the chip restores full size.

## 3. Real-Time Tracking, AHT & Dashboard Deep Dive
- **REQ-TRK-01 (Instant Live Tracking)**: Clicking 'Start Working' in the dialog sets the claim in both local context and cloud backend, immediately starting the live AHT stopwatch in the Dashboard.
- **REQ-TRK-02 (Dynamic Status & Type Sync)**: If the claim status is updated in NovaArc's claims section (e.g., from `DENIED` to `PAID` or `RESUBMIT`), the agent must detect the change within 1-2 seconds, adjust the target AHT benchmark, and sync to the Dashboard and database.
- **REQ-TRK-03 (Claim Deep Dive)**: The Dashboard's Claim Deep Dive tab must display all chronological event timelines, application switches, and URL visits for the selected claim.
- **REQ-TRK-04 (Excel Export & Database Persistence)**: Claim completions and status changes must persist into Aiven PostgreSQL and append to `TMS_Completed_Claims.xlsx`.

## 4. Database & Infrastructure
- **REQ-DB-01 (Aiven PostgreSQL Cloud)**: All backend operations must persist to Aiven Cloud PostgreSQL 18.6 (`pg-6e76a1e-tms-novaarc.h.aivencloud.com:10058/defaultdb`). Supabase connections are retired.
- **REQ-LAUNCH-01 (Smart App Control Resilience)**: The desktop agent must provide a signed or Python-based launcher (`Start-Agent.bat`) that runs smoothly without Windows 11 Smart App Control publisher verification blocks.
