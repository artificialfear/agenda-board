# Agenda Board — handoff

Schedule-aware agenda display for Mat's band room ViewSonic viewboard. Leave it open full-screen in the board's built-in browser; it shows the right block's slide from the **Daily Rehearsal (All Band Classes)** Google Slides deck and a Raven Band welcome screen with a clock the rest of the day.

Live URL (once Pages is on): https://artificialfear.github.io/agenda-board/

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
- The deck must be Published to web for the board (not signed in) to show it. Not yet confirmed published 11/6.

## Slide IDs
1st `h6417f591313bdade_2_0`, 3rd `g3f643065e38_0_0`, 4th `h6417f591313bdade_2_16`, 6th `h6417f591313bdade_2_32`, 7th `h6417f591313bdade_2_48`.
If Mat deletes and recreates a block's slide, its ID changes. Fix in Settings → "Schedules and slides", or update `DEFAULTS.blocks` here. Get IDs from the Slides API or from the `#slide=id.…` part of the edit URL when that slide is selected.

## Look
- Welcome screen matches the Raven Band Hub: navy (#1f2a44) + gold (#c9a227), Oswald 600 for the wordmark (bundled in `assets/`, OFL license included), and the Hub's shield logo `assets/raven-logo.png`.
- The logo was extracted from the Hub (artificialfear/raven-hub-code, `src/RavenHubPage.html`) and is only 128×128, so it's capped at 220px tall to limit blur on big boards. A larger original would look sharper.
- Asset URLs carry `?v=<version>`; bump it when an asset changes so the board doesn't serve a cached copy.

## Controls on the board (bottom-right, faded until touched)
- ⟳ refresh now · ⛶ full screen · ☰ menu
- Menu: force any block or the welcome screen (lasts until the next block change, shown by a gold badge bottom-left; tap badge to return to auto), flip today between Regular/IF, Settings.
- Settings live in the board's localStorage only. Export/Import copies them between devices.

## Testing
`python3 tests/smoke.py [--shots DIR]` — serves locally, freezes the clock at 21 times (plus 7 Band Ninja Day checks) across regular/IF/weekend days, stubs Google requests, checks what's shown, and checks a manual override expires at the block change. Must be 28/28 before committing.

## Open items
- Semester 2 start date for the IF Tuesday→Thursday switch.
- Confirm on the real board: full-screen button works in the ViewSonic browser, and the board's clock/time zone is correct.
- Possible later: small countdown or clock overlay on agenda slides; schedule exceptions (assemblies, early release) as dated entries.
