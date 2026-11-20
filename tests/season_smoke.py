"""2.29.0: welcome screen drifting notes + seasonal themes (season.js).

Serves the repo, freezes the clock on a welcome-screen time, stubs the Board Settings (a=config) and checks
which theme, banner and drifting layers show.
Run:  python3 tests/season_smoke.py            (checks only)
      python3 tests/season_smoke.py --shots DIR (also saves a screenshot per theme)
"""
import http.server, json, socketserver, sys, threading
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8771
INIT = "localStorage.setItem('agendaBoard.settings', JSON.stringify({closingUrl: 'https://script.google.com/macros/s/X/exec?k=KEY'}))"
INIT_LIGHT = "localStorage.setItem('agendaBoard.settings', JSON.stringify({closingUrl: 'https://script.google.com/macros/s/X/exec?k=KEY', theme: 'light'}))"
CONCERTS = "12/9 Winter Concert 6:30 PM; 3/12 Spring Concert"


class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=str(ROOT), **k)
    def log_message(self, *a): pass


results = []
def check(label, ok, detail=""):
    results.append(ok)
    print(("PASS" if ok else "FAIL"), f"{label:44s}" + ("" if ok else f" {detail}"))


def main():
    shots = None
    if "--shots" in sys.argv:
        shots = Path(sys.argv[sys.argv.index("--shots") + 1]); shots.mkdir(parents=True, exist_ok=True)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), Quiet)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chromium")

        def board(t, cfg, init=INIT, motion="no-preference"):
            ctx = browser.new_context(viewport={"width": 1600, "height": 900}, timezone_id="America/New_York", reduced_motion=motion)
            ctx.add_init_script(init)
            ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
            def script(route):
                q = {k: v[0] for k, v in parse_qs(urlparse(route.request.url).query, keep_blank_values=True).items()}
                body = {"ok": True, "config": dict(cfg)} if q.get("a") == "config" else {"ok": True}
                route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body=json.dumps(body))
            ctx.route("https://script.google.com/**", script)
            pg = ctx.new_page(); pg.clock.install(time=t)
            pg.goto(f"http://127.0.0.1:{PORT}/index.html"); pg.wait_for_timeout(300)
            pg.clock.fast_forward("00:03"); pg.wait_for_timeout(400)          # remoteConfig runs 1.5 s after load
            return ctx, pg

        def look(pg):
            return pg.evaluate("""() => { const w = document.getElementById('welcome'), s = window.__season.state();
                const kinds = {}; document.querySelectorAll('#wxFx .wx').forEach(e => { const c = e.classList[1]; kinds[c] = (kinds[c] || 0) + 1; });
                const b = document.getElementById('wxBanner');
                return { shown: window.__agendaBoard.shown(), theme: s.theme, cls: w.className, kinds: kinds, count: s.count,
                         banner: b.style.display === 'none' ? '' : b.textContent,
                         accent: getComputedStyle(w).getPropertyValue('--accent').trim(),
                         rootAccent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
                         anim: (document.querySelector('#wxFx .wx') || {}).getAnimations ? document.querySelector('#wxFx .wx').getAnimations().length : 0,
                         clockZ: getComputedStyle(document.getElementById('clock')).zIndex }; }""")

        def shot(pg, name):
            if shots: pg.screenshot(path=str(shots / f"welcome_{name}.png"))

        # Auto: the calendar picks the theme (all lunchtime / after school = welcome screen)
        cases = [("auto: April = notes only", "2027-04-14T12:00:00", {}, "none", {"note": 9}),
                 ("auto: mid-November = fall", "2026-11-18T12:00:00", {}, "fall", {"note": 9, "leaf": 9}),
                 ("auto: Oct 28 = halloween", "2026-10-28T12:00:00", {}, "halloween", {"note": 9, "leaf": 6, "bat": 4}),
                 ("auto: Dec 10 = holidays", "2026-12-10T12:00:00", {}, "holidays", {"note": 9, "snow": 12, "twinkle": 10}),
                 ("auto: Jan 20 = winter", "2027-01-20T12:00:00", {}, "winter", {"note": 9, "snow": 16})]
        for label, t, cfg, want, kinds in cases:
            ctx, pg = board(t, cfg); L = look(pg)
            ok = L["shown"] == "welcome" and L["theme"] == want and L["kinds"] == kinds and L["anim"] >= 1 and L["clockZ"] == "1"
            ok = ok and (want == "none" or ("s-" + want) in L["cls"])
            check(label, ok, L)
            shot(pg, want); ctx.close()

        # the season colors stay on the welcome screen; the page's own --accent (overlays) is untouched
        ctx, pg = board("2026-10-28T12:00:00", {}); L = look(pg)
        check("season colors only on the welcome screen", L["accent"] == "#ff8c1a" and L["rootAccent"] == "#c9a227", L); ctx.close()

        # concert day: banner + sparkles, beats the season; the next day is the season again
        ctx, pg = board("2026-12-09T14:45:00", {"Concert dates": CONCERTS}); L = look(pg)
        check("concert date: banner + sparkles", L["theme"] == "concert" and L["banner"] == "🎺 TODAY: Winter Concert 6:30 PM 🎺"
              and L["kinds"] == {"note": 14, "sparkle": 10}, L)
        shot(pg, "concert"); ctx.close()
        ctx, pg = board("2026-12-10T12:00:00", {"Concert dates": CONCERTS}); L = look(pg)
        check("day after the concert = holidays", L["theme"] == "holidays" and L["banner"] == "", L); ctx.close()

        # overrides from the sheet
        ctx, pg = board("2026-10-05T12:00:00", {"Seasonal theme": "Winter"}); L = look(pg)
        check("Seasonal theme = Winter in October", L["theme"] == "winter", L); ctx.close()
        ctx, pg = board("2026-11-18T12:00:00", {"Seasonal theme": "Off"}); L = look(pg)
        check("Seasonal theme = Off: notes only", L["theme"] == "none" and L["kinds"] == {"note": 9} and "s-" not in L["cls"], L); ctx.close()
        ctx, pg = board("2026-11-18T12:00:00", {"Welcome animation": "Off"}); L = look(pg)
        check("Welcome animation = Off: colors, no motion", L["theme"] == "fall" and L["count"] == 0 and L["kinds"] == {}, L); ctx.close()

        # a row deleted from the sheet goes back to the default (the script leaves blank rows out)
        cfg = {"Seasonal theme": "Off"}
        ctx, pg = board("2026-11-18T12:00:00", cfg); a = look(pg)["theme"]
        cfg.clear(); pg.clock.fast_forward("10:05"); pg.wait_for_timeout(400); b = look(pg)["theme"]
        stored = pg.evaluate("JSON.parse(localStorage.getItem('agendaBoard.settings')).season")
        check("row removed: back to Auto", a == "none" and b == "fall" and stored == "", (a, b, stored)); ctx.close()

        # reduced motion: no drifting
        ctx, pg = board("2026-11-18T12:00:00", {}, motion="reduce"); L = look(pg)
        check("reduced motion: nothing drifts", L["theme"] == "fall" and L["count"] == 0, L); ctx.close()

        # light theme gets its own season colors
        ctx, pg = board("2026-12-10T12:00:00", {}, init=INIT_LIGHT); L = look(pg)
        check("light theme: holiday colors", L["theme"] == "holidays" and L["accent"] == "#b23a32", L)
        shot(pg, "holidays_light"); ctx.close()

        # with the pass-off stats showing too (welcome has-stats layout) the concert banner still fits on screen
        ctx, pg = board("2026-12-09T12:00:00", {"Concert dates": CONCERTS})
        pg.evaluate("document.getElementById('welcome').classList.add('has-stats')")
        box = pg.evaluate("(() => { const r = document.getElementById('wxBanner').getBoundingClientRect(); return [r.top, r.bottom]; })()")
        check("banner inside the screen", box[0] > 0 and box[1] < 900, box); ctx.close()

        # ---------- 2.30.0: season effects in the agenda slide's header band, before the bell only ----------
        SLIDE = ('<body style="margin:0;background:#1f2a44;height:100vh;font:600 6vh Oswald,Arial;color:#fff">'
                 '<div style="position:absolute;left:3%;top:2.5%;font-size:7.5vh">3rd Block <span style="color:#c9a227">Agenda</span></div>'
                 '<div style="position:absolute;left:3%;right:2.5%;top:{rule}%;height:0.7%;background:#c9a227"></div>'
                 '<div style="position:absolute;left:3%;top:17.5%;width:56%;height:35%;background:#2a3858;border-radius:2vh"></div>'
                 '<div style="position:absolute;left:63.5%;top:17.5%;width:34%;height:36%;background:#2a3858;border-radius:2vh"></div></body>')
        def slide_board(t, cfg, size=(1600, 900), motion="no-preference"):
            ctx = browser.new_context(viewport={"width": size[0], "height": size[1]}, timezone_id="America/New_York", reduced_motion=motion)
            ctx.add_init_script(INIT)
            def deck(route):
                ninja = "1HLmyd7srbW3C_vkgyAofsAeZ3T4afLs5PmqXTEIKIYU" in route.request.url
                route.fulfill(status=200, content_type="text/html", body=SLIDE.replace("{rule}", "13.6" if ninja else "14.22"))
            ctx.route("https://docs.google.com/**", deck)
            def script(route):
                q = {k: v[0] for k, v in parse_qs(urlparse(route.request.url).query, keep_blank_values=True).items()}
                body = {"ok": True, "config": dict(cfg)} if q.get("a") == "config" else {"ok": True}
                route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body=json.dumps(body))
            ctx.route("https://script.google.com/**", script)
            pg = ctx.new_page(); pg.clock.install(time=t)
            pg.goto(f"http://127.0.0.1:{PORT}/index.html"); pg.wait_for_timeout(300)
            pg.clock.fast_forward("00:03"); pg.wait_for_timeout(600)
            return ctx, pg
        SL = lambda pg: pg.evaluate("""() => { const s = window.__season.slide(), k = {};
            document.querySelectorAll('#slideFx .wx').forEach(e => { const c = e.classList[1]; k[c] = (k[c] || 0) + 1; });
            const r = document.getElementById('frame').getBoundingClientRect();
            return Object.assign(s, { kinds: k, shown: window.__agendaBoard.shown(), frameH: r.height,
              clip: getComputedStyle(document.getElementById('slideFx')).overflow }); }""")

        ctx, pg = slide_board("2026-11-20T07:43:30", {})            # Fri: 1st Block lead-in (bell 7:45), fall
        a = SL(pg)
        if shots: pg.wait_for_timeout(2200); pg.screenshot(path=str(shots / "slide_fall_before_bell.png"))
        b_ok = a["band"] and abs(a["band"]["top"]) <= 1 and abs(a["band"]["height"] - 900 * 731520 / 5143500) <= 1.5 and a["band"]["width"] == 1600
        check("slide: lead-in = fall effects in header", a["on"] and a["visible"] and a["shown"] == "1st" and a["theme"] == "fall"
              and a["kinds"] == {"note": 4, "leaf": 6} and a["clip"] == "hidden" and b_ok, a)
        pg.clock.fast_forward("01:45"); pg.wait_for_timeout(6000)     # past the 7:45 bell: fade out, then removed
        b = SL(pg)
        check("slide: bell rings = effects fade + go", (not b["on"]) and (not b["visible"]) and b["count"] == 0 and b["shown"] == "1st", b)
        ctx.close()

        ctx, pg = slide_board("2026-11-20T08:10:00", {}); c = SL(pg)
        check("slide: mid-class = nothing", (not c["on"]) and c["count"] == 0 and c["shown"] == "1st", c); ctx.close()

        ctx, pg = slide_board("2026-11-20T10:20:20", {}); c = SL(pg)
        check("slide: passing time = next block's header", c["on"] and c["shown"] == "4th", c); ctx.close()

        ctx, pg = slide_board("2026-12-10T07:43:00", {}); c = SL(pg)
        if shots: pg.wait_for_timeout(2200); pg.screenshot(path=str(shots / "slide_holidays_before_bell.png"))
        check("slide: December = snow + twinkles", c["on"] and c["kinds"] == {"snow": 8, "twinkle": 6}, c); ctx.close()

        ctx, pg = slide_board("2026-10-28T07:43:00", {}); c = SL(pg)
        if shots: pg.wait_for_timeout(2200); pg.screenshot(path=str(shots / "slide_halloween_before_bell.png"))
        check("slide: Halloween = leaves + bats", c["on"] and c["kinds"] == {"leaf": 4, "bat": 3}, c); ctx.close()

        ctx, pg = slide_board("2027-04-14T07:43:00", {}); c = SL(pg)
        check("slide: April (no season) = nothing", (not c["on"]) and c["count"] == 0 and c["shown"] == "1st", c); ctx.close()

        ctx, pg = slide_board("2026-11-20T07:43:00", {"Seasonal theme": "Off"}); pg.clock.fast_forward("00:04"); pg.wait_for_timeout(300); c = SL(pg)   # sheet answers 1.5 s in; fade + clear
        check("slide: Seasonal theme Off = nothing", (not c["on"]) and (not c["visible"]) and c["count"] == 0, c); ctx.close()

        ctx, pg = slide_board("2026-11-20T07:43:00", {"Slide animation": "Off"}); pg.clock.fast_forward("00:04"); pg.wait_for_timeout(300); c = SL(pg)   # sheet answers 1.5 s in; fade + clear
        check("slide: Slide animation Off = nothing", (not c["on"]) and (not c["visible"]) and c["count"] == 0, c); ctx.close()

        ctx, pg = slide_board("2026-11-20T07:43:00", {"Welcome animation": "Off"}); c = SL(pg)
        check("slide: Welcome animation Off leaves slides on", c["on"] and c["count"] == 10, c); ctx.close()

        ctx, pg = slide_board("2026-12-09T07:43:00", {"Concert dates": CONCERTS}); c = SL(pg)
        check("slide: concert day = notes + sparkles", c["on"] and c["theme"] == "concert" and c["kinds"] == {"note": 4, "sparkle": 6}, c); ctx.close()

        ctx, pg = slide_board("2026-11-24T07:43:00", {}); c = SL(pg)         # IF Tuesday: Band Ninja slide, its own gold line
        nb = c["band"] and abs(c["band"]["height"] - 900 * 932688 / 6858000) <= 1.5
        check("slide: Band Ninja day uses its header", c["on"] and c["ninja"] and nb, c); ctx.close()

        ctx, pg = slide_board("2026-11-20T07:43:00", {}, size=(1920, 900)); c = SL(pg)   # wide screen: slide letterboxed
        check("slide: letterboxed slide, band follows", c["on"] and abs(c["band"]["left"] - 160) <= 1 and abs(c["band"]["width"] - 1600) <= 1, c); ctx.close()

        ctx, pg = slide_board("2026-11-20T07:43:00", {}, motion="reduce"); c = SL(pg)
        check("slide: reduced motion = nothing", (not c["on"]) and c["count"] == 0, c); ctx.close()

        # row removed later: "Slide animation" Off → deleted → back on (at the next 10-minute config check)
        cfg = {"Slide animation": "Off"}
        ctx, pg = slide_board("2026-11-20T09:15:00", cfg); a1 = SL(pg)["on"]       # 3rd lead-in starts 9:26
        cfg.clear(); pg.clock.fast_forward("12:00"); pg.wait_for_timeout(800); a2 = SL(pg)
        check("slide: deleted row = back On", (not a1) and a2["on"] and a2["shown"] == "3rd", (a1, a2)); ctx.close()

        # the welcome screen goes away for class (the theme waits underneath)
        ctx, pg = board("2026-11-18T10:00:00", {}); L = look(pg)
        check("class time: slide shows, not the welcome", L["shown"] == "3rd", L); ctx.close()
        browser.close()
    httpd.shutdown()
    print(f"\n{sum(results)}/{len(results)} passed")
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
