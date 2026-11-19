// 2.22.2: the band-room ViewBoard runs an older Chrome (about version 87): no :is() / :where() / :has() (a rule using them
// is dropped whole, which left the class job rows unstyled), no emoji newer than ~2016 (🪑 showed an empty box).
// Run: node tests/old_browser_test.js
const fs = require('fs'), path = require('path'), a = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = (html.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');   // comments don't count
['\\:is\\(', '\\:where\\(', '\\:has\\(', '(?<![-\\w])aspect-ratio\\s*:', '@container', 'color-mix\\('].forEach(p => {   // (min-aspect-ratio) media queries are old and fine
  const m = css.match(new RegExp('^.*' + p + '.*$', 'm'));
  a.ok(!m, 'index.html CSS uses ' + p.replace(/\\/g, '') + ' (too new for the ViewBoard): ' + (m && m[0].trim()));
});
// emoji in the class jobs (shown on the board): only ones from Unicode 9 (2016) or older
const NEW = ['🪑', '🧹', '🪣', '🧽', '🧺', '🪥', '🫡'];
NEW.forEach(e => a.ok(!html.includes(e), 'index.html uses ' + e + ' (newer than the ViewBoard emoji font)'));
// 2.29.0: the welcome screen's drifting leaves/bats/snow (season.js) too
const season = fs.readFileSync(path.join(__dirname, '..', 'season.js'), 'utf8');
NEW.concat(['🪺', '🫎', '🪽', '🪶', '❄️‍']).forEach(e => a.ok(!season.includes(e), 'season.js uses ' + e + ' (newer than the ViewBoard emoji font)'));
console.log('old_browser_test: all passed');
