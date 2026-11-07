"""Smoke tests for agenda-board.

Serves the repo locally, freezes the browser clock at chosen times,
and checks which block (or the welcome screen) is on screen.
Google Slides requests are stubbed so tests run offline.

Run:  python3 tests/smoke.py            (checks only)
      python3 tests/smoke.py --shots DIR (also saves screenshots)
"""
import http.server
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8765

# (label, ISO local time, expected shown)
# Nov 2026: Tue 10 = IF day, Wed 11 / Fri 6 = regular, Sat 7 = weekend
CASES = [
    ("regular before school",       "2026-11-06T07:30:00", "welcome"),
    ("regular 1st lead-in",         "2026-11-06T07:43:00", "1st"),
    ("regular 1st mid",             "2026-11-06T08:10:00", "1st"),
    ("regular 2nd planning",        "2026-11-06T09:00:00", "welcome"),
    ("regular 3rd",                 "2026-11-06T10:00:00", "3rd"),
    ("regular 3rd last minute",     "2026-11-06T10:19:30", "3rd"),
    ("regular 3rd->4th passing",    "2026-11-06T10:20:30", "4th"),
    ("regular 6th last minute",     "2026-11-06T13:44:30", "6th"),
    ("regular 6th->7th passing",    "2026-11-06T13:45:10", "7th"),
    ("IF 3rd->4th passing",         "2026-11-10T10:33:30", "4th"),
    ("regular 4th",                 "2026-11-06T11:00:00", "4th"),
    ("regular lunch",               "2026-11-06T12:00:00", "welcome"),
    ("regular 6th",                 "2026-11-06T13:30:00", "6th"),
    ("regular 7th",                 "2026-11-06T14:10:00", "7th"),
    ("regular after school",        "2026-11-06T14:45:00", "welcome"),
    ("IF 1st",                      "2026-11-10T08:20:00", "1st"),
    ("IF block (planning)",         "2026-11-10T09:30:00", "welcome"),
    ("IF 3rd (regular would be 4th)", "2026-11-10T10:25:00", "3rd"),
    ("IF 7th",                      "2026-11-10T14:20:00", "7th"),
    ("weekend",                     "2026-11-07T10:00:00", "welcome"),
]

SHOTS = {"regular before school", "regular 3rd", "IF 3rd (regular would be 4th)"}

STUB_SLIDE = """<!doctype html><html><body style="margin:0;background:#fff;font:48px sans-serif;
display:flex;align-items:center;justify-content:center;height:100vh">STUB SLIDE: {sid}</body></html>"""


class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def log_message(self, *a):
        pass


