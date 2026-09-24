#!/usr/bin/env node
//
// Checks every copy block in App Store Submission/RELEASE_NOTES_*.md against
// its store limit, so an over-long block is caught here rather than by a paste
// that silently truncates mid-sentence in the console.
//
// The limit comes from the section heading, in parentheses:
//
//   ## Google Play — Short description (80)
//   ## App Store — Promotional Text (170)
//
// so adding a field is a heading and a number rather than a code change.
// Sections with no number in the heading are treated as prose and skipped.
//
// Usage: node scripts/check-release-notes.js [file]

const fs = require('fs');
const path = require('path');

const file =
  process.argv[2] ||
  path.join('App Store Submission', 'RELEASE_NOTES_1.2.0.md');

const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

let section = null;
let limit = null;
let lang = null;
let inBlock = false;
let buf = [];
let failures = 0;
let checked = 0;

const flush = () => {
  if (!limit || !lang) return;
  const text = buf.join('\n').trim();
  const over = text.length > limit;
  if (over) failures++;
  checked++;
  console.log(
    `${over ? 'OVER' : 'ok  '} ${`${section} ${lang}`.padEnd(34)} ` +
      `${String(text.length).padStart(4)} / ${limit}`
  );
};

for (const line of lines) {
  const heading = line.match(/^##\s+(.+?)\s*$/);
  if (heading) {
    const withLimit = heading[1].match(/^(.*?)\s*\((\d+)\)\s*$/);
    section = withLimit ? withLimit[1].trim() : heading[1].trim();
    limit = withLimit ? Number(withLimit[2]) : null;
    lang = null;
    continue;
  }

  const sub = line.match(/^###\s+(.+?)\s*$/);
  if (sub) {
    lang = sub[1].trim();
    continue;
  }

  if (line.trim() === '```') {
    if (inBlock) {
      flush();
      buf = [];
      inBlock = false;
    } else if (limit) {
      inBlock = true;
    }
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
