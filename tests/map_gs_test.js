// ClosingScores.gs v1.5 a=map: the World Map tabs come back as {header: value} rows; blanks skipped; missing tab = []. Made-up data.
const fs = require('fs'), path = require('path'), a = require('assert');
const cache = {}; global.CacheService = { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) };
global.PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k === 'closingKey' ? 'KEY' : null) }) };
global.ContentService = { MimeType: { JSON: 'j' }, createTextOutput: s => ({ setMimeType: () => JSON.parse(s) }) };
global.Session = { getScriptTimeZone: () => 'America/New_York' };
const tab = vals => ({ getLastRow: () => vals.length, getLastColumn: () => vals[0].length,
  getRange: (r, c, nr, nc) => ({ getDisplayValues: () => vals.slice(r - 1, r - 1 + nr).map(x => x.slice(c - 1, c - 1 + nc)) }) });
let reads = 0;
const tabs = {
  'Map Songs': tab([['Book #', ' Title ', 'Country', ''], ['116', 'Ode Tune', 'Austria', 'x'], ['', '', '', ''], ['12', 'Cuckoo', ' Austria ', '']]),
  'Map Countries': tab([['Country', 'Known for'], ['Peru', 'Llamas']])
};
global.SpreadsheetApp = { openById: () => ({ getSheetByName: n => { reads++; return tabs[n] || null; } }) };
eval(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'ClosingScores.gs'), 'utf8'));
let r = doGet({ parameter: { a: 'map', k: 'KEY' } });
a.ok(r.ok, r.error);
a.deepEqual(r.songs, [{ 'Book #': '116', Title: 'Ode Tune', Country: 'Austria' }, { 'Book #': '12', Title: 'Cuckoo', Country: 'Austria' }]);
a.deepEqual(r.countries, [{ Country: 'Peru', 'Known for': 'Llamas' }]);
a.deepEqual(r.composers, []);                                            // tab missing
const before = reads; doGet({ parameter: { a: 'map', k: 'KEY' } }); a.equal(reads, before);   // cached
a.equal(doGet({ parameter: { a: 'map', k: 'nope' } }).ok, false);        // key required
console.log('map tabs checks ok');
