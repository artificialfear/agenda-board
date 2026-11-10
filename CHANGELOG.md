# Changelog

## 2.2.1 — 2026-11-10
- Pack-up screen on Band Ninja days: step 4 says "Have a seat and be ready for class change" (no rehearsal scores those days). The scoreboard already stayed off on Band Ninja days.

## 2.2.0 — 2026-11-10
- 🌍 Map button (bottom-left, next to Book): full-screen "Music Around the World" (map/index.html, also works on its own at /map/).
  Songs: every Tradition of Excellence Book 1 piece with a named origin (71), ♪ count per country, tap a country for its card
  (flag, hello, known for, fun fact, music fact, its songs), tap a song for its pins (song place, composer born/worked, extra places)
  and the miles from Savannah. Search by title, book number, composer, country or instrument. Instruments: where 14 band
  instruments were invented. Timeline: composers by birth year across the eras. Mystery Country: up to 4 clues, Reveal.
  Listen: a YouTube link in the sheet plays inside the map; otherwise "Find on YouTube".
- Content lives in the Content Pool sheet tabs Map Songs / Map Composers / Map Countries (prefilled 11/10); the map falls back to
  map/data.json (tools/map/make_data.py). Needs ClosingScores.gs v1.5 (a=map).
- Closes by itself at class change, like the book.

