"""Solo rhythm practice (2.16.0): practice.html on its own (Dojo link). Level/Time pickers, counts, Hear it, Tap it scoring,
problem spots, best score, tempo, phone layout. Run: python3 tests/practice_smoke.py [screenshot-folder]"""
import http.server, json, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
RESULTS = []
BOOK = json.load(open(ROOT / "rhythm-counts.json"))["lines"]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def log_message(self, *a):
        pass


def check(name, ok, extra=""):
    RESULTS.append(ok)
    print(("PASS" if ok else "FAIL"), f"{name:44s}" + ("" if ok else " " + str(extra)[:500]))


def main():
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Quiet)
    port = srv.server_address[1]
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    shots = sys.argv[1] if len(sys.argv) > 1 else None
    base = f"http://127.0.0.1:{port}/practice.html"

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        ctx = browser.new_context(viewport={"width": 1366, "height": 768})
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))

        def st():
            return pg.evaluate("window.__prac.state()")

        # 1) the Dojo link picks the level (and time); a random rhythm of that kind shows
        pg.goto(base + "?lvl=6beg&m=3-4&n=Test%20S.")
        pg.wait_for_function("window.__prac.state().cur", timeout=5000)
        s = st()
        check("Dojo level + time from the link", s["cur"]["name"].startswith("6beg_3-4_") and s["prefs"]["set"] == "6beg", s["cur"])
        check("picture loads", pg.evaluate("document.getElementById('rImg').naturalWidth") > 0)
        check("name shown", pg.inner_text("#who") == "Test S.")
        check("6/8 only for 8th", pg.evaluate("document.querySelector('#pTime [data-v=\"6/8\"]').disabled"))
        check("counts hidden at first", pg.evaluate("document.querySelectorAll('#rCnt span').length") == 0)
        first = s["cur"]["name"]
        pg.click("#bNew"); s = st()
        check("🎲 New rhythm: same kind, different picture", s["cur"]["name"].startswith("6beg_3-4_") and s["cur"]["name"] != first, s["cur"])
        pg.click("#pLevel [data-v='8th']"); pg.click("#pTime [data-v='6/8']"); s = st()
        check("Level + Time pickers", s["cur"]["name"].startswith("8th_6-8_") and s["cur"]["meter"] == "6/8", s["cur"])
        pg.click("#pLevel [data-v='7th']"); s = st()
        check("leaving 8th drops 6/8 to 4/4", s["cur"]["name"].startswith("7th_4-4_"), s["cur"])
        pg.click("#bCounts")
        n_counts = len(BOOK[s["cur"]["name"]]["c"])
        check("Show counts", pg.evaluate("document.querySelectorAll('#rCnt span').length") == n_counts)
        pg.click("#bCounts")
        pg.goto(base); pg.wait_for_function("window.__prac.state().cur", timeout=5000)
        check("remembers the last level on this device", st()["cur"]["name"].startswith("7th_4-4_"), st()["cur"])
        pg.goto(base + "?r=8th_4-4_004"); pg.wait_for_function("window.__prac.state().cur", timeout=5000)
        check("?r= opens one rhythm", st()["cur"]["name"] == "8th_4-4_004.png")

        # 2) tempo
        pg.click("#tUp"); pg.click("#tUp")
        check("tempo + (4 BPM a step)", st()["prefs"]["bpm"] == 88 and pg.inner_text("#tOut") == "88 BPM", st()["prefs"])
        pg.evaluate("document.getElementById('tRange').value = 120; document.getElementById('tRange').dispatchEvent(new Event('input'))")
        check("tempo slider", st()["prefs"]["bpm"] == 120)

        # 3) Hear it: woodblock on every note + clicks, line moves, nothing scored
        pg.click("#bHear"); pg.wait_for_timeout(200)
        s = st()
        check("Hear it plays", s["play"] and s["play"]["mode"] == "hear" and pg.evaluate("document.getElementById('bTap').disabled"))
        end = s["play"]["end"]
        pg.wait_for_timeout(int(s["play"]["onsets"][2] - pg.evaluate("performance.now()")) + 50)
        x1 = pg.evaluate("parseFloat(document.getElementById('rLine').style.left)"); pg.wait_for_timeout(300)
        x2 = pg.evaluate("parseFloat(document.getElementById('rLine').style.left)")
        check("moving line", pg.is_visible("#rLine") and 0 < x1 < x2 < 100, (x1, x2))
        pg.wait_for_timeout(int(end - pg.evaluate("performance.now()")) + 800)
        s = st()
        n_notes = len([c for c in BOOK["8th_4-4_004.png"]["c"] if c[2] == "n"])
        check("a tock for every note, no score", s["play"] is None and s["last"]["tocks"] == n_notes and s["result"] is None
              and s["last"]["clicks"] == 4 + 16, s["last"])

        # 4) Tap it: a perfect player (120 ms device delay, taps the count-off too) → 100%, all green, best saved
        pg.click("#bTap"); pg.wait_for_timeout(100)
        s = st()
        check("pad turns on while tapping", not pg.evaluate("document.getElementById('pad').classList.contains('off')"))
        pg.evaluate("""(r) => { const late = 120; r.clicks.concat(r.onsets).forEach(t => setTimeout(() => window.__prac.tapAt(t + late),
                       Math.max(0, t + late - performance.now()))); }""", s["play"])
        if shots:
            pg.wait_for_timeout(int(s["play"]["onsets"][4] - pg.evaluate("performance.now()")))
            pg.screenshot(path=shots + "/practice_playing.png")
        pg.wait_for_timeout(int(s["play"]["end"] - pg.evaluate("performance.now()")) + 900)
        s = st()
        check("perfect taps → 100%", s["result"] and s["result"]["pct"] == 100 and abs(s["result"]["shift"] - 120) <= 6, s["result"])
        check("problem spots: all green", s["counts"].count("n hg") == n_notes and "hr" not in " ".join(s["counts"]), s["counts"])
        check("result card + first best", pg.is_visible("#res") and "100%" in pg.inner_text("#res") and "first score" in pg.inner_text("#res"))
        best = pg.evaluate("JSON.parse(localStorage.getItem('practice.best'))")
        check("best kept on this device", best == {"8th_4-4_004.png": {"pct": 100, "bpm": 120}}, best)
        if shots: pg.screenshot(path=shots + "/practice_result.png")

        # 5) half the notes → about half, red spots, best not lowered
        pg.click("#bTap"); pg.wait_for_timeout(100)
        s = st()
        pg.evaluate("(r) => { r.onsets.filter((_, i) => i % 2 === 0).forEach(t => setTimeout(() => window.__prac.tapAt(t + 120), Math.max(0, t + 120 - performance.now()))); }", s["play"])
        pg.wait_for_timeout(int(s["play"]["end"] - pg.evaluate("performance.now()")) + 900)
        s = st()
        check("half the notes ≈ half", s["result"] and 40 <= s["result"]["pct"] <= 60, s["result"])
        check("missed notes are red", "n hr" in s["counts"] and "n hg" in s["counts"], s["counts"])
        check("best stays 100%", "best on this rhythm: 100%" in pg.inner_text("#res"), pg.inner_text("#res"))

        # 6) Stop in the middle: no score; Space starts a try on a Chromebook
        pg.click("#bTap"); pg.wait_for_timeout(300); pg.click("#bStop")
        s = st()
        check("stop mid-try: nothing scored", s["play"] is None and s["result"] is None and "Stopped" in pg.inner_text("#status"))
        pg.evaluate("document.activeElement && document.activeElement.blur()"); pg.keyboard.press("Space"); pg.wait_for_timeout(100)
        check("space bar starts a try", st()["play"] and st()["play"]["mode"] == "tap")
        pg.keyboard.press("Space"); pg.wait_for_timeout(50)
        check("space bar taps while playing", st()["taps"] == 1)
        pg.click("#bStop")
        check("no page errors", not errs, errs)

        # 7) phone + Chromebook layouts: nothing wider than the screen, pad + buttons reachable
        for w, h, nm in ((390, 844, "phone"), (1366, 768, "chromebook"), (1024, 768, "ipad")):
            pg.set_viewport_size({"width": w, "height": h}); pg.wait_for_timeout(200)
            sw = pg.evaluate("document.documentElement.scrollWidth")
            pad = pg.evaluate("document.getElementById('pad').getBoundingClientRect().height")
            check(f"{nm} layout fits", sw <= w and pad >= 150, (sw, pad))
            if shots: pg.screenshot(path=shots + f"/practice_{nm}.png", full_page=True)
        browser.close()
    srv.shutdown()
    n = len(RESULTS); ok = sum(1 for r in RESULTS if r)
    print(f"{ok}/{n} passed")
    sys.exit(0 if ok == n else 1)


if __name__ == "__main__":
    main()
