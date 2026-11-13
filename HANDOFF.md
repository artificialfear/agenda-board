# Agenda Board — handoff

## Agenda fill from the lesson plan (11/12/2026, Mat; live)
- New apps-script/AgendaFill.gs v1.0 + ClosingScores.gs v1.9 in "Class Agenda – Daily Slide Updater"; web app deployment
  AKfycbw9… now @10 (same URL). Live ClosingScores was checked = main by SHA-256 before the swap. setupAgendaFill run:
  daily ~5:40 AM trigger agendaFillDaily (skips weekends). No new permissions.
- Lesson Plan Generator (school account, repo artificialfear/lesson-plan-generator, Agenda.js) POSTs {k, a:'planPut', weekOf,
  today, days:[{date, blocks:{'1st':[lines]}}], focus:{'1st':{learning, why, success}}} on turn-in (today:false) and on its
  "Send to agenda" button (today:true = fill today now). Stored in Content Pool tabs "Agenda Plan" (Date | Block | Work
  Session | Sent) and "Agenda Focus" (Week Of | Block | Learning | Why | Success | Sent); Mat may edit future rows there.
- Fill: WORK SESSION body replaced under the heading (setText keeps the first item's font + bullets; re-fetch getText()
  after every edit, old ranges go stale); 16 pt, shrinks to 12 if the estimate says it won't fit. FOCUS WALL: only text
  after "Learning:"/"Why:"/"Success:"; blank values leave the line. No row for a day/block = slide untouched.
- Matcher: a concert piece also matches as "Title (mm. 5-20)" / "Repertoire: Title" (core match), so short titles like Joy
  still count from generator lines.
