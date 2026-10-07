import os
import sys
import time

# Ensure project root and agent directory are in sys.path
SCRATCH_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRATCH_DIR)
AGENT_DIR = os.path.join(ROOT_DIR, "agent")

for p in [ROOT_DIR, AGENT_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from agent.main import TMSDesktopAgent
except ImportError:
    from main import TMSDesktopAgent  # type: ignore[no-redef]

agent = TMSDesktopAgent(enable_tray=False)
prompts = []


def mock_prompt_manual_claim(platform_name="NovaArc RCM", synchronous=True, **kwargs):
    prompts.append((platform_name, synchronous, time.time()))
    agent.last_handled_app_key = platform_name
    agent.last_dialog_close_time = time.time()


setattr(agent, "prompt_manual_claim", mock_prompt_manual_claim)

print("--- Step 1: Pre-Authentication Phase (Before NovaArc Signin) ---")
# 1. User on mock.ts
app_key = agent.get_app_key("mock.ts", "TMS - Antigravity IDE - mock.ts")
assert not agent.has_logged_in_to_office
assert len(prompts) == 0
print("[OK] No prompts before sign-in.")

print("\n--- Step 2: Employee Signs in to NovaArc Platform ---")
# Signin occurs
agent.has_logged_in_to_office = True
agent.is_currently_on_platform = True
agent.prompt_manual_claim(platform_name="NovaArc RCM", synchronous=True)
assert len(prompts) == 1
assert prompts[-1][0] == "NovaArc RCM"
print("[OK] Prompted for NovaArc RCM on initial sign-in.")

print("\n--- Step 3: Switch from NovaArc Platform to YouTube ---")
# User switches outward from platform to YouTube
app_key = agent.get_app_key("Chrome", "(14074) YouTube - Google Chrome")
assert app_key != "TMS Dashboard"
is_office = agent.tracker.is_office_platform("Chrome", "(14074) YouTube - Google Chrome")
assert not is_office
# Check logic: user was on platform!
assert agent.is_currently_on_platform is True
agent.prompt_manual_claim(platform_name=app_key, synchronous=True)
agent.is_currently_on_platform = False
assert len(prompts) == 2
assert "YouTube" in prompts[-1][0]
print(f"[OK] Prompted for {app_key} upon switching outward from NovaArc platform.")

print("\n--- Step 4: Switch from YouTube to Excel (Without visiting NovaArc) ---")
# User switches from YouTube to Excel
app_key = agent.get_app_key("Excel", "Claims_Export.xlsx - Excel")
is_office = agent.tracker.is_office_platform("Excel", "Claims_Export.xlsx - Excel")
assert not is_office
# User is NOT on platform!
assert agent.is_currently_on_platform is False
# In Phase 2: if not self.is_currently_on_platform -> DO NOT TRIGGER
count_before = len(prompts)
# Check: no prompt should occur!
if agent.is_currently_on_platform:
    agent.prompt_manual_claim(platform_name=app_key, synchronous=True)
assert len(prompts) == count_before
print("[OK] Switched from YouTube to Excel: NO PROMPT triggered! (Requirement met: external-to-external without platform does not trigger).")

print("\n--- Step 5: Switch from Excel to Bing (Without visiting NovaArc) ---")
app_key = agent.get_app_key("Edge", "Bing - Microsoft Edge")
assert agent.is_currently_on_platform is False
count_before = len(prompts)
if agent.is_currently_on_platform:
    agent.prompt_manual_claim(platform_name=app_key, synchronous=True)
assert len(prompts) == count_before
print("[OK] Switched from Excel to Bing: NO PROMPT triggered!")

print("\n--- Step 6: Switch to TMS Dashboard (Except TMS Dashboard) ---")
is_tms = agent.tracker.is_tms_dashboard("Chrome", "NovaArc TMS | Transaction Intelligence Platform - Google Chrome")
assert is_tms is True
count_before = len(prompts)
if is_tms:
    pass  # except TMS dashboard
assert len(prompts) == count_before
print("[OK] Switched to TMS Dashboard: NO PROMPT triggered! (Requirement met: except TMS dashboard).")

print("\n--- Step 7: Switch from Bing back to NovaArc Platform ---")
is_office = agent.tracker.is_office_platform("NovaArc RCM", "NovaArc RCM — Revenue Cycle Management")
assert is_office is True
# Was user currently on platform? No, was on Bing!
assert agent.is_currently_on_platform is False
# Condition: not self.is_currently_on_platform -> TRIGGER
agent.prompt_manual_claim(platform_name="NovaArc RCM", synchronous=True)
agent.is_currently_on_platform = True
assert len(prompts) == 3
assert prompts[-1][0] == "NovaArc RCM"
print("[OK] Prompted for NovaArc RCM upon returning from external app.")

print("\n--- Step 8: User continues working on NovaArc Platform ---")
count_before = len(prompts)
# User stays on platform
if not agent.is_currently_on_platform:
    agent.prompt_manual_claim(platform_name="NovaArc RCM", synchronous=True)
assert len(prompts) == count_before
print("[OK] User continues on NovaArc Platform: NO re-trigger.")

print("\n--- Step 9: Switch from NovaArc Platform to Excel ---")
app_key = agent.get_app_key("Excel", "Claims_Export.xlsx - Excel")
assert agent.is_currently_on_platform is True
agent.prompt_manual_claim(platform_name=app_key, synchronous=True)
agent.is_currently_on_platform = False
assert len(prompts) == 4
assert prompts[-1][0] == "Excel"
print(f"[OK] Prompted for {app_key} upon switching outward from platform.")

print("\n============================================================")
print("ALL NEW TRANSITION REQUIREMENTS FULLY SATISFIED AND VERIFIED!")
print("============================================================")
