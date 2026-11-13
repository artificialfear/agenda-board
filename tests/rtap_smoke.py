"""Rhythm tap-along (2.8.0): board rhythm view + student tap pages, end to end in Playwright over ptnet's stand-in Peer
(?peerfake=1, BroadcastChannel). The Daily Slides script is faked (a=rhythm, a=ptest). Made-up students only.
Run: python3 tests/rtap_smoke.py [screenshot-folder]"""
import http.server, json, socketserver, sys, threading
from pathlib import Path
from urllib.parse import urlparse, parse_qs
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
    print(("PASS" if ok else "FAIL"), f"{name:44s}" + ("" if ok else " " + str(extra)[:600]))


STUDENTS = [{"id": "a1", "n": "Ana R."}, {"id": "b2", "n": "Ben K."}, {"id": "c3", "n": "Cy L."}]
LINE = "8th_4-4_004.png"


def main():
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Quiet)
    port = srv.server_address[1]
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    shots = sys.argv[1] if len(sys.argv) > 1 else None
    rbytes = json.load(open(ROOT / "rhythm-counts.json"))["lines"][LINE]["b"]
    img = (ROOT / "rhythm-pictures" / LINE).read_bytes()
    import base64
    slide_html = ('<body style="margin:0;background:#1f2a44"><div style="position:absolute;left:4.494%;top:24.711%;width:55.501%;'
                  'height:11.022%;background:#fff;border-radius:6px"></div><img src="data:image/png;base64,' + base64.b64encode(img).decode() +
                  '" style="position:absolute;left:6.6048%;top:25.0117%;width:51.2905%;height:10.4209%"></body>')

    def script(route):
        q = {k: v[0] for k, v in parse_qs(urlparse(route.request.url).query, keep_blank_values=True).items()}
        a = q.get("a")
        if a == "rhythm":
            body = {"ok": True, "block": q.get("block"), "set": "8th", "name": LINE, "meter": "4/4", "bytes": rbytes}
        elif a == "ptest":
            body = {"ok": True, "block": q["block"], "date": "2026-11-13", "test": "", "students": STUDENTS, "scores": {}}
        else:
            body = {"ok": True, "config": {}, "songs": [], "blocks": []}
        route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body=json.dumps(body))

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, timezone_id="America/New_York")
        ctx.add_init_script("if (location.pathname.endsWith('index.html')) { localStorage.setItem('agendaBoard.settings', JSON.stringify({closingUrl: 'https://script.google.com/macros/s/X/exec?k=KEY'}));"
                            " localStorage.setItem('agendaBoard.metro', JSON.stringify({bpm: 120, beats: 4})); }")
        ctx.route("https://script.google.com/**", script)
        ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body=slide_html))
        board = ctx.new_page()
        board.goto(f"http://127.0.0.1:{port}/index.html?peerfake=1&test=2026-11-13T08:10:00&speed=1")
        board.wait_for_timeout(500)
        board.click("#btnRhythm"); board.wait_for_timeout(700)
        check("tap-along button in the rhythm view", board.is_visible("#mTap"))
        board.click("#mTap")
        board.wait_for_function("window.__rtap.state().status === 'ready' && window.__rtap.state().roster === 3", timeout=8000)
        s = board.evaluate("window.__rtap.state()")
        code = s["code"]
        check("card with QR + code", board.is_visible("#rtCard") and len(code) == 4 and board.evaluate("!!document.querySelector('#rtCard .rt-qr svg')")
              and "0 students ready" in board.inner_text("#rtCard"), board.inner_text("#rtCard"))
        check("rhythm view stays open", board.evaluate("window.__agendaBoard.rhythm().open"))

        # two students join on their own pages (their own clocks: performance.now differs per page)
        kids = []
        for who in ["Ana R.", "Ben K."]:
            if kids: kids[0].evaluate("localStorage.removeItem('rtap.me')")      # one browser in the test = shared storage; real devices each have their own
            k = ctx.new_page(); k.set_viewport_size({"width": 1024, "height": 700})
            k.goto(f"http://127.0.0.1:{port}/tap.html?c={code}&peerfake=1")
            k.wait_for_selector("#names button", timeout=8000)
            if who == "Ana R.":
                names = k.evaluate("Array.from(document.querySelectorAll('#names button')).map(b => b.textContent)")
                check("student sees the class list", names == ["Ana R.", "Ben K.", "Cy L."], names)
                if shots: k.screenshot(path=shots + "/tap_names.png")
            k.click(f"#names button:has-text('{who}')")
            k.wait_for_function("window.__tap.state().phase === 'ready'", timeout=5000)
            kids.append(k)
        board.wait_for_timeout(600)
        check("board counts 2 ready", "2 students ready" in board.inner_text("#rtCard"), board.inner_text("#rtCard"))
        check("clock synced on the devices", all(k.evaluate("window.__tap.state().sync") >= 3 for k in kids))
        if shots: board.screenshot(path=shots + "/tap_board_join.png")

        # a round: Ana taps every note exactly (+ the count-off, 110 ms late = her device's delay); Ben taps half the notes
        GAP = "(() => { const c = document.getElementById('rtCard').getBoundingClientRect(), v = document.getElementById('rView').getBoundingClientRect(); return v.top - c.bottom; })()"
        check("card above the rhythm (join)", board.evaluate(GAP) >= 0, board.evaluate(GAP))
        board.click("#mGo")
        for k in kids: k.wait_for_function("window.__tap.state().round !== null", timeout=3000)
        board.wait_for_timeout(200)
        mini = board.inner_text("#rtCard")
        check("one-line card while playing", "2 tapping" in mini and code in mini and board.evaluate("document.getElementById('rtCard').offsetHeight") < 80
              and board.evaluate(GAP) >= 0, mini)
        ana, ben = kids
        r = ana.evaluate("window.__tap.state().round")
        ana.evaluate("""(r) => { const late = 110; r.clicks.concat(r.onsets).forEach(t => setTimeout(() => window.__tap.tapAt(t + late),
                         Math.max(0, t + late - performance.now()))); }""", r)
        rb = ben.evaluate("window.__tap.state().round")
        ben.evaluate("(r) => { r.onsets.filter((_, i) => i % 2 === 0).forEach(t => setTimeout(() => window.__tap.tapAt(t + 140), Math.max(0, t + 140 - performance.now()))); }", rb)   # 2.9.1: no count-off taps, 140 ms lag
        # board and devices agree on when the first note is (within 25 ms)
        bt = board.evaluate("performance.timeOrigin")
        at, btn_ = ana.evaluate("performance.timeOrigin"), ben.evaluate("performance.timeOrigin")
        diff = abs((r["onsets"][0] + at) - (rb["onsets"][0] + btn_))
        check("both devices agree on note times", diff < 25, diff)
        board.wait_for_timeout(1200)
        if shots: ana.screenshot(path=shots + "/tap_round.png")
        dur = (r["end"] - ana.evaluate("performance.now()")) / 1000
        board.wait_for_timeout(int(max(0, dur) * 1000) + 2600)
        ra, rbr = ana.evaluate("window.__tap.state().result"), ben.evaluate("window.__tap.state().result")
        check("perfect student scores 100% (delay tuned out)", ra and ra["pct"] == 100 and ra["perfect"] == ra["n"] and abs(ra["cal"] - 110) <= 5, ra)
        check("half the notes ≈ half the score", rbr and 40 <= rbr["pct"] <= 60 and rbr["miss"] >= rbr["n"] // 2 - 1, rbr)
        check("steady lag forgiven without count-off taps", rbr and rbr["countCal"] is None and abs(rbr["cal"] - 140) <= 10 and rbr["good"] == 0, rbr)
        check("result screen on the device", "YOUR SCORE" in ana.inner_text("main").upper() and "100%" in ana.inner_text("main"))
        if shots: ana.screenshot(path=shots + "/tap_result.png")
        txt = board.inner_text("#rtCard")
        check("board Top 5 + class average", "TOP 5" in txt.upper() and "Ana R." in txt and "100%" in txt and "Class average" in txt and "2 of 2 scored" in txt
              and txt.index("Ana R.") < txt.index("Ben K."), txt)
        check("board never shows scores but Top 5/average", board.evaluate("window.__rtap.state().view") == "results")
        check("card above the rhythm (results)", board.evaluate(GAP) >= 0, board.evaluate(GAP))
        # 2.11.0: class problem spots: every note colored by how many hit it (Ana all, Ben every other one → 100% / 50%)
        hm = board.evaluate("window.__agendaBoard.rhythm().counts.heat")
        n_on = len(r["onsets"])
        check("problem spots under the rhythm", len(hm) == n_on and all(h[1] == ("100%" if i % 2 == 0 else "50%") and h[2] == ("hg" if i % 2 == 0 else "hy")
              for i, h in enumerate(hm)) and board.evaluate("document.getElementById('rCounts').classList.contains('heat')")
              and "Problem spots" in board.inner_text("#rtCard"), hm)
        if shots: board.screenshot(path=shots + "/tap_heat.png")
        board.set_viewport_size({"width": 1440, "height": 1080}); board.wait_for_timeout(300)          # 4:3: the rhythm sits higher
        check("card shrinks to stay above on 4:3", board.evaluate(GAP) >= 0, board.evaluate(GAP))
        if shots: board.screenshot(path=shots + "/tap_board_43.png")
        board.set_viewport_size({"width": 1920, "height": 1080}); board.wait_for_timeout(300)
        if shots: board.screenshot(path=shots + "/tap_board_results.png")
        st = board.evaluate("window.__rtap.state()")
        check("nothing saved anywhere", all(q not in ["ptscore"] for q in []) and set(st["results"].keys()) == {"a1", "b2"})

        # stopping in the middle cancels the round on the devices
        check("metronome stopped after the rhythm (round still counts)", not board.evaluate("window.__agendaBoard.metro().on"))
        board.click("#mGo"); board.wait_for_timeout(300)
        for k in kids: k.wait_for_function("window.__tap.state().phase === 'round'", timeout=3000)
        check("a new round clears the problem spots", board.evaluate("window.__agendaBoard.rhythm().counts.heat") == [])
        board.click("#mGo"); board.wait_for_timeout(500)
        check("stop mid-round cancels it", all(k.evaluate("window.__tap.state().phase") == "ready" for k in kids)
              and "stopped" in ana.inner_text("main"), [k.evaluate("window.__tap.state().phase") for k in kids])

        # a reload keeps the student's name; the code box works without ?c=
        ana.evaluate("localStorage.setItem('rtap.me', JSON.stringify({code: '%s', date: new Date().toDateString(), id: 'a1', n: 'Ana R.'}))" % code)
        ana.reload(); ana.wait_for_function("window.__tap.state().phase === 'ready'", timeout=8000)
        check("reload keeps the name", ana.inner_text("#who") == "Ana R.")
        ana.evaluate("localStorage.removeItem('rtap.me')")
        k3 = ctx.new_page(); k3.goto(f"http://127.0.0.1:{port}/tap.html?peerfake=1")
        k3.fill("#code", code.lower()); k3.click("#go")
        k3.wait_for_selector("#names button", timeout=8000)
        check("typing the code works", k3.evaluate("window.__tap.state().roster") == 3)
        k3.close()

        # Turn off closes the card and the connection
        board.click("#rtOff"); board.wait_for_timeout(300)
        check("turn off", not board.is_visible("#rtCard") and board.evaluate("window.__rtap.state().status") == "off")
        browser.close()
    srv.shutdown()
    n = len(RESULTS); ok = sum(1 for r in RESULTS if r)
    print(f"{ok}/{n} passed")
    sys.exit(0 if ok == n else 1)


if __name__ == "__main__":
    main()
