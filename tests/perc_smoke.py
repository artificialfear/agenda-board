"""Class jobs: Percussion Captains (2.19.0) + Stage Managers (2.20.0), Mat 11/16: two Percussion Captains a day per percussion block, named on the pack-up screen;
the closing scoreboard asks if the gear is put away; ❌ = Effort can't be a 3 today. Fake names only.
Run: python3 tests/perc_smoke.py [screenshot-folder]"""
import http.server, json, socketserver, sys, threading
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
RESULTS = []
CFG = {"Percussion 1st": "Test A., Test B., Test C.", "Percussion 6th": "Solo S.", "Percussion 3rd": "",
       "Stage Managers 1st": "Wind A., Wind B., Wind C., Wind D., Wind E.", "Stage Managers 3rd": "Wind F., Wind G., Wind H."}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def log_message(self, *a):
        pass


def check(name, ok, extra=""):
    RESULTS.append(ok)
    print(("PASS" if ok else "FAIL"), f"{name:46s}" + ("" if ok else " " + str(extra)[:600]))


def main():
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Quiet)
    port = srv.server_address[1]
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    shots = sys.argv[1] if len(sys.argv) > 1 else None
    url = f"http://127.0.0.1:{port}/index.html"
    state = {"days": ["MON", "TUES", "WED", "THURS", "FRI"], "rows": ["Effort", "Performance", "Attitude"]}
    sets = []

    def reset_values():
        state["values"] = [["", "", "", "", ""] for _ in range(3)]

    def fake_script(route):
        q = {k: v[0] for k, v in parse_qs(urlparse(route.request.url).query, keep_blank_values=True).items()}
        hdr = {"Access-Control-Allow-Origin": "*"}
        if q.get("a") == "config":
            return route.fulfill(status=200, content_type="application/json", headers=hdr, body=json.dumps({"ok": True, "config": CFG}))
        if q.get("a") == "set":
            sets.append(q)
            r = state["rows"].index(q["row"]); c = state["days"].index(q["day"]); state["values"][r][c] = q["v"]
        if q.get("a") in ("get", "set"):
            return route.fulfill(status=200, content_type="application/json", headers=hdr, body=json.dumps(dict(state, ok=True, block=q.get("block"))))
        route.fulfill(status=200, content_type="application/json", headers=hdr, body=json.dumps({"ok": False, "error": "Unknown block"}))

    init = "if (!localStorage.getItem('agendaBoard.settings')) localStorage.setItem('agendaBoard.settings', JSON.stringify({closingUrl: 'https://script.google.com/macros/s/X/exec?k=KEY'}))"

    with sync_playwright() as p:
        browser = p.chromium.launch()

        def board(t, storage=None):
            c = browser.new_context(viewport={"width": 1600, "height": 900}, timezone_id="America/New_York", storage_state=storage)
            c.add_init_script(init)
            c.route("https://docs.google.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>stub</p>"))
            c.route("https://script.google.com/**", fake_script)
            pg = c.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.errs = errs
            pg.clock.install(time=t)
            pg.goto(url); pg.wait_for_timeout(300)
            pg.clock.run_for(2500); pg.wait_for_timeout(200)          # Board Settings arrive (1.5 s after load)
            return c, pg

        PERC = lambda pg, b="1st": pg.evaluate(f"window.__agendaBoard.perc('{b}')")
        CLICK = lambda pg, sel: pg.evaluate(f"document.querySelector(\"{sel}\").click()")

        # 1) Friday 1st Block (ends 8:36): pack-up at 8:30 names two captains
        reset_values()
        ctx, pg = board("2026-11-06T08:29:50")
        check("percussion lists come from Board Settings", pg.evaluate("window.__agendaBoard.settings().perc1st") == CFG["Percussion 1st"])
        pg.clock.fast_forward("00:15"); pg.wait_for_timeout(200)
        txt = pg.inner_text("#packPerc")
        check("pack-up screen names 2 captains", pg.is_visible("#packPerc") and "Percussion Captains: Test A. & Test B." in txt
              and "mallets" in txt, txt)
        check("pack-up screen names 2 Stage Managers", "Stage Managers: Wind A. & Wind B." in txt and "chairs + stands" in txt, txt)
        PFIT = """(() => { const e = document.getElementById('packup'), j = document.getElementById('packPerc').getBoundingClientRect(),
          t = e.querySelector('.p-tap').getBoundingClientRect();
          const apart = t.left >= j.right || t.right <= j.left || t.top >= j.bottom || t.bottom <= j.top;
          return e.scrollHeight <= e.clientHeight + 1 && j.bottom <= innerHeight - 8 && apart; })()"""
        for w, h in ((1600, 900), (1866, 816), (1920, 1080), (1366, 768), (1024, 768)):
            pg.set_viewport_size({"width": w, "height": h}); pg.wait_for_timeout(150)
            check(f"pack-up fits, hint clear of the jobs ({w}x{h})", pg.evaluate(PFIT))
            if shots: pg.screenshot(path=shots + f"/perc_packup_{w}.png")
        pg.set_viewport_size({"width": 1600, "height": 900})
        if shots: pg.screenshot(path=shots + "/perc_packup.png")
        # 2) 8:34 closing scoreboard: the check is there and lit (not answered yet)
        pg.clock.fast_forward("04:00"); pg.wait_for_timeout(400)
        check("scoreboard shows the check", pg.is_visible("#sPerc") and pg.evaluate("document.querySelector(\"#sPerc .pj[data-j='perc']\").classList.contains('up')")
              and pg.evaluate("[...document.querySelectorAll(\"#sPerc .pj[data-j='perc'] .pc-cap\")].map(b => b.textContent)") == ["Test A.", "Test B."])
        check("Stage Managers not on the scoreboard (after the bell)", pg.evaluate("[...document.querySelectorAll('#sPerc .pj')].map(e => e.dataset.j)") == ["perc"])
        check("Stage Managers icon is 🎬 (🪑 is a blank box on the ViewBoard)", "🎬 Stage Managers" in pg.inner_text("#packPerc"), pg.inner_text("#packPerc"))
        if shots: pg.screenshot(path=shots + "/perc_scoreboard.png")
        # Effort 3 given first, then ❌: it drops to 2 and 3 is off
        CLICK(pg, "#sGrid button[data-r='0'][data-v='3']"); pg.wait_for_timeout(400)
        CLICK(pg, "#sPerc .pj[data-j='perc'] .pc-b.miss"); pg.wait_for_timeout(600)
        st = PERC(pg)
        capped = pg.evaluate("(() => { const b = document.querySelector(\"#sGrid button[data-r='0'][data-v='3']\"); return b.disabled && b.classList.contains('capped'); })()")
        check("❌ drops an Effort 3 to 2", state["values"][0][4] == "2" and [s["v"] for s in sets if s["row"] == "Effort"] == ["3", "2"], (state["values"][0], sets))
        check("❌: Effort 3 button off, others on", capped and not pg.evaluate("document.querySelector(\"#sGrid button[data-r='1'][data-v='3']\").disabled"))
        CLICK(pg, "#sGrid button[data-r='0'][data-v='3']"); pg.wait_for_timeout(300)
        check("can't give Effort 3 after ❌", state["values"][0][4] == "2")
        check("❌ note + streak reset", "Effort can't be a 3" in pg.inner_text("#sPerc") and "Streak reset" in pg.inner_text("#sPerc")
              and st["today"]["r"] == "miss" and st["streak"] == 0, st)
        if shots: pg.screenshot(path=shots + "/perc_miss.png")
        FITS = "(() => { const c = document.querySelector('#scores .s-card'); return c.scrollHeight <= c.clientHeight + 1; })()"
        for w, h in ((1600, 900), (1920, 1080), (1366, 768), (1024, 768)):
            pg.set_viewport_size({"width": w, "height": h}); pg.wait_for_timeout(150)
            check(f"scoreboard fits with the check ({w}x{h})", pg.evaluate(FITS))
            if shots: pg.screenshot(path=shots + f"/perc_fit_{w}.png")
        pg.set_viewport_size({"width": 1600, "height": 900})
        # changed mind: ✅ → 3 allowed again (score itself stays where Mat put it)
        CLICK(pg, "#sPerc .pj[data-j='perc'] .pc-b.ok"); pg.wait_for_timeout(300)
        CLICK(pg, "#sGrid button[data-r='0'][data-v='3']"); pg.wait_for_timeout(500)
        st = PERC(pg)
        check("✅: Effort 3 allowed, streak 1", state["values"][0][4] == "3" and st["today"]["r"] == "ok" and st["streak"] == 1
              and "1 day in a row" in pg.inner_text("#sPerc"), (state["values"][0], st))
        check("✅ isn't lit any more", not pg.evaluate("document.querySelector(\"#sPerc .pj[data-j='perc']\").classList.contains('up')"))
        # 2.22.0: after the bell (8:36) the Stage Managers check opens on its own; ❌ = today's Effort 3 → 2 on the slide
        sets.clear()
        pg.clock.fast_forward("02:20"); pg.wait_for_timeout(600)
        check("after the bell: Stage Managers check", pg.is_visible("#jobsChk") and not pg.evaluate("window.__agendaBoard.scores().open")
              and pg.evaluate("[...document.querySelectorAll('#jRows .pj')].map(e => e.dataset.j)") == ["stage"]
              and "after class" in pg.inner_text("#jSub"), pg.inner_text("#jSub"))
        if shots: pg.screenshot(path=shots + "/perc_after.png")
        CLICK(pg, "#jRows .pj[data-j='stage'] .pc-b.miss"); pg.wait_for_timeout(800)
        check("after-class ❌: Effort 3 → 2 on the slide", state["values"][0][4] == "2" and [x["v"] for x in sets] == ["2"]
              and PERC(pg)["streak"] == 1, (state["values"][0], sets))
        check("after-class ❌ note", "a 3 already given is now a 2" in pg.inner_text("#jFoot"))
        pg.clock.fast_forward("00:03"); pg.wait_for_timeout(300)
        check("answered: closes itself after 2 s", not pg.is_visible("#jobsChk"))
        # it closes by itself when the next class starts (at most 10 minutes); 🥁 Jobs brings it back with block chips
        pg.clock.fast_forward("10:00"); pg.wait_for_timeout(400)
        check("closes by itself later", not pg.is_visible("#jobsChk"))
        check("🥁 Jobs button shows", pg.evaluate("getComputedStyle(document.getElementById('btnJobs')).display") != "none")
        CLICK(pg, "#btnJobs"); pg.wait_for_timeout(300)
        check("🥁 Jobs reopens it (all jobs, last block)", pg.is_visible("#jobsChk")
              and pg.evaluate("[...document.querySelectorAll('#jRows .pj')].map(e => e.dataset.j)") == ["perc", "stage"]
              and pg.evaluate("[...document.querySelectorAll('#jSub .j-blk')].map(b => b.textContent)") == ["1st", "3rd", "6th"]
              and pg.evaluate("document.querySelector('#jSub .j-blk.sel').textContent") == "1st")
        CLICK(pg, "#jSub .j-blk[data-b='3rd']"); pg.wait_for_timeout(200)
        check("block chip switches", pg.evaluate("[...document.querySelectorAll('#jRows .pj')].map(e => e.dataset.j)") == ["stage"])
        if shots: pg.screenshot(path=shots + "/perc_jobs_menu.png")
        CLICK(pg, "#jClose")
        check("no page errors (Fri)", not pg.errs, pg.errs)
        store = ctx.storage_state()
        ctx.close()

        # 3) Monday: the next two take a turn (Test C. + Test A.); streak carries; swap an absent captain
        reset_values()
        ctx, pg = board("2026-11-09T08:33:50", store)
        pg.clock.fast_forward("00:15"); pg.wait_for_timeout(400)
        st = PERC(pg)
        check("next day: next two in turn", st["today"]["caps"] == ["Test C.", "Test A."] and st["streak"] == 1, st)
        check("next day: next two Stage Managers", pg.evaluate("window.__agendaBoard.perc('1st', 'stage').today.caps") == ["Wind C.", "Wind D."])
        CLICK(pg, "#sPerc .pj[data-j='perc'] .pc-cap[data-k='1']"); pg.wait_for_timeout(300)
        st = PERC(pg)
        check("tap a name: next one swaps in (absent)", st["today"]["caps"] == ["Test C.", "Test B."], st)
        CLICK(pg, "#sPerc .pj[data-j='perc'] .pc-b.ok"); pg.wait_for_timeout(300)
        check("streak 2 days", PERC(pg)["streak"] == 2 and "2 days in a row" in pg.inner_text("#sPerc"))
        CLICK(pg, "#sPerc .pj[data-j='perc'] .pc-b.ok"); pg.wait_for_timeout(300)
        check("tap ✅ again = not answered", PERC(pg)["today"]["r"] == "" and PERC(pg)["streak"] == 1)
        pg.reload(); pg.wait_for_timeout(300); pg.clock.run_for(2500); pg.wait_for_timeout(200)
        check("same captains after a reload", PERC(pg)["today"]["caps"] == ["Test C.", "Test B."])
        check("no page errors (Mon)", not pg.errs, pg.errs)
        ctx.close()

        # 4) 3rd Block (no percussion): nothing shows. 6th Block with one percussionist: one captain
        reset_values()
        ctx, pg = board("2026-11-06T10:13:50")       # regular 3rd ends 10:20 → pack-up 10:14
        pg.clock.fast_forward("00:15"); pg.wait_for_timeout(300)
        t3 = pg.inner_text("#packPerc")
        check("3rd Block: Stage Managers only on pack-up", pg.evaluate("window.__agendaBoard.pack()")["open"] and "Stage Managers: Wind F. & Wind G." in t3
              and "Percussion" not in t3, t3)
        pg.clock.fast_forward("04:00"); pg.wait_for_timeout(400)
        check("3rd Block: no jobs row on the scoreboard", pg.evaluate("window.__agendaBoard.scores().open") and not pg.is_visible("#sPerc"))
        CLICK(pg, "#sGrid button[data-r='0'][data-v='3']"); pg.wait_for_timeout(400)
        check("3rd Block: Effort 3 as usual", state["values"][0][4] == "3")
        ctx.close()
        ctx, pg = board("2026-11-06T08:29:50")
        check("one percussionist → one captain", pg.evaluate("window.__agendaBoard.perc('6th').today.caps") == ["Solo S."])
        check("no Stage Managers list → none", pg.evaluate("window.__agendaBoard.perc('6th', 'stage').today") is None)
        del CFG["Percussion 6th"]                         # Mat clears the row → the board drops it at the next settings check
        pg.clock.fast_forward("10:30"); pg.wait_for_timeout(300)
        check("emptied row turns the check off", pg.evaluate("window.__agendaBoard.perc('6th').today") is None
              and pg.evaluate("window.__agendaBoard.settings().perc1st") == CFG["Percussion 1st"])
        ctx.close()
        # 5) 2.21.0: Band Ninja day (Tue 11/10, IF schedule, 1st ends 8:25): no scoreboard, a Class jobs check instead
        NINJA = "localStorage.setItem('agendaBoard.ninja', JSON.stringify({date: '2026-11-10', on: true}))"
        reset_values(); sets.clear()
        ctx, pg = board("2026-11-10T08:18:50")
        pg.evaluate(NINJA); pg.reload(); pg.wait_for_timeout(300); pg.clock.run_for(2500); pg.wait_for_timeout(200)
        pg.clock.fast_forward("00:15"); pg.wait_for_timeout(300)
        check("Ninja day: pack-up names the jobs", "Percussion Captains" in pg.inner_text("#packPerc") and "Class jobs check in" in pg.inner_text("#packBell"),
              pg.inner_text("#packBell"))
        pg.clock.fast_forward("04:00"); pg.wait_for_timeout(400)
        check("Ninja day: jobs check opens, no scoreboard", pg.is_visible("#jobsChk") and not pg.evaluate("window.__agendaBoard.scores().open")
              and pg.evaluate("[...document.querySelectorAll('#jRows .pj')].map(e => e.dataset.j)") == ["perc"])
        if shots: pg.screenshot(path=shots + "/perc_ninja.png")
        CLICK(pg, "#jRows .pj[data-j='perc'] .pc-b.miss"); pg.wait_for_timeout(300)
        st = PERC(pg)
        check("Ninja ❌ carries to the next rehearsal", st["state"].get("carry", {}).get("1st", {}).get("from") == "2026-11-10"
              and "next regular rehearsal" in pg.inner_text("#jFoot") and not sets, (st["state"].get("carry"), sets))
        CLICK(pg, "#jClose"); pg.wait_for_timeout(1200)
        check("closed: the pill brings it back", pg.is_visible("#packPill") and pg.inner_text("#packPill").startswith("🥁"))
        CLICK(pg, "#packPill"); pg.wait_for_timeout(200)
        check("pill reopens the check", pg.is_visible("#jobsChk"))
        pg.clock.fast_forward("02:30"); pg.wait_for_timeout(500)      # 8:25 bell → Stage Managers check, Ninja wording
        check("Ninja day: Stage Managers after the bell", pg.is_visible("#jobsChk")
              and pg.evaluate("[...document.querySelectorAll('#jRows .pj')].map(e => e.dataset.j)") == ["stage"]
              and "next regular rehearsal" in pg.inner_text("#jFoot"))
        CLICK(pg, "#jRows .pj[data-j='stage'] .pc-b.ok"); pg.wait_for_timeout(200)
        check("Ninja day: stays carried (perc ❌), no slide writes", PERC(pg)["state"]["carry"]["1st"]["from"] == "2026-11-10" and not sets)
        check("no page errors (Ninja)", not pg.errs, pg.errs)
        store = ctx.storage_state(); ctx.close()
        # Wed 11/11: regular day. Effort already 3 → 2, the 3 is off, the note says why
        reset_values(); state["values"][0][2] = "3"; sets.clear()
        ctx, pg = board("2026-11-11T08:33:50", store)
        pg.clock.fast_forward("00:15"); pg.wait_for_timeout(500)
        check("next rehearsal: Effort 3 → 2", state["values"][0][2] == "2" and [x["v"] for x in sets] == ["2"], (state["values"][0], sets))
        check("next rehearsal: 3 off + why", pg.evaluate("document.querySelector(\"#sGrid button[data-r='0'][data-v='3']\").disabled")
              and "weren't done on Tuesday" in pg.inner_text("#sPerc"), pg.inner_text("#sPerc"))
        if shots: pg.screenshot(path=shots + "/perc_carry.png")
        store = ctx.storage_state(); ctx.close()
        # Thu 11/12: only one rehearsal is affected
        reset_values()
        ctx, pg = board("2026-11-12T08:33:50", store)
        pg.clock.fast_forward("00:15"); pg.wait_for_timeout(400)
        CLICK(pg, "#sGrid button[data-r='0'][data-v='3']"); pg.wait_for_timeout(400)
        check("the day after: Effort 3 again", state["values"][0][3] == "3" and "weren't done" not in pg.inner_text("#sPerc"))
        ctx.close()
        # ❌ then ✅ on a Ninja day: nothing carries
        ctx, pg = board("2026-11-10T08:22:50")
        pg.evaluate(NINJA); pg.reload(); pg.wait_for_timeout(300); pg.clock.run_for(2500); pg.clock.fast_forward("00:15"); pg.wait_for_timeout(300)
        CLICK(pg, "#jRows .pj[data-j='perc'] .pc-b.miss"); CLICK(pg, "#jRows .pj[data-j='perc'] .pc-b.ok"); pg.wait_for_timeout(200)
        check("Ninja ❌ then ✅: no carry", not PERC(pg)["state"].get("carry", {}).get("1st"))
        ctx.close()
        browser.close()
    srv.shutdown()
    n = len(RESULTS); ok = sum(1 for r in RESULTS if r)
    print(f"{ok}/{n} passed")
    sys.exit(0 if ok == n else 1)


if __name__ == "__main__":
    main()
