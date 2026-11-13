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
console.log('rtap scoring: ok');
