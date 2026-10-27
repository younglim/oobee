// Unit tests for the localised CLI help and messages (src/i18n/cli.ts,
// cliText.ts, locales/*/cli.json) and the rendered dist/cli.js --help.
//   npm run build && node --use-system-ca --test tests/cliHelp.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.OOBEE_DISABLE_TELEMETRY = '1';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = p => pathToFileURL(path.join(root, 'dist', p)).href;
const stringWidth = createRequire(import.meta.url)('string-width');
const { tc } = await import(dist('i18n/cliText.js'));
const { getLocalizedCliOptions, getCliExamplesEpilogue, getYargsLocale } = await import(dist('i18n/cli.js'));
const { cliOptions } = await import(dist('constants/cliFunctions.js'));

describe('localised CLI text', () => {
  test('English descriptions are unchanged from cliFunctions.ts', () => {
    const en = getLocalizedCliOptions('en');
    for (const [key, option] of Object.entries(cliOptions)) assert.equal(en[key].describe, option.describe, `-${key}`);
  });

  test('Japanese descriptions are translated; other option fields are untouched', () => {
    const ja = getLocalizedCliOptions('ja');
    for (const [key, option] of Object.entries(cliOptions)) {
      assert.match(ja[key].describe, /[\u3040-\u30ff\u4e00-\u9fff]/, `-${key} is not Japanese`);
      const { describe: _a, ...restJa } = ja[key];
      const { describe: _b, ...restEn } = option;
      assert.deepEqual(Object.keys(restJa), Object.keys(restEn), `-${key}`);
      assert.equal(ja[key].default, option.default, `-${key} default`);
      assert.deepEqual(ja[key].choices, option.choices, `-${key} choices`);
    }
  });

  test('messages interpolate and fall back to the key', () => {
    const vars = { value: 'x', flag: '-h, --headless' };
    assert.equal(tc('messages.invalidYesNo', vars, 'en'), 'Invalid value "x" for -h, --headless. Use "yes" or "no".');
    assert.equal(tc('messages.invalidYesNo', vars, 'ja'), '-h, --headless の値 "x" は無効です。"yes" または "no" を指定してください。');
    assert.equal(tc('messages.doesNotExist', undefined, 'ja'), 'messages.doesNotExist');
  });

  test('examples keep the exact commands in every language', () => {
    for (const lang of ['en', 'ja']) {
      const text = getCliExamplesEpilogue(lang);
      for (const scanner of ['1 | sitemap', '2 | website', '3 | custom']) {
        assert.ok(text.includes(`npm run cli -- -c [ ${scanner} ] -u <url_link> \\`), `${lang}: ${scanner}`);
      }
    }
    assert.equal(getYargsLocale('ja'), 'ja');
    assert.equal(getYargsLocale('en'), 'en');
  });

  test('cli.json bundles have identical keys and placeholders', () => {
    const read = l => JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales', l, 'cli.json'), 'utf8'));
    const flat = (o, p = '') =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
    const ph = s => (String(s).match(/\{\{\w+\}\}/g) || []).sort().join(',');
    const at = (o, k) => k.split('.').reduce((a, p) => a?.[p], o);
    const en = read('en');
    const ja = read('ja');
    assert.deepEqual(flat(ja).sort(), flat(en).sort());
    for (const k of flat(en)) assert.equal(ph(at(ja, k)), ph(at(en, k)), k);
  });
});

describe('dist/cli.js --help', () => {
  const run = (env, args = ['--help']) =>
    spawnSync(process.execPath, [path.join(root, 'dist/cli.js'), ...args], {
      env: { PATH: process.env.PATH, HOME: process.env.HOME, OOBEE_DISABLE_TELEMETRY: '1', ...env },
      encoding: 'utf8',
    });
  const widest = text => Math.max(...text.split('\n').map(l => stringWidth(l)));

  test('LANG=ja_JP.UTF-8 prints Japanese help that fits 80 columns', () => {
    const r = run({ LANG: 'ja_JP.UTF-8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^Oobee バージョン: /);
    assert.match(r.stdout, /\nオプション:\n/);
    assert.match(r.stdout, /ヘルプを表示/);
    assert.ok(widest(r.stdout) <= 80, `widest line is ${widest(r.stdout)} columns`);
  });

  test('LANG=en_US.UTF-8 prints English help that fits 80 columns', () => {
    const r = run({ LANG: 'en_US.UTF-8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^Oobee version: /);
    assert.match(r.stdout, /\nOptions:\n/);
    assert.doesNotMatch(r.stdout, /[\u3040-\u30ff]/);
    assert.ok(widest(r.stdout) <= 80, `widest line is ${widest(r.stdout)} columns`);
  });

  test('--lang en overrides a Japanese terminal', () => {
    assert.match(run({ LANG: 'ja_JP.UTF-8' }, ['--lang', 'en', '--help']).stdout, /^Oobee version: /);
  });

  test('yargs built-in errors are localised too', () => {
    const r = run({ LANG: 'ja_JP.UTF-8' }, []);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /必須の引数が見つかりません: c, u/);
  });
});
