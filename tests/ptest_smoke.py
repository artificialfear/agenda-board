"""Playing Test day (2.5.0): board screen + wheel + remote, end to end in Playwright.
The board and the remote talk through ptnet.js's stand-in Peer (?peerfake=1, BroadcastChannel), and the Daily Slides
script is faked (a=ptest / a=ptscore / a=config). Made-up students only.  Run: python3 tests/ptest_smoke.py"""
import http.server, json, socketserver, sys, threading
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 0      # picked when the server starts
RESULTS = []


class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def log_message(self, *a):
        pass


def check(name, ok, extra=""):
    RESULTS.append(ok)
    print(("PASS" if ok else "FAIL"), f"{name:40s}" + ("" if ok else " " + str(extra)))


STUDENTS = [{"id": "a1", "n": "Ana R."}, {"id": "b2", "n": "Ben K."}, {"id": "c3", "n": "Cy L."}, {"id": "d4", "n": "Dee M."}, {"id": "e5", "n": "Eli P."}]


def main():
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    global PORT
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Quiet)
    PORT = srv.server_address[1]
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    saved, slide = [], {"3rd": "F Concert scale, ToE #72", "4th": ""}

    def script(route):
        q = {k: v[0] for k, v in parse_qs(urlparse(route.request.url).query, keep_blank_values=True).items()}
        a = q.get("a")
        if a == "ptest":
            body = {"ok": True, "block": q["block"], "date": "2026-11-12", "test": slide.get(q["block"], ""), "students": STUDENTS,
                    "scores": {"e5": {"s": "2", "note": "from the sheet", "test": "x"}} if q["block"] == "3rd" else {}}
        elif a == "ptscore":
            saved.append(q)
            body = {"ok": True, "saved": {"id": q["id"], "s": q["s"], "note": q.get("note", "")}}
        elif a == "config":
            body = {"ok": True, "config": {"Playing Test PIN": "2468"}}
        else:
            body = {"ok": True, "config": {}, "block": q.get("block"), "songs": [], "waiting": 0, "passedToday": 0, "blocks": []}
        route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body=json.dumps(body))

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, timezone_id="America/New_York")
        ctx.add_init_script("localStorage.setItem('agendaBoard.settings', JSON.stringify({closingUrl: 'https://script.google.com/macros/s/X/exec?k=KEY'}))")
        ctx.route("https://script.google.com/**", script)
        ctx.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
        page = ctx.new_page()
        page.clock.install(time="2026-11-12T09:40:00")          # Thursday, 3rd Block (regular day)
        page.goto(f"http://127.0.0.1:{PORT}/index.html?peerfake=1")
        page.wait_for_timeout(600)
        page.evaluate("window.__ptSpinMs = 300; window.__ptHoldMs = 1200; window.__ptPick = () => 1;")       # always the 2nd name on the wheel
        page.wait_for_function("document.getElementById('pt').classList.contains('open')", timeout=8000)
        txt = page.inner_text("#pt")
        check("opens from the slide line", "3rd Block" in txt and "Playing Test" in txt and "F Concert scale, ToE #72" in txt and "Spin the wheel!" in txt, txt[:200])
        wheel = page.evaluate("Array.from(document.querySelectorAll('#ptRot text')).map(t => t.textContent)")
        check("wheel has every First L.", wheel == ["Ana R.", "Ben K.", "Cy L.", "Dee M.", "Eli P."], wheel)
        if len(sys.argv) > 1:
            page.screenshot(path=sys.argv[1] + "/ptest_start.png")
        check("no scores drawn on the board", "from the sheet" not in page.content() and "2 Approaching" not in txt)

        # 2.5.1: the wheel fills the right side; the pointer tip reaches over the rim
        geo = page.evaluate("""(() => { const b = document.getElementById('ptWheelBox').getBoundingClientRect(), pol = document.querySelector('.pt-pointer polygon').getBoundingClientRect(),
          c = document.querySelector('#ptRot circle[fill=none]').getBoundingClientRect(), r = document.querySelector('.pt-right').getBoundingClientRect();
          return { h: b.height / innerHeight, w: b.width / r.width, tip: pol.bottom - c.top, rim: c.height, left: c.left - r.left }; })()""")
        check("wheel fills the right side", geo["h"] > 0.9 and geo["w"] > 0.85 and 0 < geo["tip"] < geo["rim"] * 0.06, geo)
        # spin → Now playing; spin again → On deck
        page.click("#ptSpin"); page.wait_for_timeout(450)
        land = page.evaluate("""(() => { const w = document.querySelector('#ptRot path.win'); if (!w) return null;
          const b = w.getBoundingClientRect(), c = document.querySelector('#ptRot circle[fill=none]').getBoundingClientRect();
          const dx = (b.left + b.right) / 2 - (c.left + c.right) / 2, dy = (b.top + b.bottom) / 2 - (c.top + c.bottom) / 2;
          return { id: w.getAttribute('data-id'), ang: Math.atan2(dx, -dy) * 180 / Math.PI, onWheel: Array.from(document.querySelectorAll('#ptRot text')).map(x => x.textContent) }; })()""")
        check("lands under the pointer, holds a moment", land is not None and land["id"] == "b2" and abs(land["ang"]) < 36 and "Ben K." in land["onWheel"], land)
        page.wait_for_timeout(1100)
        check("then the name leaves the wheel", "Ben K." not in page.evaluate("Array.from(document.querySelectorAll('#ptRot text')).map(x => x.textContent)"))
        s = page.evaluate("window.__ptest.state()")
        check("spin fills Now playing", s["now"] == "b2" and page.inner_text("#ptNow") == "Ben K.", s)
        ang = page.evaluate("getComputedStyle(document.getElementById('ptRot')).transform")
        page.click("#ptSpin"); page.wait_for_timeout(700)
        s = page.evaluate("window.__ptest.state()")
        check("second spin fills On deck", s["deck"] == "c3" and page.inner_text("#ptDeck") == "Cy L." and page.is_disabled("#ptSpin"), s)
        # the winner's slice ends under the pointer: its text sits at the top of the wheel
        top = page.evaluate("""(() => { const ids = window.__ptest.wheel(); return ids.length; })()""")
        page.click("#ptDone"); page.wait_for_timeout(200)
        s = page.evaluate("window.__ptest.state()")
        check("Done: played, On deck moves up", s["played"] == ["b2"] and s["now"] == "c3" and s["deck"] is None and "Ben K." in page.inner_text("#ptPlayed"), s)
        page.click("#ptLater"); page.wait_for_timeout(200)
        s = page.evaluate("window.__ptest.state()")
        check("Later: back on the wheel", s["now"] is None and "c3" in page.evaluate("window.__ptest.wheel()") and s["later"] == ["c3"], s)
        page.click("#ptUndo"); page.wait_for_timeout(150)
        check("Undo puts Cy back to Now playing", page.evaluate("window.__ptest.state().now") == "c3")
        # absent from the class list
        page.click("#ptClass"); page.click("#ptRoll [data-id='a1']"); page.wait_for_timeout(150)
        cls = page.get_attribute("#ptRoll [data-id='a1']", "class"); page.click("#ptClassClose")
        check("class list: absent = off the wheel", "abs" in cls and "a1" not in page.evaluate("window.__ptest.wheel()") and "absent: 1" in page.inner_text("#ptPlayedH").lower(), cls)
        # spin landing: the picked slice is centered under the pointer (top)
        page.evaluate("window.__ptPick = () => 0"); page.click("#ptSpin"); page.wait_for_timeout(700)
        # progress survives a reload
        page.reload(); page.wait_for_timeout(800)
        page.wait_for_function("document.getElementById('pt').classList.contains('open')", timeout=8000)
        s2 = page.evaluate("window.__ptest.state()")
        check("progress kept after a reload", s2["played"] == ["b2"] and s2["now"] == "c3" and s2["absent"] == ["a1"] and s2["deck"] is not None, s2)
        # 📋 Agenda hides it, 🎯 button brings it back
        page.click("#ptHide"); page.wait_for_timeout(150)
        hid = not page.evaluate("document.getElementById('pt').classList.contains('open')")
        page.evaluate("document.getElementById('btnPtest').click()"); page.wait_for_timeout(150)
        check("📋 Agenda hides, 🎯 reopens", hid and page.evaluate("document.getElementById('pt').classList.contains('open')"))
        if len(sys.argv) > 1:
            page.screenshot(path=sys.argv[1] + "/ptest_board.png")

        # ---- remote
        page.evaluate("window.__ptPick = () => 0; window.__ptSpinMs = 300;")
        page.click("#ptRemote"); page.wait_for_timeout(400)
        code = page.inner_text("#ptCode"); url = page.inner_text("#ptUrl"); qr = page.inner_html("#ptQr")
        check("remote panel: code, link, QR", len(code) == 4 and f"remote.html?c={code}" in url and "<svg" in qr, (code, url))
        page.click("#ptRemoteClose")
        rem = ctx.new_page(); rem.set_viewport_size({"width": 400, "height": 860})
        rem.goto(url); rem.wait_for_timeout(800)
        check("remote asks for the PIN", rem.is_visible("#pin"))
        b4 = page.evaluate("JSON.stringify(window.__ptest.state())")
        rem.evaluate("window.__remote.raw({type: 'act', a: 'done'}); window.__remote.raw({type: 'act', a: 'score', x: {id: 'd4', s: '1'}})")
        rem.wait_for_timeout(400)
        check("no PIN = no control, no scores", page.evaluate("JSON.stringify(window.__ptest.state())") == b4 and rem.evaluate("window.__remote.state()") is None)
        for k in "1111": rem.click(f"#pad [data-k='{k}']")
        rem.click("#pad [data-k='OK']"); rem.wait_for_timeout(500)
        bad = rem.inner_text("#pinErr")
        for k in "2468": rem.click(f"#pad [data-k='{k}']")
        rem.click("#pad [data-k='OK']"); rem.wait_for_timeout(600)
        rtxt = rem.inner_text("#main")
        check("wrong PIN refused, right PIN in", "didn't match" in bad and not rem.is_visible("#pin") and "Cy L." in rtxt and "3rd Block" in rem.inner_text("#title"), (bad, rtxt[:150]))
        check("remote shows the sheet's score", "2" in rem.inner_text("#main") and rem.evaluate("window.__remote.state().scores.e5.s") == "2")
        # score Cy 3 + note, Save & next
        rem.click("#main [data-s='3']"); rem.fill("#note", "steady tempo"); rem.click("#doneBtn"); rem.wait_for_timeout(700)
        s = page.evaluate("window.__ptest.state()")
        check("remote: score + Done moves the board", s["played"][-1] == "c3" and s["scores"]["c3"]["s"] == "3" and s["scores"]["c3"]["st"] == "ok", s)
        check("score saved through the script", any(x["a"] == "ptscore" and x["id"] == "c3" and x["s"] == "3" and x["note"] == "steady tempo" and x["test"] == "F Concert scale, ToE #72" for x in saved), saved)
        check("board never shows the score/note", "steady tempo" not in page.content())
        # spin from the remote
        before = page.evaluate("window.__ptest.state().now")
        rem.click("#main [data-a='spin']"); page.wait_for_timeout(800); rem.wait_for_timeout(300)
        s = page.evaluate("window.__ptest.state()")
        check("remote: spin", s["deck"] is not None or (before is None and s["now"] is not None), s)
        # edit a played student's score from the list
        rem.click("#main [data-edit='c3']"); rem.click("#editCard [data-es='4']"); rem.wait_for_timeout(500)
        check("remote: change a played score", page.evaluate("window.__ptest.state().scores.c3.s") == "4" and saved[-1]["s"] == "4", saved[-1])
        # pick by hand + absent from the remote
        page.evaluate("window.__ptest.act('clear', {slot: 'deck'})"); rem.wait_for_timeout(300)
        left = rem.evaluate("window.__remote.state().wheel")
        rem.click(f"#main [data-who='{left[-1]}']"); rem.click("#chAbs"); rem.wait_for_timeout(400)
        check("remote: mark absent", left[-1] in page.evaluate("window.__ptest.state().absent"))
        # PIN remembered: a new remote page goes straight in
        rem2 = ctx.new_page(); rem2.set_viewport_size({"width": 400, "height": 860}); rem2.goto(url); rem2.wait_for_timeout(900)
        check("PIN remembered on the phone", not rem2.is_visible("#pin") and rem2.evaluate("window.__remote.authed()"))
        if len(sys.argv) > 1:
            rem.screenshot(path=sys.argv[1] + "/ptest_remote.png", full_page=True)

        # ---- menu: off today, then typed test on a block with no slide line
        page.click("#ptMenu"); page.wait_for_timeout(200)
        sub = page.inner_text("#ptSub")
        page.click("#ptToggle"); page.wait_for_timeout(200)
        off = not page.evaluate("document.getElementById('pt').classList.contains('open')")
        check("menu switch shows + turns it off", "from the slide" in sub and off, sub)
        page.click("#ptToggle"); page.fill("#ptText", "Lightly Row"); page.click("#closeMenu")
        page.clock.fast_forward("00:45:00"); page.wait_for_timeout(1500)        # 10:25 → 4th Block, no slide line
        page.wait_for_function("document.getElementById('pt').classList.contains('open')", timeout=8000)
        check("typed test on a block with no slide line", "4th Block" in page.inner_text("#ptTitle") and page.inner_text("#ptTest") == "Lightly Row" and
              page.evaluate("window.__ptest.state().played.length") == 0)
        browser.close()
    srv.shutdown()
    n = len(RESULTS); ok = sum(1 for r in RESULTS if r)
    print(f"{ok}/{n} passed")
    sys.exit(0 if ok == n else 1)


if __name__ == "__main__":
    main()
