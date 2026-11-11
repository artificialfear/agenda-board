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
_RESULTS = [0]
import builtins as _bi
_print = _bi.print
def print(*a, **k):
    if a and isinstance(a[0], str) and a[0] in ("PASS", "FAIL"): _RESULTS[0] += 1
    _print(*a, **k)
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
        step4 = page.inner_text("#packStep4")
        if shots_dir: page.screenshot(path=str(shots_dir / "packup.png"))
        page.clock.fast_forward("00:12"); c = P()
        page.clock.fast_forward("00:40"); d = P()
        if shots_dir: page.screenshot(path=str(shots_dir / "packup_pill.png"))
        page.reload(); page.wait_for_timeout(300); e = P()    # no repeat after a reload
        page.clock.fast_forward("06:00"); f = P()              # past 8:36, bell rang
        ok = (not a["open"] and b["open"] and b["flash"] and c["open"] and not c["flash"] and not d["open"]
              and d["pill"].startswith("🎒 Pack up · class change in 5:") and not e["open"] and e["pill"] and not f["pill"] and not f["open"]
              and step4 == "Have a seat and be ready for rehearsal scores")
        print(("PASS" if ok else "FAIL"), f"{'pack-up alert (regular 1st)':34s} {[a, b, c, d, e, f]}" if not ok else "pack-up alert (regular 1st)")
        failures += 0 if ok else 1
        ctx.close()
        ctx, page = packctx("2026-11-10T08:19:30")            # IF 1st ends 8:25
        ok = page.evaluate("window.__agendaBoard.pack()")["open"] and page.inner_text("#packStep4") == "Have a seat and be ready for class change"
        if shots_dir: page.screenshot(path=str(shots_dir / "packup_ninja.png"))
        print(("PASS" if ok else "FAIL"), "pack-up alert (IF day schedule, Band Ninja: no scores)")
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

        # Warnings on the welcome screen: closing link missing; "tap once" for sound until the first touch
        ctx = browser.new_context(viewport={"width": 1600, "height": 900}, timezone_id="America/New_York")
        ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
        page = ctx.new_page(); page.clock.install(time="2026-11-06T12:00:00")     # lunch: welcome screen
        page.goto(f"http://127.0.0.1:{PORT}/index.html"); page.wait_for_timeout(400)
        w1 = page.inner_text("#warns")
        if shots_dir: page.screenshot(path=str(shots_dir / "warns.png"))
        page.mouse.click(800, 450); page.wait_for_timeout(900); w2 = page.inner_text("#warns")
        ok = "aren't connected" in w1 and "Tap the board once" in w1 and "Tap the board once" not in w2 and "aren't connected" in w2
        print(("PASS" if ok else "FAIL"), f"{'welcome warnings':34s}" + ("" if ok else f" {w1!r} {w2!r}"))
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

        # Show counts in the rhythm view: hidden at first, then lined up under the real image (a=rhythm)
        import base64 as _b64, os as _os
        rpng = _os.path.join(_os.path.dirname(__file__), "..", "tools", "rhythm", "out", "8th_4-4_004.png")
        # the board's own counts file (site root); the real picture too when tools/rhythm/out is here
        rbytes = _json.load(open(_os.path.join(_os.path.dirname(__file__), "..", "rhythm-counts.json")))["lines"]["8th_4-4_004.png"]["b"]
        rstate = {"bytes": rbytes}
        img = ("data:image/png;base64," + _b64.b64encode(open(rpng, "rb").read()).decode()) if _os.path.exists(rpng) else ""
        slide_html = ('<body style="margin:0;background:#1f2a44"><div style="position:absolute;left:4.494%;top:24.711%;width:55.501%;'
                      'height:11.022%;background:#fff;border-radius:6px"></div>'
                      + (f'<img src="{img}" style="position:absolute;left:6.6048%;top:25.0117%;width:51.2905%;height:10.4209%">' if img else "")
                      + '</body>')
        rcalls = []
        def rhythm_script(route):
            q = {k: v[0] for k, v in parse_qs(urlparse(route.request.url).query, keep_blank_values=True).items()}
            rcalls.append(q.get("a"))
            body = ({"ok": True, "block": q.get("block"), "set": "8th", "name": "8th_4-4_004.png", "meter": "4/4", "bytes": rstate["bytes"]}
                    if q.get("a") == "rhythm" else {"ok": True, "config": {}})
            route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body=_json.dumps(body))
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, timezone_id="America/New_York")
        ctx.add_init_script(init)
        ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body=slide_html))
        ctx.route("https://script.google.com/**", rhythm_script)
        page = ctx.new_page(); page.clock.install(time="2026-11-06T08:10:00")      # Friday 1st Block
        page.goto(f"http://127.0.0.1:{PORT}/index.html"); page.wait_for_timeout(300)
        page.click("#btnRhythm"); page.wait_for_timeout(600)
        c0 = page.evaluate("window.__agendaBoard.rhythm().counts")
        vis0 = page.evaluate("getComputedStyle(document.querySelector('#rCounts span')).visibility")
        if shots_dir: page.screenshot(path=str(shots_dir / "rhythm_counts_hidden.png"))
        page.click("#mCounts"); page.wait_for_timeout(200)
        c1 = page.evaluate("window.__agendaBoard.rhythm()")
        vis1 = page.evaluate("getComputedStyle(document.querySelector('#rCounts span')).visibility")
        if shots_dir: page.screenshot(path=str(shots_dir / "rhythm_counts.png"))
        page.mouse.click(960, 1060); page.wait_for_timeout(200)                     # tap outside closes; reopening hides the counts again
        page.click("#btnRhythm"); page.wait_for_timeout(400)
        c2 = page.evaluate("window.__agendaBoard.rhythm().counts")
        rstate["bytes"] = 12345                                                      # old picture still in Drive: no counts, a note instead
        page.mouse.click(960, 1060); page.wait_for_timeout(200); page.click("#btnRhythm"); page.wait_for_timeout(400)
        page.click("#mCounts"); page.wait_for_timeout(200)
        c3 = page.evaluate("window.__agendaBoard.rhythm().counts")
        L = c1["counts"]["lefts"]
        ok = (c0["can"] and not c0["shown"] and c0["btn"] == "Show counts" and vis0 == "hidden"
              and c1["open"] and c1["counts"]["shown"] and vis1 == "visible" and c1["counts"]["btn"] == "Hide counts"
              and c1["counts"]["text"].startswith("1 ") and "(3)" in c1["counts"]["text"] and c1["counts"]["dim"] >= 1
              and L == sorted(L) and 0 < L[0] and L[-1] < c1["view"][0] and c1["counts"]["font"] >= 28
              and not c2["shown"] and "new rhythm pictures" in c3["text"] and c3["dim"] == 0 and rcalls.count("rhythm") >= 3)
        print(("PASS" if ok else "FAIL"), f"{'rhythm show counts':34s}" + ("" if ok else f" {c0} {vis0} {c1} {vis1} {c2} {c3} {rcalls}"))
        failures += 0 if ok else 1
        ctx.close()
        # without a closing link there is no counts button
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, timezone_id="America/New_York")
        ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
        page = ctx.new_page(); page.clock.install(time="2026-11-06T08:10:00")
        page.goto(f"http://127.0.0.1:{PORT}/index.html"); page.wait_for_timeout(300); page.click("#btnRhythm"); page.wait_for_timeout(200)
        ok = (not page.evaluate("window.__agendaBoard.rhythm().counts.can") and not page.is_visible("#mCounts"))
        print(("PASS" if ok else "FAIL"), "rhythm counts need the closing link")
        failures += 0 if ok else 1
        ctx.close()

        # 🌍 World map: button opens map/ full screen; songs, search, country cards; ✕ inside the map closes it; class change closes it
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, timezone_id="America/New_York")
        ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
        page = ctx.new_page()
        page.goto(f"http://127.0.0.1:{PORT}/index.html?test=2026-11-06T08:10:00&speed=1"); page.wait_for_timeout(400)
        vis = page.is_visible("#btnMap")
        page.click("#btnMap"); page.wait_for_timeout(200)
        fr = page.frame_locator("#mapFrame")
        mf = None
        for _ in range(40):
            mf = next((f for f in page.frames if "/map/" in f.url), None)
            if mf and mf.evaluate("!!window.__map"): break
            page.wait_for_timeout(150)
        n = mf.evaluate("window.__map.songs.length")
        mf.evaluate("window.__map.pickSong(window.__map.songs.find(s => s.n === '116'))"); page.wait_for_timeout(300)
        card = mf.inner_text("#cardBody")
        mf.fill("#search", "dreidel"); page.wait_for_timeout(100); res = mf.inner_text("#results")
        mf.evaluate("window.__map.pickCountry('Japan')"); page.wait_for_timeout(200); jp = mf.inner_text("#cardBody")
        mf.evaluate("window.__map.setMode('mystery')"); page.wait_for_timeout(200)
        my = mf.evaluate("window.__map.mystery()"); clues = mf.inner_text("#mClues")
        hidden = all(w.lower() not in c["t"].lower() for c in my["clues"] for w in [my["name"]])
        if shots_dir: page.screenshot(path=str(shots_dir / "map_mystery.png"))
        mf.evaluate("window.__map.setMode('map')")
        open1 = page.evaluate("document.getElementById('mapView').classList.contains('open')")
        mf.click("#close"); page.wait_for_timeout(200)
        open2 = page.evaluate("document.getElementById('mapView').classList.contains('open')")
        page.click("#btnMap"); page.wait_for_timeout(200)
        page.close(); page = ctx.new_page(); page.clock.install(time="2026-11-06T10:10:00")         # 3rd block
        page.goto(f"http://127.0.0.1:{PORT}/index.html"); page.wait_for_timeout(300)
        page.click("#btnMap"); page.wait_for_timeout(200)
        o3a = page.evaluate("document.getElementById('mapView').classList.contains('open')")
        page.clock.fast_forward("00:15:00"); page.wait_for_timeout(300)                              # 10:25 -> 4th block
        open3 = page.evaluate("document.getElementById('mapView').classList.contains('open')")
        ok = (vis and n >= 60 and "Vienna" in card and "Beethoven" in card and "miles" in card and "The Dreidel Song" in res
              and "Konnichiwa" in jp and "The Frog's Song" in jp and len(my["clues"]) == 4 and hidden and open1 and not open2 and o3a and not open3)
        print(("PASS" if ok else "FAIL"), f"{'world map':34s}" + ("" if ok else f" {vis} {n} {card[:80]!r} {res[:60]!r} {jp[:60]!r} {my} {open1} {open2} {o3a} {open3} {page.evaluate('window.__agendaBoard.shown()')}"))
        failures += 0 if ok else 1
        ctx.close()
        # the Content Pool sheet's map tabs win over the built-in list (a=map)
        def map_script(route):
            q = {k: v[0] for k, v in parse_qs(urlparse(route.request.url).query, keep_blank_values=True).items()}
            body = {"ok": True, "songs": [{"Book #": "999", "Title": "Test Tune", "Book says": "Made-up Folk Song", "Country": "Peru", "Place": "", "Lat": "", "Lon": "",
                      "Composer": "", "Fun fact": "Only in the test.", "YouTube link": "https://youtu.be/abcdefghijk", "Show": ""},
                     {"Book #": "1000", "Title": "Hidden Tune", "Country": "Peru", "Show": "No"}],
                    "composers": [], "countries": [{"Country": "Peru", "Known for": "Test llamas", "Fun fact": "", "Music fact": ""}]} if q.get("a") == "map" else {"ok": True, "config": {}}
            route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body=_json.dumps(body))
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, timezone_id="America/New_York")
        ctx.add_init_script("localStorage.setItem('agendaBoard.settings', JSON.stringify({closingUrl: 'https://script.google.com/macros/s/X/exec?k=KEY'}))")
        ctx.route("https://script.google.com/**", map_script)
        page = ctx.new_page(); page.goto(f"http://127.0.0.1:{PORT}/map/"); page.wait_for_function("!!window.__map", timeout=8000)
        songs = page.evaluate("window.__map.songs.map(s => s.title)")
        page.evaluate("window.__map.pickCountry('Peru')"); peru = page.inner_text("#cardBody")
        page.evaluate("window.__map.pickSong(window.__map.songs[0])"); listen = page.is_visible("[data-play]")
        ok = songs == ["Test Tune"] and "Test llamas" in peru and "Machu Picchu" in peru and listen
        print(("PASS" if ok else "FAIL"), f"{'world map from the sheet':34s}" + ("" if ok else f" {songs} {peru[:120]!r} {listen}"))
        failures += 0 if ok else 1
        ctx.close()

        # country-name check (11/10): friendly names / odd spacing land on the map; names it can't place are listed in
        # window.__map.unmatched (never on screen); every name in tools/map/names.js (the sheet's "Map Names" list) lands
        import subprocess
        all_names = _json.loads(subprocess.run(["node", str(ROOT / "tools" / "map" / "names.js"), "--json"], capture_output=True, text=True, check=True).stdout)
        def names_ctx(songs_rows, composers=(), countries=()):
            def h(route):
                q = {k: v[0] for k, v in parse_qs(urlparse(route.request.url).query, keep_blank_values=True).items()}
                body = {"ok": True, "songs": list(songs_rows), "composers": list(composers), "countries": list(countries)} if q.get("a") == "map" else {"ok": True, "config": {}}
                route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body=_json.dumps(body))
            c = browser.new_context(viewport={"width": 1920, "height": 1080}, timezone_id="America/New_York")
            c.add_init_script("localStorage.setItem('agendaBoard.settings', JSON.stringify({closingUrl: 'https://script.google.com/macros/s/X/exec?k=KEY'}))")
            c.route("https://script.google.com/**", h)
            pg = c.new_page(); pg.goto(f"http://127.0.0.1:{PORT}/map/"); pg.wait_for_function("!!window.__map", timeout=8000)
            return c, pg
        rows = [{"Book #": str(i), "Title": t, "Country": c} for i, (t, c) in enumerate([("Merengue", "Dominican Republic"), ("Spacey", " japan "),
                ("Coast", "Ivory Coast"), ("Yankee", "USA"), ("Wardrobe", "Narnia"), ("Lion City", "Singapore")])]
        ctx, page = names_ctx(rows, composers=[{"Composer": "Nobody", "Country": "Atlantis"}],
                              countries=[{"Country": "ivory coast", "Known for": "Test cocoa"}])
        got = page.evaluate("window.__map.songs.map(s => s.title + '=' + s.country)")
        un = page.evaluate("window.__map.unmatched")
        page.evaluate("window.__map.pickCountry(\"Côte d'Ivoire\")"); civ = page.inner_text("#cardBody")
        body = page.inner_text("body")
        ok = (got == ["Merengue=Dominican Rep.", "Spacey=Japan", "Coast=Côte d'Ivoire", "Yankee=United States of America"]
              and un == ["Map Songs: Narnia", "Map Songs: Singapore", "Map Composers: Atlantis"]
              and "Test cocoa" in civ and "Narnia" not in body and "Atlantis" not in body)
        print(("PASS" if ok else "FAIL"), f"{'map country names':34s}" + ("" if ok else f" {got} {un} {civ[:80]!r}"))
        failures += 0 if ok else 1
        ctx.close()
        ctx, page = names_ctx([{"Book #": str(i), "Title": "T" + str(i), "Country": n} for i, n in enumerate(all_names)])
        n_in = page.evaluate("window.__map.songs.length"); un = page.evaluate("window.__map.unmatched")
        ok = len(all_names) > 200 and n_in == len(all_names) and un == []
        print(("PASS" if ok else "FAIL"), f"{'map: every Map Names name lands':34s}" + ("" if ok else f" {len(all_names)} {n_in} {un[:5]}"))
        failures += 0 if ok else 1
        ctx.close()

        # 2.3.0 map: concert music (sheet rows with Book # "Concert" + Ensemble), Book/Concert filter, deep links, today's list,
        # class passport (a=passport), Mystery team scoring, Caribbean badges pushed apart so each is tappable
        PASS = {"1st": [{"title": "Joy", "n": "Concert", "country": "USA", "date": "2026-11-10", "how": "concert"}],
                "3rd": [{"title": "Theme from “The Nutcracker”", "n": "72", "country": "Russia", "date": "", "how": "start"},
                        {"title": "Carnival of Venice", "n": "66", "country": "Italy", "date": "", "how": "start"},
                        {"title": "Abundant Joy", "n": "Concert", "country": "United States of America", "date": "2026-11-10", "how": "concert"}],
                "4th": [], "6th": [], "7th": []}
        def m23(route):
            q = {k: v[0] for k, v in parse_qs(urlparse(route.request.url).query, keep_blank_values=True).items()}
            if q.get("a") == "map":
                base = _json.loads((ROOT / "map" / "data.json").read_text(encoding="utf-8"))
                rows = [{"Book #": s_["n"], "Title": s_["title"], "Book says": s_["label"], "Country": s_["country"], "Place": s_.get("place", ""),
                         "Lat": s_.get("lat", ""), "Lon": s_.get("lon", ""), "Composer": s_.get("composer", ""), "Fun fact": s_.get("fact", ""), "YouTube link": s_.get("yt", "")} for s_ in base["songs"]]
                rows += [{"Book #": "Concert", "Title": "Abundant Joy", "Book says": "Adrian B. Sims", "Country": "United States of America", "Place": "Seattle, Washington",
                          "Lat": "47.61", "Lon": "-122.33", "Composer": "Adrian B. Sims", "Ensemble": "7th Grade Band"},
                         {"Book #": "Concert", "Title": "March of the Frost Giants", "Book says": "Randall D. Standridge", "Country": "Norway", "Place": "Jotunheimen, Norway",
                          "Lat": "61.6", "Lon": "8.3", "Ensemble": "8th Grade Band"},
                         {"Book #": "901", "Title": "Made-up Haiti Tune", "Country": "Haiti"}, {"Book #": "902", "Title": "Made-up Merengue", "Country": "Dominican Republic"},
                         {"Book #": "72", "Title": "Made-up Book Two Tune", "Country": "Japan", "Book": "2"},
                         {"Book #": "143", "Title": "Made-up Grand March", "Country": "Egypt", "Book": "2"}]
                body = {"ok": True, "songs": rows, "composers": [{"Composer": "Adrian B. Sims", "Years": "born 2000", "Born year": "2000", "Era": "Today", "Country": "USA"}], "countries": []}
            elif q.get("a") == "passport":
                body = {"ok": True, "blocks": PASS}
            elif q.get("a") == "today":
                body = {"ok": True, "block": q.get("block"), "songs": [{"key": "72", "title": "x"}, {"key": "Abundant Joy", "title": "Abundant Joy"}] if q.get("block") == "3rd" else []}
            else:
                body = {"ok": True, "config": {}}
            route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body=_json.dumps(body))
        def m23_ctx():
            c = browser.new_context(viewport={"width": 1920, "height": 1080}, timezone_id="America/New_York")
            c.add_init_script("localStorage.setItem('agendaBoard.settings', JSON.stringify({closingUrl: 'https://script.google.com/macros/s/X/exec?k=KEY'}))")
            c.route("https://script.google.com/**", m23)
            c.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
            return c
        ctx = m23_ctx(); page = ctx.new_page()
        page.goto(f"http://127.0.0.1:{PORT}/map/?song=72"); page.wait_for_function("!!window.__map", timeout=8000); page.wait_for_timeout(300)
        deep = page.inner_text("#cardBody")
        page.evaluate("window.__map.pickSong(window.__map.songs.find(s => s.title === 'Abundant Joy'))"); page.wait_for_timeout(200)
        conc = page.inner_text("#cardBody")
        page.evaluate("window.__map.setMode('map')"); page.click("#setBar [data-set=concert]"); page.wait_for_timeout(200)
        onlyC = sorted(b["name"].split(":")[0] for b in page.evaluate("window.__map.badges()"))
        page.click("#setBar [data-set=book]"); page.wait_for_timeout(200)
        bookN = page.evaluate("window.__map.badges().length"); hasNo = any(b["name"].startswith("Norway") for b in page.evaluate("window.__map.badges()"))
        page.click("#setBar [data-set=all]"); page.click("#zHome"); page.wait_for_timeout(1000)
        import re as _re
        pos = {b["name"].split(":")[0]: tuple(map(float, _re.findall(r"-?[\d.]+", b["t"])[:2])) for b in page.evaluate("window.__map.badges()")}
        car = [pos[k] for k in ("Haiti", "Dominican Rep.", "Puerto Rico", "Jamaica") if k in pos]
        apart = len(car) == 4 and all(((a[0]-b[0])**2 + (a[1]-b[1])**2) ** .5 >= 33 for i, a in enumerate(car) for b in car[i+1:])
        page.evaluate("window.__map.show({today: ['72', 'Abundant Joy', 'nope'], block: '3rd'})"); page.wait_for_timeout(300)
        today = page.inner_text("#cardBody")
        deep, conc, today = deep.lower(), conc.lower(), today.lower()
        ok = ("nutcracker" in deep and "no. 72" in deep and "our concert music" in conc and "7th grade band" in conc
              and onlyC == ["Norway", "United States of America"] and not hasNo and bookN >= 20 and apart
              and "today in 3rd block" in today and "abundant joy" in today and "nutcracker" in today and "2 countries" in today)
        print(("PASS" if ok else "FAIL"), f"{'map: concert, links, today':34s}" + ("" if ok else f" {deep[:60]!r} {conc[:80]!r} {onlyC} {hasNo} {bookN} {car} {today[:120]!r}"))
        failures += 0 if ok else 1
        # 2.4.0 Book 2: "2-72" finds Book 2 No. 72 (plain 72 stays Book 1), its own filter button, its own list on the country card
        page.evaluate("window.__map.show({song: '2-72'})"); page.wait_for_timeout(300); b2card = page.inner_text("#cardBody").lower()
        page.evaluate("window.__map.setMode('map')"); page.click("#setBar [data-set=book2]"); page.wait_for_timeout(200)
        only2 = sorted(b["name"].split(":")[0] for b in page.evaluate("window.__map.badges()"))
        page.click("#setBar [data-set=book]"); page.wait_for_timeout(200)
        egInB1 = any(b["name"].startswith("Egypt") for b in page.evaluate("window.__map.badges()"))
        page.click("#setBar [data-set=all]"); page.wait_for_timeout(200)
        page.evaluate("window.__map.pickCountry ? window.__map.pickCountry('Japan') : null"); page.wait_for_timeout(200)
        jp = page.evaluate("(() => { const s = window.__map.songs.filter(x => x.country === 'Japan'); return s.map(x => x.book + ':' + x.n); })()")
        f143 = page.evaluate("(() => { window.__map.show({today: ['2-143', '72']}); return document.getElementById('cardBody').innerText; })()")
        ok = ("made-up book two tune" in b2card and "no. 72 · tradition of excellence 2" in b2card and only2 == ["Egypt", "Japan"] and not egInB1
              and "2:72" in jp and "1:" + next(x for x in jp if x.startswith("1:")).split(":")[1] in jp
              and "Made-up Grand March" in f143 and "Nutcracker" in f143 and "B2·143" in f143)
        print(("PASS" if ok else "FAIL"), f"{'map: Book 2':34s}" + ("" if ok else f" {b2card[:80]!r} {only2} {egInB1} {jp} {f143[:120]!r}"))
        failures += 0 if ok else 1
        # passport
        page.goto(f"http://127.0.0.1:{PORT}/map/?mode=passport&block=3rd"); page.wait_for_function("!!window.__map", timeout=8000); page.wait_for_timeout(600)
        pp = page.evaluate("window.__map.passport()"); cnt = page.inner_text("#passCount"); lst = page.inner_text("#passList")
        stampOn = page.evaluate("Array.from(document.querySelectorAll('path.land.stamp')).map(p => p.querySelector('title').textContent).sort()")
        dimN = page.evaluate("document.querySelectorAll('path.land.unstamp').length")
        page.click("#passList [data-pc=Italy]"); page.wait_for_timeout(300); itc = page.inner_text("#cardBody")
        page.click("#passBlocks [data-pb='1st']"); page.wait_for_timeout(200)
        cnt1 = page.inner_text("#passCount"); remembered = page.evaluate("localStorage.getItem('agendaMap.passBlock')")
        if shots_dir: page.screenshot(path=str(shots_dir / "map_passport.png"))
        ok = (pp["block"] == "3rd" and stampOn == ["Italy", "Russia", "United States of America"] and dimN > 100 and "3 countries" in cnt and "♪ 3 songs" in cnt
              and "NEW" in lst and "3rd block played (1)" in itc.lower() and "Carnival of Venice" in itc and "1 country" in cnt1 and remembered == "1st")
        print(("PASS" if ok else "FAIL"), f"{'map: class passport':34s}" + ("" if ok else f" {stampOn} {dimN} {cnt!r} {lst!r} {itc[:80]!r} {cnt1!r} {remembered}"))
        failures += 0 if ok else 1
        # mystery teams: 1 clue = 4 points, 2 clues = 3; tapping a team reveals; scores kept for today
        page.evaluate("window.__map.setMode('mystery')"); page.wait_for_timeout(200)
        page.click("#mTeams [data-tn='3']"); page.click("#mTeams [data-team='1']"); page.wait_for_timeout(200)
        s1 = page.evaluate("window.__map.teams().scores.slice()"); rev = page.evaluate("window.__map.mystery().revealed")
        page.click("#mTeams [data-team='0']"); s1b = page.evaluate("window.__map.teams().scores.slice()")   # after reveal: no points
        page.click("#mNew"); page.click("#mNext"); page.wait_for_timeout(100); pts = page.inner_text("#mTeams .pts")
        page.click("#mTeams [data-team='2']"); s2 = page.evaluate("window.__map.teams().scores.slice()")
        page.reload(); page.wait_for_function("!!window.__map", timeout=8000); kept = page.evaluate("window.__map.teams()")
        if shots_dir: page.evaluate("window.__map.setMode('mystery')"); page.screenshot(path=str(shots_dir / "map_teams.png"))
        ok = s1 == [0, 4, 0, 0] and rev and s1b == s1 and "= 3 points" in pts and s2 == [0, 4, 3, 0] and kept["n"] == 3 and kept["scores"] == [0, 4, 3, 0]
        print(("PASS" if ok else "FAIL"), f"{'map: mystery teams':34s}" + ("" if ok else f" {s1} {rev} {s1b} {pts!r} {s2} {kept}"))
        failures += 0 if ok else 1
        ctx.close()
        # board: 3rd Block agenda asks a=today -> gold "🌍 Today's music (2)"; it opens the map on that list
        ctx = m23_ctx(); page = ctx.new_page(); page.clock.install(time="2026-11-11T10:00:00")   # Wednesday: 3rd Block 9:29-10:20 (Tuesday IF = Band Ninja: no extras)
        page.goto(f"http://127.0.0.1:{PORT}/index.html"); page.wait_for_timeout(800)
        lab = page.inner_text("#btnMap"); gold = page.evaluate("document.getElementById('btnMap').classList.contains('has-today')")
        page.click("#btnMap"); mf = None
        for _ in range(60):
            mf = next((f for f in page.frames if "/map/" in f.url), None)
            if mf and mf.evaluate("!!window.__map"): break
            page.wait_for_timeout(150)
        page.wait_for_timeout(400)
        src = page.evaluate("document.getElementById('mapFrame').getAttribute('src')"); tc = mf.inner_text("#cardBody")
        ok = lab.strip() == "🌍 Today's music (2)" and gold and "today=72%7CAbundant%20Joy" in src and "block=3rd" in src and "today in 3rd block" in tc.lower()
        print(("PASS" if ok else "FAIL"), f"{'board: today\'s music button':34s}" + ("" if ok else f" {lab!r} {gold} {src} {tc[:80]!r} {page.evaluate('window.__agendaBoard.shown()')}"))
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
    total = _RESULTS[0]   # every PASS/FAIL line printed (was a hand-kept sum that fell behind)
    print(f"\n{total - failures}/{total} passed")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
