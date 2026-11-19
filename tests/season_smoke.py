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

        # the welcome screen goes away for class (the theme waits underneath)
        ctx, pg = board("2026-11-18T10:00:00", {}); L = look(pg)
        check("class time: slide shows, not the welcome", L["shown"] == "3rd", L); ctx.close()
        browser.close()
    httpd.shutdown()
    print(f"\n{sum(results)}/{len(results)} passed")
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
