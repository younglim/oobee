#!/usr/bin/env node
// Regenerate the CLI help block in README.md / README.ja.md from the built CLI
// so the docs never drift from `npm run cli -- --help`.
//
//   npm run build && node scripts/updateReadmeCliHelp.mjs
//
// The block is the fenced ```shell section between the markers
//   <!-- cli-help:start -->  and  <!-- cli-help:end -->
// Help is rendered at a fixed 80-column width with the version replaced by a
// placeholder, so output is identical on every machine.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START = '<!-- cli-help:start -->';
const END = '<!-- cli-help:end -->';

const renderHelp = lang => {
  const r = spawnSync(process.execPath, [path.join(root, 'dist/cli.js'), '--lang', lang, '--help'], {
    env: { PATH: process.env.PATH, HOME: process.env.HOME, OOBEE_DISABLE_TELEMETRY: '', COLUMNS: '80' },
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`--help (${lang}) exited ${r.status}: ${r.stderr}`);
  // First line is "Oobee version: x.y.z" / "Oobee バージョン: x.y.z".
  return r.stdout.replace(/^(Oobee (?:version|バージョン): ).*$/m, '$1<version>').trimEnd();
};

const update = (file, lang) => {
  const p = path.join(root, file);
  const text = fs.readFileSync(p, 'utf8');
  const s = text.indexOf(START);
  const e = text.indexOf(END);
  if (s === -1 || e === -1 || e < s) throw new Error(`${file}: missing ${START} / ${END} markers`);
  const block = `${START}\n\`\`\`shell\n${renderHelp(lang)}\n\`\`\`\n${END}`;
  const next = text.slice(0, s) + block + text.slice(e + END.length);
  if (next !== text) fs.writeFileSync(p, next);
  console.log(`${file}: ${next === text ? 'up to date' : 'updated'}`);
};

const check = process.argv.includes('--check');
for (const [file, lang] of [['README.md', 'en'], ['README.ja.md', 'ja']]) {
  if (!fs.existsSync(path.join(root, file))) continue;
  if (check) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const want = `${START}\n\`\`\`shell\n${renderHelp(lang)}\n\`\`\`\n${END}`;
    if (!text.includes(want)) {
      console.error(`${file}: CLI help block is out of date. Run: npm run build && node scripts/updateReadmeCliHelp.mjs`);
      process.exitCode = 1;
    }
  } else {
    update(file, lang);
  }
}
