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
        # The board hides its buttons until a tap; most checks click them directly, so keep them awake.
        _raw_new_context = browser.new_context
        def _awake_context(*a, **k):
            c = _raw_new_context(*a, **k); c.add_init_script("window.__agendaKeepAwake = true"); return c
        browser.new_context = _awake_context
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
        on = NINJA in (page.get_attribute("#frame", "src") or "") and page.get_attribute("#ninjaToggle", "aria-checked") == "true"
        page.click("#dayToggle"); page.wait_for_timeout(200)
        if_on = page.get_attribute("#dayToggle", "aria-checked") == "true" and page.evaluate("window.__agendaBoard.dayType(new Date())") == "if"
        if shots_dir:
            page.screenshot(path=str(shots_dir / "ninja_menu.png"))
        page.click("#dayToggle"); page.click("#ninjaToggle"); page.wait_for_timeout(200)
        off = AGENDA in (page.get_attribute("#frame", "src") or "") and page.get_attribute("#ninjaToggle", "aria-checked") == "false" \
            and page.get_attribute("#dayToggle", "aria-checked") == "false"
        page.click("#closeMenu")
        ok = on and off and if_on
        print(("PASS" if ok else "FAIL"), f"{'menu switches: ninja + IF day':34s} on={on} off={off}")
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

        # Warm-up timer: open, pick 3 min, start, pause/resume, hide, finishes -> pops back up, auto-tucks away
        ctx = browser.new_context(viewport={"width": 1600, "height": 900}, timezone_id="America/New_York")
        ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
        page = ctx.new_page()
        page.clock.install(time="2026-11-06T07:46:00")
        page.goto(f"http://127.0.0.1:{PORT}/index.html")
        page.wait_for_timeout(300)
        T = lambda: page.evaluate("window.__agendaBoard.timer()")
        page.click("#btnTimer"); page.click("#tPresets [data-min='3']")
        a = T()
        page.click("#tGo"); page.clock.fast_forward("01:00")
        b = T()
        page.click("#tGo"); page.clock.fast_forward("00:30"); c = T()      # paused: no change
        page.click("#tGo"); page.click("#tClose"); d = T()
        if shots_dir:
            page.click("#btnTimer"); page.clock.fast_forward("01:45"); page.wait_for_timeout(300)
            page.screenshot(path=str(shots_dir / "timer_low.png")); page.click("#tClose")
            page.clock.fast_forward("00:20")
        else:
            page.clock.fast_forward("02:05")
        e = T()
        if shots_dir:
            page.click("#tBig"); page.wait_for_timeout(200); page.screenshot(path=str(shots_dir / "timer_done_big.png")); page.click("#tBig")
        page.clock.fast_forward("00:13"); f = T()
        page.reload(); page.wait_for_timeout(300); page.click("#btnTimer"); g = T()   # remembers 3 min
        ok = (a["text"] == "3:00" and b["text"] == "2:00" and b["state"] == "run" and c["text"] == "2:00"
              and c["state"] == "pause" and not d["open"] and e["state"] == "done" and e["open"] and e["text"] == "0:00"
              and f["state"] == "idle" and not f["open"] and g["text"] == "3:00")
        print(("PASS" if ok else "FAIL"), f"{'warm-up timer':34s} {[x['state'] + ' ' + x['text'] for x in (a, b, c, d, e, f, g)]}")
        failures += 0 if ok else 1
        ctx.close()

        # Pack-up alert: 6 min before the bell, once per block, then a "bell in" pill until the bell
        def packctx(t, extra_init=None):
            c = browser.new_context(viewport={"width": 1600, "height": 900}, timezone_id="America/New_York")
            c.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
            if extra_init: c.add_init_script(extra_init)
            pg = c.new_page(); pg.clock.install(time=t); pg.goto(f"http://127.0.0.1:{PORT}/index.html"); pg.wait_for_timeout(300)
            return c, pg
        ctx, page = packctx("2026-11-06T08:29:50")            # regular 1st ends 8:36
        P = lambda: page.evaluate("window.__agendaBoard.pack()")
        a = P(); page.clock.fast_forward("00:15"); b = P()
        if shots_dir: page.screenshot(path=str(shots_dir / "packup.png"))
        page.clock.fast_forward("00:12"); c = P()
        page.clock.fast_forward("00:40"); d = P()
        if shots_dir: page.screenshot(path=str(shots_dir / "packup_pill.png"))
        page.reload(); page.wait_for_timeout(300); e = P()    # no repeat after a reload
        page.clock.fast_forward("06:00"); f = P()              # past 8:36, bell rang
        ok = (not a["open"] and b["open"] and b["flash"] and c["open"] and not c["flash"] and not d["open"]
              and d["pill"].startswith("🎒 Pack up · class change in 5:") and not e["open"] and e["pill"] and not f["pill"] and not f["open"])
        print(("PASS" if ok else "FAIL"), f"{'pack-up alert (regular 1st)':34s} {[a, b, c, d, e, f]}" if not ok else "pack-up alert (regular 1st)")
        failures += 0 if ok else 1
        ctx.close()
        ctx, page = packctx("2026-11-10T08:19:30")            # IF 1st ends 8:25
        ok = page.evaluate("window.__agendaBoard.pack()")["open"]
        print(("PASS" if ok else "FAIL"), "pack-up alert (IF day schedule)")
        failures += 0 if ok else 1
        ctx.close()
        ctx, page = packctx("2026-11-06T08:31:00", "localStorage.setItem('agendaBoard.settings', JSON.stringify({packMinutes: 0}))")
        p0 = page.evaluate("window.__agendaBoard.pack()")
        ok = not p0["open"] and not p0["pill"]
        print(("PASS" if ok else "FAIL"), "pack-up alert off when set to 0")
        failures += 0 if ok else 1
        ctx.close()

        # Closing scores: panel shows today's column, taps save through the web app, slide reloads on close
        import json as _json
        from urllib.parse import urlparse, parse_qs
        state = {"days": ["MON", "WED", "THURS", "FRI"], "rows": ["Effort", "Performance", "Attitude"],
                 "values": [["", "", "", ""], ["2", "", "", ""], ["", "", "", ""]]}
        calls = []
        def fake_script(route):
            q = {k: v[0] for k, v in parse_qs(urlparse(route.request.url).query, keep_blank_values=True).items()}
            calls.append(q)
            if q.get("k") != "KEY":
                return route.fulfill(status=200, content_type="application/json", body=_json.dumps({"ok": False, "error": "Wrong key"}))
            if q.get("a") == "set":
                r = state["rows"].index(q["row"]); c = state["days"].index(q["day"]); state["values"][r][c] = q["v"]
            route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"},
                          body=_json.dumps(dict(state, ok=True, block=q.get("block"))))
        init = "localStorage.setItem('agendaBoard.settings', JSON.stringify({closingUrl: 'https://script.google.com/macros/s/X/exec?k=KEY'}))"
        ctx = browser.new_context(viewport={"width": 1600, "height": 900}, timezone_id="America/New_York")
        ctx.add_init_script(init)
        loads = []
        def gstub(r):
            loads.append(r.request.url); r.fulfill(status=200, content_type="text/html", body="<p>stub</p>")
        ctx.route("https://docs.google.com/**", gstub)
        ctx.route("https://script.google.com/**", fake_script)
        page = ctx.new_page()
        page.clock.install(time="2026-11-06T10:10:00")            # Friday, 3rd Block
        page.goto(f"http://127.0.0.1:{PORT}/index.html"); page.wait_for_timeout(300)
        S = lambda: page.evaluate("window.__agendaBoard.scores()")
        can = S()["can"]
        page.click("#btnScores"); page.wait_for_timeout(300)
        today = page.inner_text(".s-h.today")
        page.click("#sGrid button[data-r='0'][data-v='3']"); page.click("#sGrid button[data-r='2'][data-v='1']")
        page.wait_for_timeout(500)
        if shots_dir: page.screenshot(path=str(shots_dir / "closing_scores.png"))
        saved = state["values"][0][3] == "3" and state["values"][2][3] == "1" and S()["msg"].startswith("Saved")
        sets = [c for c in calls if c.get("a") == "set"]
        order_ok = [(c["row"], c["day"], c["v"], c["block"]) for c in sets] == [("Effort", "FRI", "3", "3rd"), ("Attitude", "FRI", "1", "3rd")]
        n_before = len(loads); page.click("#sClose"); page.wait_for_timeout(200)
        reloaded = len(loads) > n_before
        ok = can and today.startswith("FRI") and saved and order_ok and reloaded and not S()["open"]
        print(("PASS" if ok else "FAIL"), f"{'closing scores save + reload':34s}" + ("" if ok else f" {can} {today} {saved} {order_ok} {reloaded} {sets}"))
        failures += 0 if ok else 1
        # hidden on welcome screen and on Band Ninja days; Tuesday has no column
        page.clock.fast_forward("02:00:00"); page.wait_for_timeout(300)    # 12:10 lunch -> welcome
        hid = not S()["can"]
        ctx.close()
        ctx = browser.new_context(viewport={"width": 1600, "height": 900}, timezone_id="America/New_York")
        ctx.add_init_script(init)
        ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
        ctx.route("https://script.google.com/**", fake_script)
        page = ctx.new_page(); page.clock.install(time="2026-11-10T10:00:00")   # IF Tuesday = Band Ninja slide
        page.goto(f"http://127.0.0.1:{PORT}/index.html"); page.wait_for_timeout(300)
        ninja_hidden = not S()["can"]
        page.click("#btnMenu"); page.click("#ninjaToggle"); page.click("#closeMenu"); page.wait_for_timeout(200)
        page.click("#btnScores"); page.wait_for_timeout(300)
        no_col = "no column for today" in S()["msg"] and page.locator("#sGrid button[data-r]").count() == 0
        ok = hid and ninja_hidden and no_col
        print(("PASS" if ok else "FAIL"), f"{'closing scores hidden/no column':34s}" + ("" if ok else f" {hid} {ninja_hidden} {no_col} {S()['msg']}"))
        failures += 0 if ok else 1
        ctx.close()

        # End of class with closing scores: pack-up (6:00) counts down to the scoreboard (2:00), which runs until class change
        state["values"] = [["", "", "", ""], ["", "", "", ""], ["", "", "", ""]]
        ctx = browser.new_context(viewport={"width": 1600, "height": 900}, timezone_id="America/New_York")
        ctx.add_init_script(init)
        ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
        ctx.route("https://script.google.com/**", fake_script)
        page = ctx.new_page(); page.clock.install(time="2026-11-06T08:30:05")   # Friday 1st, class change 8:36
        page.goto(f"http://127.0.0.1:{PORT}/index.html"); page.wait_for_timeout(600)
        P = lambda: page.evaluate("window.__agendaBoard.pack()")
        a1 = P(); line1 = page.inner_text("#packBell")
        page.clock.fast_forward("01:00"); a2 = P()                          # 8:31: still up (no 45 s close)
        page.clock.fast_forward("03:00"); page.wait_for_timeout(300)         # 8:34:05 -> scoreboard
        b = S(); pk = P()
        page.click("#sGrid button[data-r='1'][data-v='2']"); page.wait_for_timeout(400)
        if shots_dir: page.screenshot(path=str(shots_dir / "scoreboard.png"))
        desc_on = page.locator(".s-desc div.on").count() == 1
        up_name = page.inner_text("#sGrid .s-lab.up .s-name")                      # Performance scored first: Effort still up
        page.click("#sGrid button[data-r='0'][data-v='3']"); page.wait_for_timeout(300)
        up_next = page.inner_text("#sGrid .s-lab.up .s-name")                     # then Attitude (Performance done)
        desc_on = desc_on and up_name == "Effort" and up_next == "Attitude" and page.locator("#sGrid .s-today.later").count() == 0
        page.click("#sClose"); page.wait_for_timeout(200); pill = P()["pill"]
        page.click("#packPill"); page.wait_for_timeout(200); reopened = S()["big"]
        page.clock.fast_forward("02:00"); page.wait_for_timeout(300); c = S()   # 8:36:05 class change
        ok = (a1["open"] and line1.startswith("Closing scores in 3:5") and a2["open"] and b["open"] and b["big"]
              and b["change"].startswith("Class change in 1:5") and not pk["open"] and state["values"][1][3] == "2" and state["values"][0][3] == "3" and desc_on
              and pill.startswith("★ Closing scores · class change in") and reopened and not c["open"] and not c["big"])
        print(("PASS" if ok else "FAIL"), f"{'end of class: pack-up -> scoreboard':34s}" + ("" if ok else f" {a1} {line1} {a2} {b} {pk} {state['values']} {desc_on} {pill} {reopened} {c}"))
        failures += 0 if ok else 1
        ctx.close()

        # Test mode: menu button jumps to just before pack-up on the next school day; test runs never save scores
        ctx = browser.new_context(viewport={"width": 1600, "height": 900}, timezone_id="America/New_York")
        ctx.add_init_script(init)
        ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
        ctx.route("https://script.google.com/**", fake_script)
        page = ctx.new_page(); page.clock.install(time="2026-11-07T10:15:00")      # Saturday
        page.goto(f"http://127.0.0.1:{PORT}/index.html"); page.wait_for_timeout(300)
        page.click("#btnMenu"); page.click("#testEnd"); page.wait_for_timeout(500)
        url_ok = "test=2026-11-09T08:29:45&speed=5" in page.url and page.is_visible("#testBar")
        ctx.close()
        calls.clear(); state["values"] = [["", "", "", ""], ["", "", "", ""], ["", "", "", ""]]
        ctx = browser.new_context(viewport={"width": 1600, "height": 900}, timezone_id="America/New_York")
        ctx.add_init_script(init)
        ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
        ctx.route("https://script.google.com/**", fake_script)
        page = ctx.new_page()
        page.goto(f"http://127.0.0.1:{PORT}/index.html?test=2026-11-09T08:29:50&speed=60")   # real clock, 60x
        page.wait_for_timeout(1500); p1 = page.evaluate("window.__agendaBoard.pack()")       # ~8:31: pack-up
        page.wait_for_timeout(3500); s1 = S()                                             # ~8:34:30: scoreboard (Monday column)
        today_ok = page.inner_text(".s-h.today").startswith("MON") if s1["open"] else False
        if s1["open"]: page.click("#sGrid button[data-r='0'][data-v='3']"); page.wait_for_timeout(400)
        if shots_dir: page.screenshot(path=str(shots_dir / "test_mode.png"))
        page.wait_for_timeout(2500); s2 = S()                                             # past 8:36
        no_save = not any(c.get("a") == "set" for c in calls) and state["values"][0][0] == ""
        ok = url_ok and p1["open"] and s1["big"] and today_ok and not s2["open"] and no_save
        print(("PASS" if ok else "FAIL"), f"{'test mode (menu + no saving)':34s}" + ("" if ok else f" {url_ok} {p1} {s1} {today_ok} {s2} {no_save} {calls}"))
        failures += 0 if ok else 1
        ctx.close()

        # Rhythm of the day: button on agenda slides only, opens a zoomed copy of the block's slide, tap to go back
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, timezone_id="America/New_York")
        ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
        page = ctx.new_page(); page.clock.install(time="2026-11-06T10:10:00")      # Friday 3rd Block
        page.goto(f"http://127.0.0.1:{PORT}/index.html"); page.wait_for_timeout(300)
        Rh = lambda: page.evaluate("window.__agendaBoard.rhythm()")
        r0 = Rh(); page.click("#btnRhythm"); page.wait_for_timeout(300); r1 = Rh()
        if shots_dir: page.screenshot(path=str(shots_dir / "rhythm_big.png"))
        page.mouse.click(960, 900); page.wait_for_timeout(200); r2 = Rh()
        # math: the card (with padding) fills ~96% of the width; frame is the whole slide, offset to the card
        w_ok = 1800 <= r1["view"][0] <= 1850 and abs(r1["frame"][0] / r1["frame"][1] - 9144000 / 5143500) < 0.01 and r1["frame"][2] < 0 and r1["frame"][3] < 0
        page.clock.fast_forward("01:00:00"); page.wait_for_timeout(300); r3 = Rh()   # 11:10 -> 4th block: copy dropped
        ok = (r0["can"] and not r0["open"] and r1["open"] and "slide=id.g3f643065e38_0_0" in r1["src"] and w_ok
              and not r2["open"] and r3["src"] == "")
        print(("PASS" if ok else "FAIL"), f"{'rhythm big view':34s}" + ("" if ok else f" {r0} {r1} {r2} {r3}"))
        failures += 0 if ok else 1
        ctx.close()

        # No-flash refresh: the 5-minute reload loads behind the slide on screen, then swaps; badge says only "Tap for auto"
        ctx = browser.new_context(viewport={"width": 1600, "height": 900}, timezone_id="America/New_York")
        ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
        page = ctx.new_page(); page.clock.install(time="2026-11-06T10:00:00")
        page.goto(f"http://127.0.0.1:{PORT}/index.html"); page.wait_for_timeout(300)
        F = lambda: page.evaluate("[...document.querySelectorAll('#agenda iframe')].map(f => [f.id, f.className])")
        f0 = F(); page.clock.fast_forward("05:01"); page.wait_for_timeout(200); f1 = F()
        page.clock.fast_forward("00:03"); page.wait_for_timeout(700); f2 = F()
        page.click("#btnMenu"); page.click("text=6th Block"); page.wait_for_timeout(200)
        btxt = page.inner_text("#overrideBadge")
        ok = (f0 == [["frame", ""]] and len(f1) == 2 and ["frame", "pending"] in f1 and f2 == [["frame", ""]] and btxt.strip() == "Tap for auto")
        print(("PASS" if ok else "FAIL"), f"{'no-flash refresh + short badge':34s}" + ("" if ok else f" {f0} {f1} {f2} {btxt!r}"))
        failures += 0 if ok else 1
        ctx.close()

        # Buttons hide on an agenda slide after 10 s; a tap on the slide shows them; taps never reach the slide
        ctx = _raw_new_context(viewport={"width": 1600, "height": 900}, timezone_id="America/New_York")
        ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
        page = ctx.new_page(); page.clock.install(time="2026-11-06T10:00:00")
        page.goto(f"http://127.0.0.1:{PORT}/index.html"); page.wait_for_timeout(300)
        O = lambda: page.evaluate("[getComputedStyle(document.getElementById('corner')).opacity, getComputedStyle(document.getElementById('btnTimer')).opacity]")
        page.clock.fast_forward("00:06"); page.wait_for_timeout(400); hidden = O()
        top = page.evaluate("document.elementFromPoint(800, 450).id")
        page.mouse.click(800, 450); page.wait_for_timeout(400); shown = O()
        page.click("#btnTimer"); opened = page.is_visible("#timer")
        ok = hidden == ["0", "0"] and top == "tapCatch" and shown == ["1", "1"] and opened
        print(("PASS" if ok else "FAIL"), f"{'buttons hide until a tap':34s}" + ("" if ok else f" {hidden} {top} {shown} {opened}"))
        failures += 0 if ok else 1
        ctx.close()

        # Method book: button only when a Drive link is set; opens Drive's /preview; closes on ✕ and at class change
        ctx = browser.new_context(viewport={"width": 1600, "height": 900}, timezone_id="America/New_York")
        ctx.add_init_script("localStorage.setItem('agendaBoard.settings', JSON.stringify({bookUrl: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing'}))")
        ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
        ctx.route("https://drive.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>book</p>"))
        page = ctx.new_page(); page.clock.install(time="2026-11-06T10:10:00")
        page.goto(f"http://127.0.0.1:{PORT}/index.html"); page.wait_for_timeout(300)
        B = lambda: page.evaluate("window.__agendaBoard.book()")
        b0 = B(); page.click("#btnBook"); page.wait_for_timeout(200); b1 = B()
        page.click("#bookClose"); b2 = B()
        page.click("#btnBook"); page.clock.fast_forward("00:15:00"); page.wait_for_timeout(300); b3 = B()   # 10:25 -> 4th block
        ok = (b0["has"] and not b0["open"] and b1["open"] and b1["src"] == "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/preview"
              and not b2["open"] and not b3["open"])
        print(("PASS" if ok else "FAIL"), f"{'method book viewer':34s}" + ("" if ok else f" {b0} {b1} {b2} {b3}"))
        failures += 0 if ok else 1
        ctx.close()

        # Settings from the sheet: the script's a=config supplies the method book link; the board saves it
        def cfg_script(route):
            q = {k: v[0] for k, v in parse_qs(urlparse(route.request.url).query, keep_blank_values=True).items()}
            body = {"ok": True, "config": {"Method book PDF link": "https://drive.google.com/file/d/1ZyXwVuTsRqPoNmLkJiHgFeDcBa98765/view"}} \
                if q.get("a") == "config" else dict(state, ok=True)
            route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body=_json.dumps(body))
        ctx = browser.new_context(viewport={"width": 1600, "height": 900}, timezone_id="America/New_York")
        ctx.add_init_script(init)
        ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
        ctx.route("https://script.google.com/**", cfg_script)
        page = ctx.new_page(); page.clock.install(time="2026-11-06T10:10:00")
        page.goto(f"http://127.0.0.1:{PORT}/index.html"); page.wait_for_timeout(300)
        before = page.evaluate("window.__agendaBoard.book().has")
        page.clock.fast_forward("00:03"); page.wait_for_timeout(400)
        after = page.evaluate("window.__agendaBoard.book().has")
        stored = page.evaluate("JSON.parse(localStorage.getItem('agendaBoard.settings')).bookUrl")
        ok = (not before) and after and stored.endswith("1ZyXwVuTsRqPoNmLkJiHgFeDcBa98765/view")
        print(("PASS" if ok else "FAIL"), f"{'settings from the sheet':34s}" + ("" if ok else f" {before} {after} {stored}"))
        failures += 0 if ok else 1
        ctx.close()

        # Setup code: warning when the closing link is missing; the code restores it from an encrypted setup.json
        import importlib.util, tempfile, os as _os
        spec = importlib.util.spec_from_file_location("make_setup", str(ROOT / "tools" / "make_setup.py"))
        ms = importlib.util.module_from_spec(spec); spec.loader.exec_module(ms)
        tmpf = tempfile.NamedTemporaryFile(suffix=".json", delete=False).name
        ms.make({"closingUrl": "https://script.google.com/macros/s/TEST/exec?k=TESTKEY"}, "AB3D5F7H", tmpf)
        setup_body = open(tmpf).read(); _os.unlink(tmpf)
        ctx = browser.new_context(viewport={"width": 1600, "height": 900}, timezone_id="America/New_York")
        ctx.route("**/setup.json*", lambda r: r.fulfill(status=200, content_type="application/json", body=setup_body))
        ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
        ctx.route("https://script.google.com/**", lambda r: r.fulfill(status=200, content_type="application/json",
                  headers={"Access-Control-Allow-Origin": "*"}, body='{"ok":true,"config":{}}'))
        page = ctx.new_page(); page.clock.install(time="2026-11-06T12:00:00")     # lunch: welcome screen
        page.goto(f"http://127.0.0.1:{PORT}/index.html"); page.wait_for_timeout(400)
        w1 = page.inner_text("#warns")
        if shots_dir: page.screenshot(path=str(shots_dir / "warns.png"))
        page.click("#warns button[data-w='setup']"); page.fill("#setupCode", "ab3d-5f7j"); page.click("#setupGo")
        page.wait_for_function("document.getElementById('setupMsg').textContent.length > 12", timeout=20000)
        bad = page.inner_text("#setupMsg")
        page.fill("#setupCode", "ab3d-5f7h"); page.click("#setupGo")
        page.wait_for_function("document.getElementById('setupMsg').textContent.indexOf('Restored') >= 0", timeout=20000)
        url = page.evaluate("window.__agendaBoard.settings().closingUrl")
        page.wait_for_timeout(400); w2 = page.inner_text("#warns")
        ok = ("aren't connected" in w1 and "didn't work" in bad and url.endswith("k=TESTKEY") and "aren't connected" not in w2)
        print(("PASS" if ok else "FAIL"), f"{'setup code + warnings':34s}" + ("" if ok else f" {w1!r} {bad!r} {url!r} {w2!r}"))
        failures += 0 if ok else 1
        ctx.close()

        # Metronome in the rhythm view: count-off numbers in the title, then dots keep time; tapping it never closes the view
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, timezone_id="America/New_York")
        ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
        page = ctx.new_page()
        page.goto(f"http://127.0.0.1:{PORT}/index.html?test=2026-11-06T10:05:00&speed=1"); page.wait_for_timeout(400)
        M = lambda: page.evaluate("window.__agendaBoard.metro()")
        page.click("#btnRhythm"); page.wait_for_timeout(300)
        page.click("#mFaster"); page.click("#mFaster"); page.click("#mBeats button[data-b='3']")
        m0 = M()
        page.click("#mGo"); page.wait_for_timeout(450); m1 = M()                     # 88 bpm, 3 beats: inside the count-off
        if shots_dir: page.screenshot(path=str(shots_dir / "metronome_countoff.png"))
        page.wait_for_timeout(2600); m2 = M()                                         # past the count-off bar (~2 s)
        if shots_dir: page.screenshot(path=str(shots_dir / "metronome.png"))
        still_open = page.evaluate("window.__agendaBoard.rhythm().open")
        page.mouse.click(960, 1040); page.wait_for_timeout(200); m3 = M()             # tap outside: closes view + stops
        ok = (m0["bpm"] == 88 and m0["beats"] == 3 and m1["on"] and m1["title"] in ("1", "2", "3") and m2["on"]
              and m2["title"].startswith("RHYTHM OF THE DAY") and "1" in m2["dot"] and still_open and not m3["on"]
              and not page.evaluate("window.__agendaBoard.rhythm().open"))
        print(("PASS" if ok else "FAIL"), f"{'metronome count-off':34s}" + ("" if ok else f" {m0} {m1} {m2} {still_open} {m3}"))
        failures += 0 if ok else 1
        ctx.close()

        # Welcome screen pass-offs this week, and the pass-off line count on Band Ninja days (counts only)
        def stats_script(route):
            q = {k: v[0] for k, v in parse_qs(urlparse(route.request.url).query, keep_blank_values=True).items()}
            if q.get("a") == "stats":
                body = {"ok": True, "quarter": "Q2", "blocks": [{"block": b, "week": w, "quarter": qq, "today": 0}
                        for b, w, qq in [("1st", 14, 61), ("3rd", 9, 40), ("4th", 17, 52), ("6th", 6, 22), ("7th", 3, 15)]]}
            elif q.get("a") == "line":
                body = {"ok": True, "block": q.get("block"), "waiting": 4, "passedToday": 11}
            else:
                body = {"ok": True, "config": {}}
            route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body=_json.dumps(body))
        def stats_ctx(t):
            c = browser.new_context(viewport={"width": 1920, "height": 1080}, timezone_id="America/New_York")
            c.add_init_script(init)
            c.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body='<body style="background:#1f2a44"></body>'))
            c.route("https://script.google.com/**", stats_script)
            pg = c.new_page(); pg.clock.install(time=t); pg.goto(f"http://127.0.0.1:{PORT}/index.html"); pg.wait_for_timeout(300)
            pg.clock.fast_forward("00:03"); pg.wait_for_timeout(500)
            return c, pg
        ctx, page = stats_ctx("2026-11-06T12:00:00")          # lunch: welcome
        st = page.evaluate("window.__agendaBoard.stats()")
        lead = page.inner_text("#stats .st.lead b")
        if shots_dir: page.mouse.click(5, 5); page.wait_for_timeout(800); page.screenshot(path=str(shots_dir / "welcome_stats.png"))
        ctx.close()
        ctx, page = stats_ctx("2026-11-10T10:00:00")          # IF Tuesday 3rd: Band Ninja slide
        ln = page.evaluate("window.__agendaBoard.stats()")["line"]
        if shots_dir: page.screenshot(path=str(shots_dir / "line_pill.png"))
        ctx.close()
        ok = st["shown"] and "PASS-OFFS THIS WEEK" in st["text"] and lead == "4TH BLOCK" and "Q2: 61" in st["text"] \
            and "4 waiting" in ln and "11 passed today" in ln
        print(("PASS" if ok else "FAIL"), f"{'welcome stats + line count':34s}" + ("" if ok else f" {st} {lead!r} {ln!r}"))
        failures += 0 if ok else 1
        browser.close()

    httpd.shutdown()
    total = len(CASES) + 1 + 7 + 1 + 3 + 2 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1
    print(f"\n{total - failures}/{total} passed")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
