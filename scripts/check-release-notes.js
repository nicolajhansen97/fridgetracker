#!/usr/bin/env node
//
// Checks every block in App Store Submission/RELEASE_NOTES_*.md against the
// store limits, so an over-long block is caught here rather than by a paste
// that silently truncates mid-sentence in the console.
//
//   Google Play "What's new"              500 characters
//   App Store  "What's New in This Version"  4000 characters
//
// Usage: node scripts/check-release-notes.js [file]

const fs = require('fs');
const path = require('path');

const LIMITS = { play: 500, appstore: 4000 };

const file =
  process.argv[2] ||
  path.join('App Store Submission', 'RELEASE_NOTES_1.2.0.md');

const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

let store = null;      // 'play' | 'appstore'
let lang = null;
let inBlock = false;
let buf = [];
let failures = 0;
let checked = 0;

const flush = () => {
  if (!store || !lang) return;
  const text = buf.join('\n').trim();
  const limit = LIMITS[store];
  const over = text.length > limit;
  if (over) failures++;
  checked++;
  const label = `${store === 'play' ? 'Play    ' : 'App Store'} ${lang}`.padEnd(22);
  console.log(
    `${over ? 'OVER' : 'ok  '} ${label} ${String(text.length).padStart(4)} / ${limit}`
  );
};

for (const line of lines) {
  if (/^##\s+Google Play/i.test(line)) { store = 'play'; continue; }
  if (/^##\s+App Store/i.test(line)) { store = 'appstore'; continue; }
  if (/^##\s+Not mentioned/i.test(line)) { store = null; continue; }
  if (/^###\s+/.test(line)) { lang = line.replace(/^###\s+/, '').trim(); continue; }

  if (line.trim() === '```') {
    if (inBlock) { flush(); buf = []; inBlock = false; }
    else if (store) { inBlock = true; }
    continue;
  }
  if (inBlock) buf.push(line);
}

console.log();
console.log(
  failures
    ? `${failures} of ${checked} blocks exceed their limit`
    : `all ${checked} blocks within limits`
);
process.exit(failures ? 1 : 0);
