// 2.8.0 rtap.js scoring + device-delay calibration (pure functions; also used by tap.html).
const a = require('assert');
global.window = {}; global.document = { getElementById: () => null };
require('../rtap.js');
const { score, calibrate } = window.RTAP;
const on = [0, 500, 1000, 1250, 1500, 2000];                      // quarter, quarter, eighth eighth, quarter… at 120 bpm
let r = score(on, on.slice());
a.deepEqual([r.perfect, r.good, r.miss, r.extra, r.pct], [6, 0, 0, 0, 100]);
r = score(on, on.map(t => t + 90));                                  // all a bit late: Good (windows: 140, or half the gap)
a.deepEqual([r.perfect, r.good, r.miss, r.pct], [0, 6, 0, 60]);      // 90 ms late: past Perfect (70), inside Good
r = score(on, [0, 500, 1000, 1500, 2000]);                          // skipped one eighth
a.deepEqual([r.perfect, r.miss, r.pct], [5, 1, 83]);
r = score(on, on.concat([250, 750]));                                // two extra taps on rests
a.deepEqual([r.perfect, r.extra, r.pct], [6, 2, 92]);
r = score(on, [-1000, -500].concat(on, [2600, 3000]));             // count-off taps and taps after the end don't count
a.deepEqual([r.perfect, r.extra, r.pct], [6, 0, 100]);
r = score(on, []); a.deepEqual([r.miss, r.pct], [6, 0]);
r = score(on, on.map(() => 1000)); a.ok(r.pct < 20 && r.extra >= 4);   // mashing at one moment scores low
// sixteenths at 120 bpm (125 ms apart): windows shrink so one tap can't claim two notes
const six = [0, 125, 250, 375];
r = score(six, [10, 130, 240, 380]); a.deepEqual([r.perfect, r.good, r.miss], [4, 0, 0]);
r = score(six, [60]); a.deepEqual([r.perfect + r.good, r.miss], [1, 3]);
a.ok(score(six, [0, 0, 125]).extra === 1);
// the score never goes below 0 or above 100
a.equal(score([0], [0, 50, -50, 100, -100]).pct, 0);
// calibration: median of tap − click, ignoring wild taps; null with fewer than 2
a.equal(calibrate([0, 600, 1200, 1800], [80, 690, 1270, 1885], 600), 83);     // 80 90 70 85 → median 82.5
a.equal(calibrate([0, 600, 1200, 1800], [80, 1500], 600), null);    // 1500 is 300 from both clicks: too wild, so only 1 good tap
a.equal(calibrate([0, 600], [], 600), null);
a.equal(calibrate([0, 600, 1200], [-40, 560, 1170], 600), -40);
// 2.9.1 aligned scoring: a steady lag is forgiven (even with no count-off), uneven taps aren't, and it can't slide onto other notes
const { scoreAligned } = window.RTAP;
const sixteenths = [0, 500, 750, 875, 1000, 1500, 1625, 1750, 2000];      // 120 bpm with sixteenths
r = score(sixteenths, sixteenths.map(t => t + 110)); a.ok(r.pct < 60, 'plain score punishes a steady 110 ms lag: ' + r.pct);
r = scoreAligned(sixteenths, sixteenths.map(t => t + 110), 0, 150);
a.deepEqual([r.pct, r.perfect, r.shift], [100, 9, 110]);
r = scoreAligned(sixteenths, sixteenths.map(t => t - 80), 40, 150); a.deepEqual([r.pct, r.shift], [100, -80]);
const jitter = [0, 90, -100, 60, -70, 110, -90, 80, -60];                  // uneven playing stays uneven
r = scoreAligned(sixteenths, sixteenths.map((t, i) => t + jitter[i]), 0, 150); a.ok(r.pct < 75, 'uneven ' + r.pct);
// quarters played on the "+" at 120 bpm (range = 0.3 beat = 150): never Perfect, at best Good
r = scoreAligned([0, 500, 1000, 1500], [250, 750, 1250, 1750], 0, 150); a.ok(r.perfect === 0 && r.pct <= 60, 'offbeat ' + r.pct);
r = scoreAligned([0, 750, 1500, 2250], [375, 1125, 1875, 2625], 0, 200); a.equal(r.pct, 0);   // 80 bpm: off by an eighth = all missed
r = scoreAligned([0, 250, 500], [], 0, 150); a.equal(r.pct, 0);
console.log('rtap scoring: ok');
