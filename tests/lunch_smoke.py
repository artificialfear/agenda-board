"""Lunch & Learn (2.6.0): menu switches, countdown + rules, pack-up at 5 minutes before the end, Brain Break, IF days.
Run: python3 tests/lunch_smoke.py [screenshot-folder]"""
import http.server, json, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
RESULTS = []


class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def log_message(self, *a):
        pass


def check(name, ok, extra=""):
    RESULTS.append(ok)
    print(("PASS" if ok else "FAIL"), f"{name:44s}" + ("" if ok else " " + str(extra)))


CHIMES = "() => { window.__chimes = []; const c0 = window.__board.chime; window.__board.chime = function (k) { window.__chimes.push(k); c0(k); }; }"


def main():
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Quiet)
    port = srv.server_address[1]
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    shots = sys.argv[1] if len(sys.argv) > 1 else None
    cfg = {"config": {}}

    def script(route):
        route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"},
                      body=json.dumps(dict({"ok": True, "songs": [], "blocks": []}, **cfg)))

    with sync_playwright() as p:
        browser = p.chromium.launch()

        def board(when, on=None, settings=None):
            ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, timezone_id="America/New_York")
            s = {"closingUrl": "https://script.google.com/macros/s/X/exec?k=KEY"}
            s.update(settings or {})
            init = "localStorage.setItem('agendaBoard.settings', JSON.stringify(%s));" % json.dumps(s)
            if on is not None:
                init += "localStorage.setItem('agendaBoard.lunchOn', JSON.stringify(%s));" % json.dumps(on)
            ctx.add_init_script(init)
            ctx.route("https://script.google.com/**", script)
            ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
            pg = ctx.new_page()
            pg.clock.install(time=when)
            pg.goto(f"http://127.0.0.1:{port}/index.html")
            pg.wait_for_timeout(400)
            pg.evaluate(CHIMES)
            return pg

        def is_open(pg):
            return pg.evaluate("document.getElementById('ll').classList.contains('open')")

        # 1) Off by default; the ☰ switch turns it on for today
        pg = board("2026-11-12T11:15:30")                       # Thursday, regular day
        check("off unless switched on", not is_open(pg))
        pg.click("#btnMenu"); pg.wait_for_timeout(100)
        sub = pg.inner_text("#llSub8th")
        check("menu shows 8th times", "11:15–11:40" in sub and "11:35" in sub, sub)
        pg.click("#llToggle8th"); pg.click("#closeMenu"); pg.wait_for_timeout(200)
        txt = pg.inner_text("#ll")
        check("opens with countdown to pack-up", is_open(pg) and "PACK UP IN" in txt.upper() and "19:30" in txt, txt[:160])
        check("three rules", pg.evaluate("document.querySelectorAll('#llRules li').length") == 3
              and "rinse out your mouth" in txt and "actively practicing" in txt and "large trashcan outside of the gym" in txt)
        check("says when to pack + leave", "Pack up at 11:35" in txt and "Brain Break at 11:40" in txt, txt)
        check("8th Grade chip", pg.inner_text("#llGrade") == "8th Grade")
        ch = pg.evaluate("window.__chimes"); check("no chime at the start", ch == [], ch)
        if shots:
            pg.screenshot(path=shots + "/lunch_learn.png")
        saved = pg.evaluate("JSON.parse(localStorage.getItem('agendaBoard.lunchOn'))")
        check("switch is saved for today only", saved == {"date": "2026-11-12", "8th": True}, saved)

        # 2) ✕ Hide → 🥪 button; pack-up opens it again by itself with a chime + flash and the four steps
        pg.click("#llHide"); pg.wait_for_timeout(100)
        check("hide → 🥪 button on the left bar", not is_open(pg) and pg.is_visible("#btnLunch"))
        pg.click("#btnLunch"); pg.wait_for_timeout(100)
        check("🥪 button brings it back", is_open(pg))
        pg.click("#llHide")
        pg.clock.fast_forward("19:27"); pg.wait_for_timeout(100)    # ~11:34:58
        check("still hidden one second before", not is_open(pg))
        pg.clock.run_for(3000); pg.wait_for_timeout(100)             # 11:35:00
        txt = pg.inner_text("#ll")
        check("pack-up at 11:35 reopens it", is_open(pg) and "BRAIN BREAK IN" in txt.upper() and "4:5" in txt, txt[:200])
        check("pack-up chime + flashing", pg.evaluate("window.__chimes") == ["pack"] and pg.evaluate("document.getElementById('ll').classList.contains('flash')"))
        steps = pg.evaluate("Array.from(document.querySelectorAll('#llSteps li')).map(l => l.textContent)")
        check("four pack-up steps, rules hidden", len(steps) == 4 and "pack up your instrument immediately" in steps[0]
              and "original position" in steps[1] and "chairs in rows" in steps[2] and "Brain Break" in steps[3]
              and not pg.is_visible("#llRules"), steps)
        if shots:
            pg.evaluate("document.getElementById('ll').classList.remove('flash')")
            pg.screenshot(path=shots + "/lunch_pack.png")
        pg.clock.run_for(11000); pg.wait_for_timeout(100)
        check("flash stops after 10 s", not pg.evaluate("document.getElementById('ll').classList.contains('flash')"))

        # 3) 11:40 → Time for Brain Break! (chime) → gone 2 minutes later
        pg.clock.fast_forward("04:50"); pg.wait_for_timeout(100)
        txt = pg.inner_text("#ll")
        check("11:40 → Time for Brain Break!", is_open(pg) and "Time for Brain Break!" in txt and pg.evaluate("window.__chimes") == ["pack", "end"], txt[:120])
        pg.clock.fast_forward("02:01"); pg.wait_for_timeout(100)
        check("closes 2 minutes later", not is_open(pg) and not pg.is_visible("#btnLunch"))
        pg.context.close()

        # 4) Only today: yesterday's switch doesn't count
        pg = board("2026-11-12T11:20:00", on={"date": "2026-11-11", "8th": True})
        check("yesterday's switch is off today", not is_open(pg))
        pg.context.close()

        # 5) 7th grade 12:15–12:35, pack-up at 12:30; opening the board mid-way doesn't chime
        pg = board("2026-11-12T12:31:00", on={"date": "2026-11-12", "7th": True})
        txt = pg.inner_text("#ll")
        check("7th grade pack-up at 12:30", is_open(pg) and pg.inner_text("#llGrade") == "7th Grade" and "4:00" in txt and "12:35" in txt, txt[:200])
        ch = pg.evaluate("window.__chimes"); check("no chime when opened mid pack-up", ch == [], ch)
        pg.context.close()
        pg = board("2026-11-12T12:20:00", on={"date": "2026-11-12", "7th": True})
        txt = pg.inner_text("#ll")
        check("7th countdown", is_open(pg) and "10:00" in txt and "Pack up at 12:30" in txt, txt[:200])
        pg.context.close()
        pg = board("2026-11-12T12:14:00", on={"date": "2026-11-12", "7th": True, "8th": True})
        check("not before 12:15 / after 8th", not is_open(pg))
        pg.context.close()

        # 6) IF day (Tuesday): 4th Block runs to 11:17, so it waits for the class to end
        pg = board("2026-11-10T11:16:00", on={"date": "2026-11-10", "8th": True})
        check("IF day: waits while 4th is in class", not is_open(pg))
        pg.clock.fast_forward("01:30"); pg.wait_for_timeout(100)
        check("IF day: opens when 4th ends", is_open(pg) and "17:30" in pg.inner_text("#llBig"), pg.inner_text("#llBig"))
        pg.context.close()

        # 7) Weekend: never
        pg = board("2026-11-14T11:20:00", on={"date": "2026-11-14", "8th": True})
        check("weekend: never", not is_open(pg))
        pg.context.close()

        # 8) Times from the Board Settings tab
        cfg["config"] = {"Lunch & Learn 8th": "11:20 AM - 11:50 AM"}
        pg = board("2026-11-12T11:19:00", on={"date": "2026-11-12", "8th": True})
        pg.clock.run_for(2000); pg.clock.fast_forward("02:58"); pg.wait_for_timeout(200)       # 11:22
        txt = pg.inner_text("#ll")
        check("sheet times win (11:20–11:50)", is_open(pg) and "Pack up at 11:45" in txt and "23:00" in txt, txt[:200])
        pr = pg.evaluate("""[__lunch.parseRange('12:15-12:35'), __lunch.parseRange('11:15 AM – 11:40 AM'), __lunch.parseRange('1:00-1:30'),
                           __lunch.parseRange('nonsense'), __lunch.parseRange('11:15-11:17')]""")
        check("time parsing", pr == [[735, 755], [675, 700], [780, 810], None, None], pr)
        pg.context.close()
        cfg["config"] = {}
        browser.close()
    srv.shutdown()
    n = len(RESULTS); ok = sum(1 for r in RESULTS if r)
    print(f"{ok}/{n} passed")
    sys.exit(0 if ok == n else 1)


if __name__ == "__main__":
    main()
