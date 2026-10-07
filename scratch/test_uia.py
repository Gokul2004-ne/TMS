import time
import win32gui
import ctypes
import comtypes
from comtypes import client

def inspect_window(hwnd):
    title = win32gui.GetWindowText(hwnd)
    print(f"HWND: {hwnd}, Title: {title}")
    try:
        mod = client.GetModule("UIAutomationCore.dll")
        uia = client.CreateObject(mod.CUIAutomation, interface=mod.IUIAutomation)
        elem = uia.ElementFromHandle(hwnd)
        if not elem:
            print("No elem")
            return
        
        # Test finding terms
        for term in ["Sign in", "Sign out", "Dashboard", "Claims", "Work Queues", "Welcome back"]:
            cond = uia.CreatePropertyCondition(30005, term)
            t0 = time.time()
            found = elem.FindFirst(4, cond) # TreeScope_Descendants
            dt = time.time() - t0
            print(f"Term '{term}': found={found is not None} in {dt:.3f}s")
    except Exception as e:
        print("Error:", e)

# Find any Chrome or Edge window
def cb(hwnd, _):
    if win32gui.IsWindowVisible(hwnd):
        title = win32gui.GetWindowText(hwnd)
        if any(b in title for b in ["Chrome", "Edge", "NovaArc"]):
            inspect_window(hwnd)

win32gui.EnumWindows(cb, None)
