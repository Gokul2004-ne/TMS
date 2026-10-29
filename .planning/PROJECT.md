# NovaArc TMS (Time & Motion Study) System

## Executive Summary
NovaArc TMS is an enterprise-grade automated Time & Motion Study (TMS) and Productivity Tracking platform designed for healthcare Revenue Cycle Management (RCM) billing associates. The system pairs a low-latency, resilient desktop agent with a modern real-time Web Dashboard and an Aiven Cloud PostgreSQL backend to track associate activity, quantify Average Handling Time (AHT) per claim, calculate idle vs. active time, auto-sync claim statuses from the NovaArc RCM platform, and export daily performance summaries to Excel.

## Core Capabilities
1. **Desktop Activity Telemetry (`agent/`)**:
   - Ultra-low latency Win32 event detection monitoring browser URLs, active windows, and 3-pillar healthcare page identities (website name, page header, 1-3 word operational purpose).
   - Low-level modal locking for the Claim Work Assistant dialog (`agent/dialog.py`) with minimized chip restoration and taskbar preservation.
   - Intelligent login/logout detection on NovaArc RCM (`https://krishna-caare.github.io/Novaarc-RCM/`) ensuring instantaneous prompt upon sign-in.
   - Bidirectional event emission with dual-sync across local engine and cloud backend.
2. **Cloud Backend & Database (`backend/`)**:
   - High-throughput asynchronous FastAPI service deployed on Catalyst AppSail (`https://tms-backend-50047231328.development.catalystappsail.in`).
   - Powered by **Aiven Cloud PostgreSQL 18.6** (`pg-6e76a1e-tms-novaarc.h.aivencloud.com:10058/defaultdb`) with SSL encryption and zero dependency on Supabase.
   - Comprehensive REST APIs for active claims, claim completion, status reconciliation, real-time metrics, and live claim deep dives.
3. **Web Analytics Dashboard (`dashboard/`)**:
   - React + TypeScript + Vite responsive dashboard (`http://localhost:5173`).
   - Live KPI cards: Active Time, Idle Time, Total Claims Handled, Average Handling Time (AHT) with dynamic benchmark color-coding (Green/Amber/Red).
   - Interactive Claim Deep Dive tab providing second-by-second chronological timelines and audit trails.
   - Automated Excel report generation (`TMS_Completed_Claims.xlsx`) upon claim resolution.

## Environment & Infrastructure
- **Operating System**: Windows 11 Enterprise / Pro
- **Cloud Backend**: Catalyst AppSail (Python 3.11 runtime)
- **Database**: Aiven PostgreSQL 18.6 (Region: `asia-south1`, Host: `pg-6e76a1e-tms-novaarc.h.aivencloud.com`, Port: `10058`)
- **Frontend Dashboard**: React 18, Tailwind CSS, Lucide icons, Vite
- **Desktop Agent Runtime**: Python 3.14 / Compiled Standalone Binary (`TMS-Agent.exe`) with `Start-Agent.bat` launcher

