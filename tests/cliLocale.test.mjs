// Unit tests for CLI language detection (src/i18n/detectLocale.ts). Runs
// against dist/ like the other unit suites:
//   npm run build && node --use-system-ca --test tests/cliLocale.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.OOBEE_DISABLE_TELEMETRY = '1';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = p => pathToFileURL(path.join(root, 'dist', p)).href;
const { detectCliLanguage, languageFromEnv, langFromArgv } = await import(dist('i18n/detectLocale.js'));
const { getLanguage } = await import(dist('i18n/index.js'));

const os = lang => () => lang;

describe('detectCliLanguage priority', () => {
  test('explicit --lang wins over everything', () => {
    assert.equal(detectCliLanguage({ explicit: 'en', env: { OOBEE_LANG: 'ja', LANG: 'ja_JP.UTF-8' }, osLanguage: os('ja') }), 'en');
    assert.equal(detectCliLanguage({ explicit: 'ja', env: { LANG: 'en_US.UTF-8' }, osLanguage: os('en') }), 'ja');
  });

  test('OOBEE_LANG wins over terminal and OS locale', () => {
    assert.equal(detectCliLanguage({ env: { OOBEE_LANG: 'ja', LANG: 'en_US.UTF-8' }, osLanguage: os('en') }), 'ja');
    assert.equal(detectCliLanguage({ env: { OOBEE_LANG: 'en', LC_ALL: 'ja_JP.UTF-8' }, osLanguage: os('ja') }), 'en');
  });

  test('POSIX order: LC_ALL > LC_MESSAGES > LANG > LANGUAGE', () => {
    assert.equal(languageFromEnv({ LC_ALL: 'ja_JP.UTF-8', LC_MESSAGES: 'en_US', LANG: 'en_US' }), 'ja');
    assert.equal(languageFromEnv({ LC_MESSAGES: 'ja_JP', LANG: 'en_US' }), 'ja');
    assert.equal(languageFromEnv({ LANG: 'ja_JP.eucJP' }), 'ja');
    assert.equal(languageFromEnv({ LANGUAGE: 'ja:en' }), 'ja');
    assert.equal(languageFromEnv({ LANG: 'en_US.UTF-8', LANGUAGE: 'ja' }), 'en');
  });

  test('C/POSIX/empty locale variables count as unset and fall through to the OS', () => {
    assert.equal(detectCliLanguage({ env: { LANG: 'C' }, osLanguage: os('ja') }), 'ja');
    assert.equal(detectCliLanguage({ env: { LC_ALL: 'POSIX', LANG: 'C.UTF-8' }, osLanguage: os('ja') }), 'ja');
    assert.equal(detectCliLanguage({ env: { LANG: '' }, osLanguage: os('ja') }), 'ja');
  });

  test('Windows: no POSIX variables, so the OS (Regional format) locale decides', () => {
    assert.equal(detectCliLanguage({ env: {}, osLanguage: os('ja') }), 'ja');
    assert.equal(detectCliLanguage({ env: {}, osLanguage: os('en') }), 'en');
    assert.equal(detectCliLanguage({ env: {}, osLanguage: os(undefined) }), 'en');
  });

  test('an unsupported terminal language falls back to English, not the OS', () => {
    assert.equal(detectCliLanguage({ env: { LANG: 'fr_FR.UTF-8' }, osLanguage: os('ja') }), 'en');
    assert.equal(detectCliLanguage({ env: { OOBEE_LANG: 'xx' }, osLanguage: os('ja') }), 'en');
  });

  test('the report language is not auto-detected from the terminal', () => {
    // dist/i18n/index.js reads OOBEE_LANG only; LANG must not change it.
    assert.equal(process.env.OOBEE_LANG, undefined);
    assert.equal(getLanguage(), 'en');
  });
});

describe('langFromArgv', () => {
  test('finds -n / --lang in all supported forms', () => {
    assert.equal(langFromArgv(['-c', 'website', '-n', 'ja']), 'ja');
    assert.equal(langFromArgv(['--lang', 'ja', '--help']), 'ja');
    assert.equal(langFromArgv(['--lang=ja']), 'ja');
    assert.equal(langFromArgv(['-n=en']), 'en');
  });

  test('ignores values after -- and returns undefined when absent', () => {
    assert.equal(langFromArgv(['--', '--lang', 'ja']), undefined);
    assert.equal(langFromArgv(['-c', 'website']), undefined);
    assert.equal(langFromArgv(['-n']), undefined);
  });
});
