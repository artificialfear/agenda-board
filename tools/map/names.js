// Builds the list for the Content Pool sheet's hidden "Map Names" tab: every country name the world map accepts.
// = the map's own country names (map/countries-110m.json) + the friendly spellings in map/index.html ALIAS_LIST.
// The Country columns of Map Songs / Map Composers / Map Countries use this tab as a "warning only" check, so a name
// the map would quietly leave off gets a red corner in the sheet (Mat's choice 11/10: flag it in the sheet, not on the map).
//
// Run:  node tools/map/names.js          → one name per line (paste into Map Names!A2)
//       node tools/map/names.js --json   → JSON array
// Re-run and re-paste whenever ALIAS_LIST changes.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');

function aliasList() {
  const html = fs.readFileSync(path.join(ROOT, 'map', 'index.html'), 'utf8');
  const m = html.match(/var ALIAS_LIST = (\{[\s\S]*?\});/);
  if (!m) throw new Error('ALIAS_LIST not found in map/index.html');
  return JSON.parse(m[1]);
}
function mapNames() {
  const w = JSON.parse(fs.readFileSync(path.join(ROOT, 'map', 'countries-110m.json'), 'utf8'));
  return w.objects.countries.geometries.map(g => g.properties.name);
}
function names() {
  const map = mapNames(), alias = aliasList(), have = new Set(map);
  const bad = Object.keys(alias).filter(k => !have.has(alias[k]));
  if (bad.length) throw new Error('ALIAS_LIST points at names the map does not have: ' + bad.map(k => k + ' → ' + alias[k]).join(', '));
  return Array.from(new Set(map.concat(Object.keys(alias)))).sort((a, b) => a.localeCompare(b, 'en'));
}
module.exports = { names, aliasList, mapNames };
if (require.main === module) {
  const list = names();
  console.log(process.argv.includes('--json') ? JSON.stringify(list) : list.join('\n'));
}