def main():
    shots_dir = None
    if "--shots" in sys.argv:
        shots_dir = Path(sys.argv[sys.argv.index("--shots") + 1])
        shots_dir.mkdir(parents=True, exist_ok=True)

    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), Quiet)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    failures = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chromium")
        for label, iso, expected in CASES:
            ctx = browser.new_context(viewport={"width": 1600, "height": 900}, timezone_id="America/New_York")

            def stub(route):
                url = route.request.url
                sid = url.split("slide=id.")[1].split("&")[0] if "slide=id." in url else "none"
                route.fulfill(status=200, content_type="text/html", body=STUB_SLIDE.format(sid=sid))

            ctx.route("https://docs.google.com/**", stub)
            page = ctx.new_page()
            page.clock.set_fixed_time(iso)
            page.goto(f"http://127.0.0.1:{PORT}/index.html")
            page.wait_for_timeout(400)
            shown = page.evaluate("window.__agendaBoard.shown()")
            ok = shown == expected
            if expected != "welcome":
                src = page.get_attribute("#frame", "src") or ""
                key = "ninjaBlocks" if label.startswith("IF") else "blocks"
                sid = page.evaluate(f"window.__agendaBoard.settings().{key}['{expected}']")
                ok = ok and f"slide=id.{sid}" in src and "/embed?" in src
            print(("PASS" if ok else "FAIL"), f"{label:34s} expected={expected:8s} got={shown}")
            failures += 0 if ok else 1
            if shots_dir and label in SHOTS:
                page.wait_for_timeout(300)
                page.screenshot(path=str(shots_dir / (label.replace(" ", "_").replace(">", "").replace("(", "").replace(")", "") + ".png")))
            ctx.close()

        # Band Ninja Day: IF days use the Band_Ninja_Day deck, one slide per grade
        NINJA = "1HLmyd7srbW3C_vkgyAofsAeZ3T4afLs5PmqXTEIKIYU"
        AGENDA = "1GVCu1ReJy-BPLXHb7omH8ijtz_c-XRWcftUtRguLMjY"
        ninja_cases = [
            ("ninja IF 1st -> 8th grade",  "2026-11-10T08:00:00", "1st", NINJA, "p3"),
            ("ninja IF 3rd -> 7th grade",  "2026-11-10T10:00:00", "3rd", NINJA, "p2"),
            ("ninja IF 4th -> 7th grade",  "2026-11-10T11:00:00", "4th", NINJA, "p2"),
            ("ninja IF 6th -> 6th grade",  "2026-11-10T13:00:00", "6th", NINJA, "p1"),
            ("ninja IF 7th -> 6th grade",  "2026-11-10T14:00:00", "7th", NINJA, "p1"),
            ("regular day keeps agenda",   "2026-11-11T10:00:00", "3rd", AGENDA, "g3f643065e38_0_0"),
        ]
        for label, iso, blk, deck, sid in ninja_cases:
            ctx = browser.new_context(viewport={"width": 1600, "height": 900}, timezone_id="America/New_York")
            ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
            page = ctx.new_page()
            page.clock.set_fixed_time(iso)
            page.goto(f"http://127.0.0.1:{PORT}/index.html")
            page.wait_for_timeout(300)
            src = page.get_attribute("#frame", "src") or ""
            shown = page.evaluate("window.__agendaBoard.shown()")
            ok = shown == blk and f"/d/{deck}/embed?" in src and f"slide=id.{sid}" in src
            print(("PASS" if ok else "FAIL"), f"{label:34s} got={shown} src={src[40:110]}")
            failures += 0 if ok else 1
            if shots_dir and label.startswith("ninja IF 3rd"):
                page.screenshot(path=str(shots_dir / "ninja_if_3rd.png"))
            ctx.close()

        # Menu toggle: turn Band Ninja Day on for a regular day, then off again
        ctx = browser.new_context(viewport={"width": 1600, "height": 900}, timezone_id="America/New_York")
        ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
        page = ctx.new_page()
        page.clock.install(time="2026-11-11T10:00:00")
        page.goto(f"http://127.0.0.1:{PORT}/index.html")
        page.wait_for_timeout(300)
        page.click("#btnMenu"); page.click("#ninjaToggle"); page.wait_for_timeout(200)
        on = NINJA in (page.get_attribute("#frame", "src") or "")
        if shots_dir:
            page.click("#btnMenu")
            page.screenshot(path=str(shots_dir / "ninja_menu.png"))
            page.click("#closeMenu")
        page.click("#btnMenu"); page.click("#ninjaToggle"); page.wait_for_timeout(200)
        off = AGENDA in (page.get_attribute("#frame", "src") or "")
        ok = on and off
        print(("PASS" if ok else "FAIL"), f"{'ninja toggle on/off from menu':34s} on={on} off={off}")
        failures += 0 if ok else 1
        ctx.close()

        # Manual override: pick 6th during 3rd block, it should stick until 3rd ends, then go automatic
        ctx = browser.new_context(viewport={"width": 1600, "height": 900}, timezone_id="America/New_York")
        ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
        page = ctx.new_page()
        page.clock.install(time="2026-11-06T10:00:00")
        page.goto(f"http://127.0.0.1:{PORT}/index.html")
        page.wait_for_timeout(300)
        page.click("#btnMenu")
        page.click("text=6th Block")
        page.wait_for_timeout(200)
        s1 = page.evaluate("window.__agendaBoard.shown()")
        if shots_dir:
            page.click("#btnMenu")
            page.screenshot(path=str(shots_dir / "override_menu.png"))
            page.click("#closeMenu")
        page.clock.fast_forward("16:00")  # 10:16 still inside 3rd
        s2 = page.evaluate("window.__agendaBoard.shown()")
        page.clock.fast_forward("10:00")  # 10:26 -> 4th, override expired
        s3 = page.evaluate("window.__agendaBoard.shown()")
        ok = (s1, s2, s3) == ("6th", "6th", "4th")
        print(("PASS" if ok else "FAIL"), f"{'manual override expires':34s} got={(s1, s2, s3)}")
        failures += 0 if ok else 1
        ctx.close()
        browser.close()

    httpd.shutdown()
    total = len(CASES) + 1 + 7
    print(f"\n{total - failures}/{total} passed")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
