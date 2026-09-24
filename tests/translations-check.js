const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const transDir = path.join(rootDir, 'translations');
const htmlFile = path.join(rootDir, 'html/index.html');
const srcDir = path.join(rootDir, 'src');

console.log('Running translations validation check...');

// 1. Check all JSON files exist and have identical key sets
const jsonFiles = fs.readdirSync(transDir).filter(f => f.endsWith('.json'));
assert(jsonFiles.length >= 23, `Expected at least 23 translation files, found ${jsonFiles.length}`);

const enPath = path.join(transDir, 'en.json');
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const enKeys = new Set(Object.keys(enData));

for (const file of jsonFiles) {
  const filePath = path.join(transDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const fileKeys = new Set(Object.keys(data));

  const missingInFile = [...enKeys].filter(k => !fileKeys.has(k));
  assert.strictEqual(
    missingInFile.length,
    0,
    `${file} is missing keys from en.json: ${missingInFile.join(', ')}`
  );

  const extraInFile = [...fileKeys].filter(k => !enKeys.has(k));
  assert.strictEqual(
    extraInFile.length,
    0,
    `${file} has extra keys not in en.json: ${extraInFile.join(', ')}`
  );
}
console.log(`✓ All ${jsonFiles.length} translation files have identical ${enKeys.size} keys.`);

// 2. Check HTML data-translate attributes
const htmlContent = fs.readFileSync(htmlFile, 'utf8');

const dtMatches = [...htmlContent.matchAll(/data-translate(?:-placeholder|-title)?=["']([^"']+)["']/g)];
assert(dtMatches.length > 0, 'Should find data-translate elements in index.html');

for (const m of dtMatches) {
  const key = m[1];
  assert(enKeys.has(key), `Key "${key}" used in HTML attribute is missing in en.json`);
}
console.log(`✓ All ${dtMatches.length} data-translate attributes reference valid translation keys.`);

// 3. Check sidebar buttons have data-translate-title
const sidebarButtons = [
  'sidebarCollapseBtn',
  'homeWin',
  'searchWin',
  'playlistWin',
  'compressorWin',
  'historyWin',
  'preferenceWin',
  'aboutWin'
];

for (const btnId of sidebarButtons) {
  const btnRegex = new RegExp(`<button[^>]*id=["']${btnId}["'][^>]*>`, 'i');
  const match = htmlContent.match(btnRegex);
  assert(match, `Sidebar button #${btnId} not found in index.html`);
  assert(
    match[0].includes('data-translate-title='),
    `Sidebar button #${btnId} is missing data-translate-title attribute`
  );
}
console.log(`✓ All ${sidebarButtons.length} sidebar buttons have data-translate-title attributes.`);

// 4. Check i18n.__ calls in src
const srcFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.js'));
for (const sf of srcFiles) {
  const content = fs.readFileSync(path.join(srcDir, sf), 'utf8');
  const calls = [...content.matchAll(/(?:window\.)?i18n\.__\(\s*["']([^"']+)["']\s*\)/g)];
  for (const c of calls) {
    const key = c[1];
    assert(enKeys.has(key), `i18n.__("${key}") in ${sf} does not exist in en.json`);
  }
}
console.log('✓ All i18n.__ calls in src/ reference valid translation keys.');
console.log('All checks passed successfully!');
