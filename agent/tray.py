import threading
from typing import Callable, Optional

try:
    import pystray
    from PIL import Image, ImageDraw
except ImportError:
    pystray = None
    Image = None
    ImageDraw = None


class TrayIcon:
    """System tray icon showing active claim status and controls."""

    def __init__(
        self,
        associate_id: str,
        on_open_dialog: Optional[Callable[[], None]] = None,
        on_exit: Optional[Callable[[], None]] = None
    ):
        self.associate_id = associate_id
        self.on_open_dialog = on_open_dialog
        self.on_exit = on_exit
        self.active_claim = "No Active Claim"
        self._icon = None

    def _create_image(self):
        # Generate simple 64x64 blue dot icon
        img = Image.new("RGBA", (64, 64), color=(0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        draw.ellipse([8, 8, 56, 56], fill="#38bdf8", outline="#0284c7", width=3)
        return img

    def update_claim(self, claim_id: Optional[str]):
        self.active_claim = claim_id or "No Active Claim"
        if self._icon:
            self._icon.title = f"TMS ({self.associate_id}) - {self.active_claim}"

    def run_detached(self):
        if not pystray or not Image:
            return

        def setup():
            menu = pystray.Menu(
                pystray.MenuItem(lambda text: f"Status: {self.active_claim}", None, enabled=False),
                pystray.MenuItem(lambda text: f"Associate: {self.associate_id}", None, enabled=False),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("Set Active Claim...", lambda: self.on_open_dialog and self.on_open_dialog()),
                pystray.MenuItem("Exit TMS Agent", lambda: self.on_exit and self.on_exit())
            )
            self._icon = pystray.Icon("TMS", self._create_image(), f"TMS - {self.active_claim}", menu)
            self._icon.run()

        t = threading.Thread(target=setup, daemon=True)
        t.start()