## 2.1.0 — 2026-11-09
- ♪ Rhythm view: **Show counts** button (next to Count off). Counts start hidden every time the view opens, so students clap/count first, then tap to check. Style (Mat): 1 e + a; 6/8 = 1 2 3 4 5 6 (sixteenths between = +); rests in (parentheses); beats held through by a long note dimmed. Each count sits under its note.
- Daily Rhythms library remade (tools/rhythm, v2): measures sized by what they hold, so busy sixteenth measures never spill over a barline (some v1 7th/8th images did); lines too busy to print cleanly are skipped. Same 780 file names (60 per set + time signature), new rhythms. rhythm-counts.json (site root) has the counts + each image's size; the board shows counts only when the picture in Drive is the same size (so old pictures never get new counts).
- Needs ClosingScores.gs v1.3 (a=rhythm: which image Code.gs put on the block's slide + its size) and the new pictures in the Daily Rhythms folder.

## 2.0.1 — 2026-11-09
- Setup codes removed (Mat chose not to put even an encrypted copy of the closing link on the public site). The welcome-screen warning now says where to paste the link: ☰ → Settings → Closing scores link.

## 2.0.0 — 2026-11-09
- Setup code: ☰ → Settings → 🔑 Enter setup code (or the welcome-screen warning) restores the board's private links from an encrypted setup.json — nothing long to type on the board.
- Welcome-screen warnings: closing scores not connected (with Enter setup code), Daily Slides script unreachable, "tap the board once so the chimes can play" on school days until the first touch.
- Metronome in the ♪ Rhythm view: − / + tempo (4 BPM steps, 40–200), 2/3/4/6 beats, ▶ Count off = one bar of big count numbers with an accented click, then a steady click with beat dots; stops when the view closes. Tempo and beats are remembered.
- Welcome screen: pass-offs this week per class (this week's leader outlined in gold) with the quarter total under each.
- Band Ninja days: "🥋 Pass-off line: n waiting · ✓ n passed today" for the class on screen (from the Dojo's line), every 30 s.
- Needs ClosingScores.gs v1.2 (a=stats, a=line). Counts only, never student names.

## 1.9.1 — 2026-11-09
- The board reads settings from the "Board Settings" tab of the Daily Agenda Content Pool sheet (through the closing-scores script, ClosingScores.gs v1.1, a=config) at start and every 10 minutes, so links don't have to be typed on the board. First one: Method book PDF link.

## 1.9.0 — 2026-11-09
- 📖 Book button: opens the method book PDF (Google Drive link in Settings → "Method book PDF link") full screen in Google's viewer — scroll, zoom. "✕ Back to agenda" closes it; it also closes at class change and reopens on the same page later in the day.

## 1.8.2 — 2026-11-09
- Timer at 0:00: flashes for 8 s, shows a steady "Time's up" for 4 s, then closes and resets itself (was: flashing for a minute).

## 1.8.1 — 2026-11-09
- On agenda slides the buttons (Timer, Closing, Rhythm, ⟳ ⛶ ☰) are hidden; tap anywhere on the board to show them for 5 seconds (10 s in 1.8.1). "Tap for auto" stays visible.
- Taps on the slide no longer reach Google's viewer, so its ◀ ▶ arrows don't appear and students can't flip to another slide.

## 1.8.0 — 2026-11-09
- Pack-up screen step 4: "Have a seat and be ready for rehearsal scores".
- Closing scores go in order: the first category without a score today is highlighted gold (label + glowing outline round its buttons), the ones after it are dimmed; when all three are in it says "✓ All three scores in". Any row can still be corrected.

## 1.7.4 — 2026-11-09
- No more flashing: the 5-minute slide refresh (and block changes) load the fresh slide invisibly behind the one on screen and fade it in 2.5 s after it has loaded.
- Manual-mode badge is smaller and just says "Tap for auto".

## 1.7.3 — 2026-11-08
- Timer: "WARM-UP TIMER" centered over the countdown; ⇄ ⤢ ✕ top-right; while running, "Assemble & warm up" sits midway between the icons and three equal pills (Pause/Resume · Reset · +30s), centered under it.

## 1.7.2 — 2026-11-08
- Timer: once started, the 3/4/5 min and +30s buttons go away, "Assemble & warm up" shows large in their place, and Pause/Resume + Reset are small. Reset brings the presets back.

## 1.7.1 — 2026-11-08
- Warm-up timer is short and wide (time on the left, buttons on the right) and sized to the slide, so bottom-left it sits over the Closing table and never covers the Work Session box. The ♪ Rhythm button waits just to its right; ★ Closing hides while the timer is open.

## 1.7.0 — 2026-11-08
- ♪ Rhythm button (bottom-left, agenda slides): shows the rhythm of the day across the whole board width; tap anywhere (or Esc) to go back to the agenda. Closes itself when the block changes.
- Timer / Closing / Rhythm / manual badge now sit in one row bottom-left.

## 1.6.1 — 2026-11-07
- ☰ → 🧪 Test end of class: plays pack-up → scoreboard → class change for the block on screen (next school day if it's the weekend), 5× faster, with a pink TEST bar and End test. Scores tapped in a test are never sent. Any time can be tried with ?test=YYYY-MM-DDTHH:MM:SS&speed=n.

## 1.6.0 — 2026-11-07
- End of class is one sequence: 6:00 before class change "Pack up time!" (stays up as a countdown to scores), 2:00 before: rising chime + full-screen closing scoreboard (today's 1/2/3 buttons, earlier days, one-line meaning of each number, "Class change in m:ss") until class change. ✕ hides it; the gold pill brings it back. No scoreboard on Band Ninja days or when the slide has no column for today (then pack-up behaves as before).
- "Bell" is now "class change" everywhere (the school has no bells).
- Settings: Closing scoreboard minutes (2, 0 = off), Closing score descriptions (Category | 3 | 2 | 1 per line).

## 1.5.0 — 2026-11-07
- Closing scores: ★ Closing button (bottom-left, agenda slides only) opens a panel like the slide's CLOSING table. Tap 1 / 2 / 3 (or ✕) in today's column for Effort, Performance, Attitude. Saves through the Daily Slides web app (apps-script/ClosingScores.gs) into the slide table and a "Closing Scores" log tab; the slide reloads when the panel closes. Tables clear Mondays ~4 AM. Settings: "Closing scores link".

## 1.4.1 — 2026-11-07
- ☰ menu: IF Day and Band Ninja Day are on/off switches (today only); the menu stays open so you see the change.

## 1.4.0 — 2026-11-06
- Pack-up alert: 6 minutes before each block's bell (regular or IF schedule) the board chimes and flashes a full-screen "Pack up time!" with three steps (pack up your instrument, straighten your chair, push your music stand away from your feet). It flashes 10 s, stays up 45 s (tap to close), then a gold "🎒 Pack up · bell in m:ss" pill stays until the bell (tap it to see the steps again). Once per block per day. Settings: minutes before the bell, 0 = off.

## 1.3.1 — 2026-11-06
- Timer opens in the bottom-left corner of the agenda; running text says "Assemble & warm up".

## 1.3.0 — 2026-11-06
- Warm-up timer: gold ⏱ Timer button (bottom-left). 3/4/5 min, +30s, Start/Pause, Reset. Counts down in a corner over the slide (⇄ moves it, ⤢ full screen). Gold in the last 30 s; at 0 it chimes 3 times and flashes "Time's up · instruments up!", then tucks away after a minute. Keeps counting if hidden and pops back up when done. Remembers the last length and corner on the board.

## 1.2.1 — 2026-11-06
- Band Ninja Day slides restyled to the Raven look; quarter goal box filled each morning by apps-script/NinjaGoals.gs.

## 1.2.0 — 2026-11-06
- Band Ninja Day: on IF days each block shows its grade's Band Ninja Day slide (1st = 8th grade, 3rd/4th = 7th, 6th/7th = 6th) instead of the agenda.
- ☰ menu button turns Band Ninja Day on or off for today (any day). Settings: deck link and "Every IF day / Only when I turn it on".
- Welcome screen says "Band Ninja Day" on those days.

## 1.1.1 — 2026-11-06
- "Band" is gold to match the date and logo.
- Raven logo on both sides of the name, sized to the letter height.

## 1.1.0 — 2026-11-06
- Welcome screen now uses the Raven Band Hub look: gold shield logo, navy background, Oswald lettering, gold date.

## 1.0.0 — 2026-11-06
- First version. Shows the right block's agenda slide automatically on regular and IF days.
- Raven Band welcome screen with clock outside band blocks.
- Agenda appears 3 minutes early so students walking in see it.
- Manual override from the corner menu, ends at the next block change.
- Settings: deck link, IF day and semester switch date, lead-in minutes, refresh rate, theme, schedules.