- Checked on real Slides with agendaTryOnCopy (copy trashed): bullets/list kept, Lato, bold gold labels kept; 4 items → 14 pt.
- Mat's choices: Focus Wall weekly per class, 3rd+4th share; Band Ninja days write "Band Ninja: individual practice/pass-offs";
  Opening untouched (rhythm). First real POST not yet exercised (Mat's next turn-in / Send to agenda).
- Tests: node tests/agenda_fill_test.js (break-checked: matcher, stale range, blank focus).

## Latest session (11/10/2026, evening) — read this first
- All live (CHANGELOG 2.1.0 / 2.2.0 / 2.2.1). Apps Script "Class Agenda – Daily Slide Updater"
  (1tptuE3iTnOfA3KI-tAFGK6qCTdEKTFgWh6OiK6WpGoKXvKDLe9tdj_TG: Code.js v2.4, ClosingScores.js v1.5, NinjaGoals.js), web app
  deployment AKfycbw9ThMFeLqxlurKz10_5gzwpOrfmoh2BhsYYksPOsESJ_htNiobf-u4xcMO1zuqbek-CA @6. Content Pool sheet
  1GeHtIMEPq2RIuceFiaXBoGpsz9tYpx442Q7AbzYp79E.
- Rhythm "Show counts": 780 v2 pictures in Drive "Daily Rhythms" (181GxPLTX7enqYu9zmF_XSYkOefgAcBjx; old ones in its
  "Old rhythm pictures" subfolder); rhythm-counts.json at the site root; counts show only when the picture's Drive size
  matches the file's `b`. Generator tools/rhythm (seeded 20261104). Style (Mat): 1 e + a; 6/8 = 1–6; rests in (); held beats dim.
- World map (map/index.html, #btnMap): TOE Book 1 — 71 songs, 20 composers, 58 countries, 14 instruments; modes songs /
  instruments / composer timeline / Mystery Country. Mat edits content in Content Pool tabs Map Songs / Map Composers /
  Map Countries (a=map, cached 60 s); built-in fallback map/data.json from tools/map/make_data.py. Mat's choices: TOE Book 1
  only; music countries + ~40 more; all extras; editable sheet tabs.
- Pack-up step 4 on Band Ninja days: "Have a seat and be ready for class change" (no rehearsal scores).
- NinjaGoals.gs installed in the Daily Slides project.
- Constraints: never publish the closing link/key in this public repo; CDNs are blocked in the container, so d3 / topojson /
  world-atlas are vendored in map/; Apps Script uploads go through Mat's Chrome (the container can't reach script.google.com).
- **2.2.2 map name check (11/10 evening, Mat chose "flag it in the sheet, not on the map"):** map/index.html ALIAS_LIST
  (display spellings → map names, e.g. "Dominican Republic" → "Dominican Rep."), countryName trims, fixCountry also matches
  any case/spacing/accents of a map name (NORMNAME) after the map loads; songs/composers/countries re-resolved at start;
  names still unplaced → window.__map.unmatched + console.warn only (no UI). tools/map/names.js = map names + ALIAS_LIST
  keys (224) → Content Pool hidden tab **Map Names** (sheetId 812345605, A2:A225, written via connector 11/10). Data
  validation ONE_OF_RANGE 'Map Names'!$A$2:$A$300, strict false (warning only), no dropdown, on Map Songs D2:D200,
  Map Composers E2:E100, Map Countries A2:A250, with a help note. **If ALIAS_LIST changes: rerun names.js and re-paste.**
  Tests: smoke 'map country names' + 'map: every Map Names name lands' (48/48).
- Known issues: remote branch "world-map" failed to delete (harmless). Sheet validation may be case-sensitive: a
  lower-case "japan" could get a red corner even though the map accepts it (harmless; retype with capitals).
- Next: nothing pending; wait for Mat's feedback from class use.

Schedule-aware agenda display for Mat's band room ViewSonic viewboard. Leave it open full-screen in the board's built-in browser; it shows the right block's slide from the **Daily Rehearsal (All Band Classes)** Google Slides deck and a Raven Band welcome screen with a clock the rest of the day.

Live URL (once Pages is on): https://artificialfear.github.io/agenda-board/

## 2.7.0 Rhythm moving line (11/13, Mat; live)
- rhythmtime.js (window.RhythmTime / Node module): rhythmTimeline(counts, meter) → {beats, length, points[{x,t,kind,label}],
  onsets, end}; xAt(tl, t); countAt(tl, t). index.html: metroStart remembers t0/off/spb; metroDraw → playDraw(clicks since the
  downbeat after the count-off) moves #rPlay inside #rView and marks the count span .now. Once per Count off.

## 2.8.0 Tap along (11/13, Mat; live, NOT yet tried on the school network)
- rtap.js (board card + RTAP.score / RTAP.calibrate, also loaded by tap.html for scoring) + tap.html (student page).
  Mat's choices 11/13: school Chromebooks + iPads; pick name from the roster; board shows Top 5 + class average; not saved.
- Round message: {t0 (board performance.now ms of 1st count-off click, incl. outputLatency), spb ms, off clicks, onsets (clicks),
  length}. Device: board time − ping offset; count-off taps → delay (median, ±min(300, 0.45 spb)); scores itself; sends result.
- Risk: school Wi-Fi blocking WebRTC/PeerJS for student Chromebooks. First real test = one Chromebook.
- Tests: node tests/rtap_test.js; python3 tests/rtap_smoke.py (board + 2 students over ?peerfake=1).

## 2.6.0 Lunch & Learn (11/12, Mat; live)
- lunch.js (board module; uses __board now/ymd/settings/state/chime). ☰ switches "🥪 Lunch & Learn · 8th grade / 7th grade", today
  only (agendaBoard.lunchOn). Times 8th 11:15–11:40, 7th 12:15–12:35; Content Pool → Board Settings rows "Lunch & Learn 8th/7th"
  (start-end) override (REMOTE_SETTINGS ll8/ll7). Countdown + 3 rules → pack-up 5 min before the end (chime, flash, 4 steps) →
  "Time for Brain Break!" 2 min → closed. Waits while a block is in session (IF day 4th → 11:17). Rules/steps text in RULES/STEPS.
- Tests: python3 tests/lunch_smoke.py (27). Possible next: automatic weekdays if Mat settles on fixed Lunch & Learn days.

## 2.5.0 Playing Test day (11/12, Mat; live)
- ptest.js (board module, uses window.__board from index.html: call/settings/now/ymd/shown/test) + ptnet.js (PeerJS wrapper,
  lazy-loads lib/peerjs.min.js + lib/qrcode.js from Grudgeball; ?peerfake=1 = BroadcastChannel stand-in for tests) + remote.html.
- On: slide line "Playing Test: …" (server a=ptest, cached 60 s) or menu switch (localStorage agendaBoard.ptOn {date,on,text}).
  State per block per day: agendaBoard.pt.<date>.<block> {now, deck, played, absent, later, scores, hist, rot}.
  Score queue: agendaBoard.ptQueue → a=ptscore (retry 20 s). Remote code per day: agendaBoard.ptCode; peer id ravenband-ptest-v1-CODE.
- PIN: Board Settings row "Playing Test PIN" (set to a random 4 digits 11/12; Mat can change it) → settings.ptPin via a=config.
  A remote without the PIN gets nothing and can't act (tested).
- Mat's choices 11/12: slide line + menu; Now playing + On deck; played off the wheel, absent, "later", kept on reload;
  1–4 rubric; scores in a "Playing Tests" tab of the Content Pool sheet; scores only on the remote.
- Tests: node tests/ptest_gs_test.js; python3 tests/ptest_smoke.py (25 checks, board + remote end to end).

## 2.4.0 Book 2 (11/11, Mat sent the Book 2 PDF; live)
- Map Songs column N "Book" ("2" = Book 2, blank = Book 1); rows 83–154 = Book 2 (numbers, plus Ens./Band/Solo pieces);
  Map Composers rows 32–45 new. Server ClosingScores v1.7 deployed @8 via Chrome (same deployment): CLOSING.BOOK_DEFAULT
  {'1st':'2', others '1'}, boardBookOf_, keys "2-n". Map: isBook2 / songNo / showSet "book2"; findSong("2-72").
- No Book 2 passport backfill for 1st Block (Mat: "used book 2 only a little"); it fills as the slides are logged.
- Tests: passport_gs_test.js Book 2 cases, smoke "map: Book 2" (both sabotage-checked).

## 2.3.0 map: today's music, concert music, passport, team game (11/10 night, Mat: "implement all")
- **Server = ClosingScores.gs v1.6, deployed @7 via Chrome** (clasp sign-in is blocked from the session; Monaco model swap after
  checking live = main by SHA-256). setupMapPassport was run: weekday trigger boardPlayedDaily (~3 PM) + 187 "start" rows.
  boardPlayedDaily was run once 11/10 11:33 PM and logged exactly the slides' music (1st Cartoon Christmas + Joy, 3rd/4th Abundant Joy,
  6th Snowstorm + Synergy March, 7th The Dreidel Song; Technique Builder / Foundations ignored).
