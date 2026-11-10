// Counts for the Daily Rhythm (tools/rhythm/counts.js) and ClosingScores.gs v1.3 a=rhythm. Made-up data.
const fs = require('fs'), path = require('path'), a = require('assert');
const { countLine } = require('../tools/rhythm/counts');
const N = (d, r) => ({ d, r: !!r });
const even = (m) => ({ start: 0.1, end: 0.3, xs: m.map((_, i) => 0.1 + 0.2 * i / m.length) });
const labels = (meter, ms) => countLine(meter, ms, ms.map(even)).map(c => c[1] + (c[2][0] === 'h' ? '~' : ''));
// 4/4: half note holds 2; dotted quarter + eighth; sixteenths; rests in parentheses
a.deepEqual(labels('4/4', [[N('h'), N('q'), N('q')], [N('qd'), N('8'), N('16'), N('16'), N('16'), N('16'), N('q', 1)],
  [N('8', 1), N('8'), N('8'), N('16'), N('16'), N('h')], [N('w')]]),
  ['1', '2~', '3', '4', '1', '2~', '+', '3', 'e', '+', 'a', '(4)', '(1)', '+', '2', '+', 'a', '3', '4~', '1', '2~', '3~', '4~']);
// 6/8: counts 1-6, sixteenths between = +, dotted-quarter rest = (4) (5) (6)
a.deepEqual(labels('6/8', [[N('qd'), N('q'), N('8')], [N('16'), N('16'), N('8'), N('8'), N('qd', 1)], [N('hd')], [N('8'), N('q'), N('qd')]]),
  ['1', '2~', '3~', '4', '5~', '6', '1', '+', '2', '3', '(4)', '(5)~', '(6)~', '1', '2~', '3~', '4~', '5~', '6~', '1', '2', '3~', '4', '5~', '6~']);
// a measure that doesn't add up is an error, x positions stay inside the measure and in time order
a.throws(() => countLine('3/4', [[N('h')]], [even([1])]), /expected 12/);
const c = countLine('4/4', [[N('h'), N('h')]], [even([1, 2])]);
a.ok(c.every((x, i) => x[0] >= 0.1 && x[0] <= 0.3 && (!i || x[0] > c[i - 1][0])));
a.equal(c[1][0], 0.15);                                    // held beat 2 halfway to the next note head
// the real counts file (if made) matches the images' names
const real = path.join(__dirname, '..', 'tools', 'rhythm', 'out', 'rhythm-counts.json');
if (fs.existsSync(real)) { const j = JSON.parse(fs.readFileSync(real)); a.equal(Object.keys(j.lines).length, 780); }

// the board's copy (rhythm-counts.json at the site root) has every image Code.gs can pick
const board = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rhythm-counts.json')));
a.equal(Object.keys(board.lines).length, 780);
['8th_6-8_060.png', '6beg_2-4_001.png', '7th_3-4_015.png', '6int_4-4_033.png'].forEach(n => a.ok(board.lines[n] && board.lines[n].c.length > 3, n));
a.ok(Object.values(board.lines).every(l => l.b > 1000 && l.c.every(c => c[0] > 0 && c[0] < 1 && /^(\(?([1-6]|e|\+|a)\)?)$/.test(c[1]) && /^(n|r|h|hr)$/.test(c[2]))));

// ---- ClosingScores.gs a=rhythm: which image is on the slide + its size in Drive (cached)
const cache = {}; global.CacheService = { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) };
let sizeReads = 0;
global.DriveApp = { getFolderById: id => ({ getFilesByName: n => { a.equal(id, 'FOLDER'); sizeReads++; let left = n !== 'gone.png';
  return { hasNext: () => left, next: () => { left = false; return { getSize: () => 18457 }; } }; } }) };
const props = { closingKey: 'KEY', rhythm_7th: JSON.stringify({ date: '2026-11-09', name: '7th_3-4_015.png', meter: '3/4' }) };
global.PropertiesService = { getScriptProperties: () => ({ getProperty: k => props[k] || null }) };
global.ContentService = { MimeType: { JSON: 'j' }, createTextOutput: s => ({ setMimeType: () => JSON.parse(s) }) };
global.Session = { getScriptTimeZone: () => 'America/New_York' };
global.CONFIG = { RHYTHM: { FOLDER_ID: 'FOLDER', BLOCKS: { 1: '8th', 3: '7th', 4: '7th', 6: '6int', 7: '6beg' } } };
eval(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'ClosingScores.gs'), 'utf8'));
let r = doGet({ parameter: { a: 'rhythm', block: '4th', k: 'KEY' } });
a.ok(r.ok, r.error); a.equal(r.set, '7th'); a.equal(r.name, '7th_3-4_015.png'); a.equal(r.meter, '3/4'); a.equal(r.date, '2026-11-09');
a.equal(r.bytes, 18457); doGet({ parameter: { a: 'rhythm', block: '3rd', k: 'KEY' } }); a.equal(sizeReads, 1);   // size cached
props.rhythm_6int = JSON.stringify({ name: 'gone.png' }); a.equal(doGet({ parameter: { a: 'rhythm', block: '6th', k: 'KEY' } }).bytes, 0);
a.equal(doGet({ parameter: { a: 'rhythm', block: '3rd', k: 'nope' } }).ok, false);         // key required
a.match(doGet({ parameter: { a: 'rhythm', block: '1st', k: 'KEY' } }).error, /No rhythm has been picked for 8th/);
a.equal(doGet({ parameter: { a: 'rhythm', block: '2nd', k: 'KEY' } }).ok, false);
global.CONFIG.RHYTHM.FOLDER_ID = '';
a.match(doGet({ parameter: { a: 'rhythm', block: '7th', k: 'KEY' } }).error, /Daily Rhythm is off/);
console.log('rhythm counts checks ok');