- Matching rules (boardMatchSongs_): Book 1 numbers (#72, #70-71, #72, 73) and titles only on lines saying ToE / Tradition / Book 1, only
  for CLOSING.BOOK1_BLOCKS (3rd, 4th, 6th, 7th; 8th grade is in Book 2). Concert pieces = Map Songs rows Book # "Concert", filtered by
  Ensemble = CLOSING.BLOCK_BANDS[block]; whole-line match, or contained for titles of 8+ letters ("Joy" never matches "Abundant Joy").
  Mat types "book, pg., song #" (11/10). Page-only lines are NOT matched: the book PDF's text has no reliable page breaks.
- Passport start (Mat 11/10): 1st all of Book 1; 3rd/4th through #80; 6th/7th through The Dreidel Song (CLOSING.PASSPORT_START).
- Content Pool sheet: Map Songs has 10 "Concert" rows (Winter Concert 12/9/26, researched) + new columns L Ensemble, M Check;
  Map Composers 10 new composers + M Check; tab "Map Played" (Date | Block | Song | Book # | Country | How). **Mat to review the
  Check notes**: "A Cartoon Christmas" is arranged by Michael Story (his Program/Song Ideas say Sweeney); composers missing in his
  sheets for Abundant Joy (Adrian B. Sims), Star Taker (Laura Estes), Turbo Rock (Michael Sweeney).
- Board: mapTodayFetch (a=today on each class's agenda, again every 10 min) → #btnMap gold "🌍 Today's music (n)"; mapOpen sends
  {mapShow: {block, today}} (first load: map/?block=&today=a|b). Not on Band Ninja days (no agenda extras then).
- Map: showSet all/book/concert (#setBar in the legend), concert badges green; mode "passport" (#passPanel, a=passport, 60 s, block
  remembered in agendaMap.passBlock, stamped = .land.stamp, others grey); Mystery teams (#mTeams, 2-4 teams, 4/3/2/1 points, scores per day in
  agendaMap.teams); badges spiral apart (≥34 px) with a lead line + 24 px hit circle; timeline x = 40% years + 60% composer order,
  last names (initial if two share one). __map.show / passport / teams / set / badges = test hooks.
- Tests: tests/passport_gs_test.js (node); smoke 'map: concert, links, today', 'map: class passport', 'map: mystery teams',
  "board: today's music button"; smoke now counts its own checks (54).
- Later, if wanted: Book 2 songs for 8th grade (Mat offered the PDF); a timer for team rounds.

## How it works
- Single `index.html`, no build step, no external libraries.
- Deck: `1GVCu1ReJy-BPLXHb7omH8ijtz_c-XRWcftUtRguLMjY` (owned by Mat's personal Gmail, published to web with auto-republish).
- Each block's slide is loaded in an iframe: `/presentation/d/<deck>/embed?start=false&loop=false&rm=minimal&slide=id.<slideId>`. Verified 2026-11-06 in Chrome that the 3rd Block slide loads correctly this way.
- The iframe reloads at every block change and every `refreshMinutes` (default 5) so deck edits show up. Google's auto-republish can itself lag a few minutes.
- Agenda appears `leadMinutes` (default 3) before a block starts, but never before the previous block has ended (3rd→4th and 6th→7th are only ~1 min apart).
- Outside band blocks (before school, 2nd, IF, lunch/5th, after school, weekends): welcome screen with clock, date, IF Day label, and "Next up".

## Schedules (from Mat's sub plan templates, Oct 2026)
| Block | Regular | IF day |
|---|---|---|
| 1st | 7:45–8:36 | 7:45–8:25 |
| 3rd | 9:29–10:20 | 9:51–10:33 |
| 4th | 10:21–11:13 | 10:35–11:17 |
| 6th | 12:54–1:45 | 12:49–1:37 |
| 7th | 1:46–2:30 | 1:39–2:27 |

IF day is Tuesday in fall 2026, Thursday next semester. The switch date is a setting (`switchDate`), blank by default — **open item: Mat needs to set the semester 2 start date.**

## Band Ninja Day (1.2.0, Mat 11/6)
- Mat runs Band Ninja pass-off days on IF days (shorter blocks). Deck "Band_Ninja_Day" `1HLmyd7srbW3C_vkgyAofsAeZ3T4afLs5PmqXTEIKIYU` (personal Gmail): slide p3 = 8th grade, p2 = 7th, p1 = 6th.
- `ninjaBlocks` maps blocks to those slides; `ninjaOnIf` (default true) turns it on every IF day; localStorage `agendaBoard.ninja` {date, on} is the menu's one-day override (any day type).
- IF bell times still come from the IF schedule; only the deck/slide changes.
- The board's embed URL needs anyone-with-link viewing (on since 11/6); Publish to web alone isn't enough.
- Restyled to the Raven look 11/6 (backup copy `1XcNmKWwvx3hh7nYQm2o-j08TmscaMnuyJePIf2nO5Lc`). The goal box has alt-text title `ninja:goal`.
- `apps-script/NinjaGoals.gs` (copy kept here) goes in the Daily Slides Apps Script project as its own file: every morning it puts this quarter's target from Progress Charts → Pass-Off Targets (grade from the slide title) and "Due <quarter end − 5 days, back to Friday on weekends>" into that box. Setup = run `setupNinjaGoalsTrigger` once.

## Slide IDs
1st `h6417f591313bdade_2_0`, 3rd `g3f643065e38_0_0`, 4th `h6417f591313bdade_2_16`, 6th `h6417f591313bdade_2_32`, 7th `h6417f591313bdade_2_48`.
If Mat deletes and recreates a block's slide, its ID changes. Fix in Settings → "Schedules and slides", or update `DEFAULTS.blocks` here. Get IDs from the Slides API or from the `#slide=id.…` part of the edit URL when that slide is selected.

## Look
- Welcome screen matches the Raven Band Hub: navy (#1f2a44) + gold (#c9a227), Oswald 600 for the wordmark (bundled in `assets/`, OFL license included), and the Hub's shield logo `assets/raven-logo.png`.
- The logo was extracted from the Hub (artificialfear/raven-hub-code, `src/RavenHubPage.html`) and is only 128×128, so it's capped at 220px tall to limit blur on big boards. A larger original would look sharper.
- Asset URLs carry `?v=<version>`; bump it when an asset changes so the board doesn't serve a cached copy.

## Warm-up timer (1.3.0, Mat 11/6)
- Mat gives 3–5 min to warm up/assemble; a student runs it. Gold ⏱ Timer pill bottom-left (always visible; the manual-override badge sits beside it). Panel: presets 3/4/5, +30s, Start/Pause/Resume, Reset, ⇄ corner, ⤢ full screen, ✕ hide (keeps counting). Opens bottom-left by default (Mat 11/6); running text "Assemble & warm up".
- Counts to a fixed end time (Date.now). Last 30 s gold; done = WebAudio chime ×3 (audio unlocked on the Start tap) + gold/navy flash; pops open if hidden; resets and closes 60 s after done.
- localStorage `agendaBoard.timer` {min, pos}. Test: 'warm-up timer' in tests/smoke.py.

## Pack-up alert (1.4.0, Mat 11/6)
- `packMinutes` (default 6, Settings, 0 = off) before each block's END by the bell schedule (not the lead-in, not what's on screen; overrides don't matter). Full-screen #packup: flashes 10 s, closes after 45 s or a tap; then #packPill "bell in m:ss" bottom-center until the bell. Fired once per block per day (localStorage `agendaBoard.packDone`, survives reloads).
- Sound: WebAudio chime. Browsers block sound until the page has been touched once since it loaded, so any tap on the board readies it (pointerdown → tUnlockAudio). After the board's browser restarts, someone must touch the page once or the first alert is silent (flash still shows).
- Tests: 3 pack-up cases in tests/smoke.py.

## Closing scores (1.5.0, Mat 11/7)
- Mat's choices: scores 1–3; anyone at the board can enter; cleared Mondays automatically; every score logged.
- Board: #btnScores "★ Closing" shown only when an agenda slide (not welcome, not Band Ninja) is on screen and Settings "Closing scores link" is filled. Panel = the slide's CLOSING table: other days read-only, today's column (header starting MON/TUE/WED/THU/FRI) gets 1/2/3/✕. Taps show at once, saves queued in order (one fetch each), failure → "Not saved · Try again". Slide iframe reloads when the panel closes after a save. Auto-closes after 2 min idle; closes at block change.
- Server: apps-script/ClosingScores.gs in the Daily Slides project, deployed as a Web app (Execute as Mat, Anyone). doGet ?k=<key>&a=get|set&block=&row=&day=&v= (key in Script Property closingKey, made by setupClosingScores). Finds the block slide by "<block> Block Agenda" text + table whose cell(0,0) starts "CLOSING"; rows/columns by label, so Mat can rename days (e.g. TUES next semester when IF moves to Thursday). Writes keep the cell's font/size/bold/color/alignment. Log: Daily Slides content sheet (1GeHtIMEPq2RIuceFiaXBoGpsz9tYpx442Q7AbzYp79E) tab "Closing Scores" (Date | Block | Day | Category | Score | Entered), one row per date+block+category, ✕ deletes it. clearClosingScores trigger Mondays 4 AM.
- Tests: 2 board cases in tests/smoke.py (fake web app), node tests/closing_gs_test.js (fake Slides/Sheets).

## End of class: pack-up → scoreboard (1.6.0, Mat 11/7)
- Mat scores in the last minutes after packing; students self-score from the board, so the scoreboard is full screen. School has no bells: say "class change", never "bell".
- packCheck: packMinutes (6) → #packup, stays up with "Closing scores in m:ss" when a scoreboard is planned (45 s auto-close only when not); scoreMinutes (2) → scoreChime + scoresOpen(true, block) (#scores.big) with #sChange "Class change in m:ss" until class change, then closes. Planned = scoreMinutes>0 + closingUrl + not Band Ninja + (table loaded ⇒ has today's column). Table prefetched when the end-of-class window starts. ✕ → pill "★ Closing scores · class change in…" (tap reopens). Fired once per block/day (packDone key + " score").
- Descriptions: settings.closingDesc lines "Category | 3 | 2 | 1" (Mat's wording shortened 11/7; Performance 1 and Attitude 2/1 written by Claude, Mat to confirm). Shown only on the big scoreboard; the current score's line turns gold.
- Test: 'end of class: pack-up -> scoreboard' in tests/smoke.py.

## Test mode (1.6.1)
- `?test=2026-11-09T08:29:45&speed=5` (speed 1–60): now() runs from that time at that speed. #testBar shows it + End test. In a test: a=set calls are faked (never sent; "Test only · not saved"), pack-up "done" marks aren't stored. Menu 🧪 Test end of class builds the URL: block on screen (else first block), today or next weekday, 15 s before pack-up, speed 5.

## Rhythm of the day, big (1.7.0, Mat 11/8)
- #btnRhythm (agenda slides only, body.can-rhythm) → #rhythm: a second iframe of the same block's slide sized so the rhythm card region (RHYTHM_EMU = rv*_rcard: x 411480, y 1271016, w 5074920, h 566928, +70000 pad; slide 9144000×5143500) is ~96% of the screen width (max 62% height), offset negative inside an overflow:hidden box. Google renders it at that size (sharp). Clicks go to the overlay (iframe pointer-events none). Copy dropped at block change. **If the rhythm card is moved/resized on the slides, update RHYTHM_EMU.** (Card moved 11/8 to y 1271016, h 566928 so OPENING doesn't touch it.)
- Bottom-left #leftBar flex row: Timer · Closing · Rhythm · override badge (moves to top-left while the timer is open).

## Timer size/placement (1.7.1, Mat 11/8)
- Mat: the timer must never cover the Work Session box (ends 64.4% down the slide); covering the Closing table (starts 65.8%) is fine. Compact timer = CSS in --u units (1% of the on-screen slide height, set by tFit() from the window, slide 16:9 centered). Bottom-left: left = slide left + 3% width, bottom = slide bottom + 1.5% height; ~25u tall, 84u wide (inside the Closing area at every size checked: 1280×1024 … 3840×2160). #leftBar moves just right of the open timer; ★ Closing hidden while it's open.
- 1.7.3 (Mat): label in .t-left centered over .t-time; .t-icons first in .t-right (top-right); running: .t-msg flex:1 centered between icons and .t-ctl; #tPlus2 (+30s, same handler) shown only while running; pills 10u wide, centered.
- 1.7.2 (Mat): #timer.running (any state but idle) hides .t-presets, shows .t-msg (now in .t-right) big in gold, shrinks Pause/Resume + Reset.

## No-flash reloads (1.7.4, Mat 11/9 after the first live day)
- Mat saw the board "flash/reload" in class = the refreshMinutes reload blanking the Google embed. loadSlide(url): new iframe.pending (opacity 0) appended behind; on load + SWAP_DELAY (2.5 s) it fades in and the old one is removed. The newest iframe always has id="frame" (tests read #frame src). clearSlides() on the welcome screen.
- Override badge = "Tap for auto" only, smaller.

## Scoring order (1.8.0, Mat 11/9)
- Mat scores Effort → Performance → Attitude. scoresPaint: active = first row with no value in today's column → cells get .up (gold label, gold outline/glow on .s-today); rows after it .later (opacity .38); all done → .s-done "✓ All three scores in". Pack-up list has step 4 "Have a seat and be ready for rehearsal scores" (Mat wrote "score"; plural used, told him).

## Buttons hide on the agenda (1.8.1, Mat 11/9, photo of the board)
- body.on-agenda (set in show()) + no body.ui-awake → #corner and #leftBar buttons opacity 0 / pointer-events none. Any pointerdown → wake() for WAKE_MS (5 s since 11/9, Mat; stays while a .sheet is open). Welcome screen unchanged (corner faint). "Tap for auto" badge always visible.
- #tapCatch (transparent, z 5) covers the slide iframes: taps wake the UI and never reach the Google viewer (its ◀ ▶ arrows were showing and could change slides).
- Tests: smoke.py sets window.__agendaKeepAwake in every context except the 'buttons hide until a tap' check.

## Timer end (1.8.2, Mat 11/9)
- T_FLASH_MS 8000 (class .flash on #timer.done), T_CLOSE_MS 12000 → reset + close.

## Method book (1.9.0, Mat 11/9)
- settings.bookUrl (Drive link, kept only in board Settings — the repo is public and the book is copyrighted, so the file ID is NOT in the code). #btnBook in #leftBar (body.has-book). #book overlay = iframe drive.google.com/file/d/<id>/preview (file must be "anyone with link"); ✕ Back to agenda; closes when shownKey changes (bookSync from show()). iframe src kept, so reopening stays on the page.
- Mat's file 11/9: "Traditions_-_clarinet.pdf" (clarinet edition; told him notes/fingerings are clarinet-specific).

## Settings from the sheet (1.9.1, Mat 11/9: the board can't sign in to Drive, so typing links there is painful)
- ClosingScores.gs v1.1: doGet a=config (key required, no block) → { config: {Setting: Value} } from Content Pool sheet tab "Board Settings" (A Setting | B Value | C Notes; made 11/9 via connector, sheetId 812345601). Mat must replace the file + Deploy → Manage deployments → New version (same URL).
- Board remoteConfig(): 1.5 s after load + every 10 min, if closingUrl is set; REMOTE_SETTINGS maps lower-case names to settings keys ("method book pdf link" → bookUrl); sheet value wins and is saved to localStorage. Errors ignored (older script returns "Unknown block").
- To add another remotely managed setting: add it to REMOTE_SETTINGS and a row in the tab.

## 2.0.0 (Mat 11/9): warnings, metronome, pass-off stats, pass-off line
- **Setup code:** built, then removed in 2.0.1 at Mat's choice (11/9): no copy of the closing link (even encrypted) goes on the public site. If the board's settings are wiped, the closing link is retyped in Settings; the warning says where.
- **Warnings** (#warns on the welcome screen, refreshWarns every 30 s): no closingUrl; ≥2 failed config fetches; school-hours "tap once" until the first pointerdown (redraw delayed 700 ms so it doesn't swallow the tap).
- **Metronome** (#metro inside #rhythm, clicks stopPropagation): WebAudio lookahead scheduler (25 ms tick, 120 ms ahead), square clicks 1760/1175 Hz, first bar = count-off shown as big numbers in #rTitle (fixed 13vh height), dots per beat. agendaBoard.metro {bpm, beats}. Stops on rhythmClose.
- **Stats** (#stats on the welcome screen): a=stats every 5 min while the welcome screen shows; per block {today, week (since Monday), quarter (Pass-Off Targets: Q start = previous Ends + 1; Q1 from "School year starts")} from Admin "Pass-Off Log" dated rows only. Leader by week outlined. settings.showStats === false hides it.
- **Line pill** (#linePill, top-right of the slide, Band Ninja slides only): a=line&block= every 30 s → waiting = today's "Pass-Off Line" rows (Progress Charts, newest 400) for "<block> Block" with blank Status; passedToday = today's Pass-Off Log rows for that block. Script caches stats 60 s, line 20 s.
- ClosingScores.gs v1.2 needs Mat to replace the file + Deploy → Manage deployments → New version. Tests: tests/board_counts_test.js, closing_gs_test.js (node), 5 new smoke cases.

## Rhythm counts (2.1.0, Mat 11/9; installed 11/9 ~11:40 PM: ClosingScores v1.4 deployed @5 by clasp, Mat granted full Drive; 779 pictures replaced + 1 same, old ones in Daily Rhythms/Old rhythm pictures 1--J8fXQQW6jS0-cqTeTz4VRN2wfN6Myr)
- "Show counts" (#mCounts in the metronome row, only with a closing link) toggles #rCounts under the zoomed rhythm; hidden again on every open (students try first). rhythmOpen → countsFetch: a=rhythm&block= (ClosingScores.gs v1.3: Script Property rhythm_<set> from Code.gs CONFIG.RHYTHM.BLOCKS → {name, meter, date, bytes = Drive file size, cached 10 min}) + ./rhythm-counts.json (fetched once). Counts shown only when lines[name].b === bytes, else "new rhythm pictures aren't in the folder yet".
- rhythm-counts.json: { v: 2, img: {w:1400,h:160}, lines: { name: { m: meter, b: bytes, c: [[x, label, kind]] } } }; x = fraction of image width (note head centre; held beats spread evenly between notes); kind n/r/h/hr. Board places x at RHYTHM_IMG_EMU (x 603940, w 4690000: Code.gs daily:rhythm image on every agenda slide) using rhythmLayout's px/EMU; font = min gap between labels (2.6–6vh).
- Generator: tools/rhythm (render.js, gen.js, counts.js; vexflow 4.2.5, jsdom 31.0.0, @resvg/resvg-js 2.6.2; `npm install && node gen.js out`). Seeded (20261104) so it is reproducible; v1 (11/4) was reproduced byte for byte before changing. v2: measure widths = VexFlow min width ×1.25 (≥ 6 units per sixteenth), leftover shared equally, justify 17 units short of the barline (v1 look); fitsLine rejects lines needing <1.12× min. **Images and rhythm-counts.json must always come from the same run** — copy out/rhythm-counts.json to the site root.
- Upload (ClosingScores.gs v1.4 doPost a=rhythmPut, key, ≤40 per call, rhythm names only): new PNG in the Daily Rhythms folder, a different old one moved to its subfolder "Old rhythm pictures" (never deleted; same size = skipped, so re-running is safe). The pictures are also published at rhythm-pictures/ on the site so a browser tab can send them.
- Daily Slides Apps Script project = "Class Agenda – Daily Slide Updater" 1tptuE3iTnOfA3KI-tAFGK6qCTdEKTFgWh6OiK6WpGoKXvKDLe9tdj_TG (files Code.js v2.4, ClosingScores.js, NinjaGoals.js — added + setupNinjaGoalsTrigger run 11/10 6:39 AM: daily ~5 AM trigger). Web app deployment AKfycbw9ThMFeLqxlurKz10_5gzwpOrfmoh2BhsYYksPOsESJ_htNiobf-u4xcMO1zuqbek-CA (always update this one: clasp deploy -i … -V n). Two other projects with the same name are older copies.
- Tests: tests/rhythm_counts_test.js (counting rules, the 780-entry file, a=rhythm, rhythmPut), 2 smoke cases (alignment screenshot with the real picture when tools/rhythm/out exists).

## World map (2.2.0, Mat 11/10; live 11/10 9:45 AM: board pushed, ClosingScores v1.5 deployed @6, checked on the real link reading the sheet)
- #btnMap → #mapView (z 34, like the book) with an iframe of map/ (loaded once, kept; mapSync closes it at class change; the map's ✕ posts {agendaMap:'close'}).
- map/index.html: d3 7.9.0 + topojson-client 3.1.0 + world-atlas 2.0.2 countries-110m.json, all vendored in map/ (npm pack; CDNs are blocked from the build box).
  Natural Earth projection, d3.zoom (1–14×); markers drawn in screen space. Continent colors from each country's centroid (BYNAME exceptions);
  badge spots for far-flung countries in CENTER. Modes: map (songs), instruments, timeline, mystery. window.__map = test hook.
- Content: map/data.json (built-in, from tools/map/make_data.py: songs = book titles + the book's own origin label only, never music/lyrics;
  facts checked 11/10). The Content Pool sheet (1GeHtIMEPq2RIuceFiaXBoGpsz9tYpx442Q7AbzYp79E) tabs **Map Songs** (Book # | Title | Book says | Country |
  Place | Lat | Lon | Composer | Fun fact | YouTube link | Show), **Map Composers** (Composer | Years | Born year | Era | Country | Born place/lat/lon |
  Worked place/lat/lon | Fun fact), **Map Countries** (Country | Flag | Continent | Hello | Known for | Fun fact | Music fact) win when they have rows
  (ClosingScores.gs v1.5 a=map, cached 60 s; songs replace the list, composers/countries merge by name; Show = No hides; country names like USA/England
  are mapped to the map's names). Needs the closing link in the board settings (localStorage, same origin) to read the sheet.
- Tests: 2 smoke cases (board button/close/class change, map content, mystery redaction; sheet override), tests/map_gs_test.js.

## Controls on the board (bottom-right, faded until touched)
- ⟳ refresh now · ⛶ full screen · ☰ menu
- Menu: force any block or the welcome screen (lasts until the next block change, shown by a gold badge bottom-left; tap badge to return to auto), IF Day and Band Ninja Day switches (today only, role=switch, menu stays open), Settings.
- Settings live in the board's localStorage only. Export/Import copies them between devices.

## Testing
`python3 tests/smoke.py [--shots DIR]` — serves locally, freezes the clock at 21 times (plus 7 Band Ninja Day checks) across regular/IF/weekend days, stubs Google requests, checks what's shown, and checks a manual override expires at the block change. Must be 28/28 before committing.

## Open items
- Semester 2 start date for the IF Tuesday→Thursday switch.
- Pass-Off Targets: Q2 changed to 10/30/50 on 11/6, so 8th Q3 (47) is now below Q2 and 7th Q2 = Q3 (30). Mat to review Q3/Q4.
- Confirm on the real board: full-screen button works in the ViewSonic browser, and the board's clock/time zone is correct.
- Possible later: small countdown or clock overlay on agenda slides; schedule exceptions (assemblies, early release) as dated entries.
