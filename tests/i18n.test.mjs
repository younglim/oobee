// i18n bundles, rule/WCAG translations and axe locale. Ported from the
// branch's jest suite (src/i18n/__tests__/i18n.test.ts) to node:test after
// master removed jest (#885). Runs against dist/ like the other unit suites:
//   npm run build && node --use-system-ca --test tests/i18n.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.OOBEE_DISABLE_TELEMETRY = '1';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = p => pathToFileURL(path.join(root, 'dist', p)).href;

const constants = await import(dist('constants/constants.js'));
const { default: itemTypeDescription } = await import(dist('constants/itemTypeDescription.js'));
const {
  getAxeLocale,
  getBundle,
  getItemTypeDescription,
  getOobeeAxeTexts,
  getRuleTexts,
  getWcagClauses,
  isSupportedLanguage,
  normalizeLanguage,
  t,
} = await import(dist('i18n/index.js'));

const {
  a11yRuleShortDescriptionMap,
  a11yRuleLongDescriptionMap,
  a11yRuleStepByStepGuide,
  WCAGclauses,
} = constants;

const localesDir = path.join(root, 'src/i18n/locales');
const readLocale = (lang, name) =>
  JSON.parse(fs.readFileSync(path.join(localesDir, lang, `${name}.json`), 'utf8'));

const flattenKeys = (o, prefix = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flattenKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

const placeholders = s => (s.match(/\{\{\w+\}\}/g) || []).sort().join(',');
const at = (obj, key) => key.split('.').reduce((a, p) => a?.[p], obj);

describe('i18n', () => {
  test('normalizes and validates language codes', () => {
    assert.equal(normalizeLanguage('JA'), 'ja');
    assert.equal(normalizeLanguage('ja-JP'), 'ja');
    assert.equal(normalizeLanguage('xx'), 'en');
    assert.equal(normalizeLanguage(undefined), 'en');
    assert.equal(isSupportedLanguage('ja'), true);
    assert.equal(isSupportedLanguage('xx'), false);
  });

  test('English keeps the original constants unchanged', () => {
    const en = getRuleTexts('en');
    assert.deepEqual(en.shortDescriptionMap, a11yRuleShortDescriptionMap);
    assert.deepEqual(en.longDescriptionMap, a11yRuleLongDescriptionMap);
    assert.deepEqual(en.stepByStepGuide, a11yRuleStepByStepGuide);
    assert.deepEqual(getItemTypeDescription('en'), itemTypeDescription);
    assert.deepEqual(getWcagClauses('en'), WCAGclauses);
    assert.equal(getAxeLocale('en'), undefined);
  });

  test('ja translates every rule text', () => {
    const ja = getRuleTexts('ja');
    for (const id of Object.keys(a11yRuleShortDescriptionMap)) {
      assert.notEqual(ja.shortDescriptionMap[id], a11yRuleShortDescriptionMap[id], `short: ${id}`);
      assert.notEqual(ja.longDescriptionMap[id], a11yRuleLongDescriptionMap[id], `long: ${id}`);
      for (const f of ['check', 'fix', 'review', 'learn']) {
        assert.ok(ja.stepByStepGuide[id]?.[f], `guide missing: ${id}.${f}`);
        assert.notEqual(ja.stepByStepGuide[id][f], a11yRuleStepByStepGuide[id][f], `guide: ${id}.${f}`);
      }
    }
    const jaClauses = getWcagClauses('ja');
    for (const k of Object.keys(WCAGclauses)) {
      assert.notEqual(jaClauses[k], WCAGclauses[k], `wcag: ${k}`);
    }
  });

  test('ja ui and axeOobee bundles match English keys and placeholders', () => {
    for (const name of ['ui', 'axeOobee']) {
      const en = readLocale('en', name);
      const ja = readLocale('ja', name);
      for (const key of flattenKeys(en)) {
        const jaValue = at(ja, key);
        assert.notEqual(jaValue, undefined, `${name}: missing ${key}`);
        assert.equal(placeholders(String(jaValue)), placeholders(String(at(en, key))), `${name}: placeholders ${key}`);
      }
      assert.ok(getBundle('ja')[name], `bundle ${name}`);
    }
  });

  test('ja axe locale comes from axe-core and Oobee custom rules are translated', () => {
    assert.equal(getAxeLocale('ja')?.lang, 'ja');
    const texts = getOobeeAxeTexts('ja');
    for (const id of ['oobee-confusing-alt-text', 'oobee-accessible-label', 'oobee-grading-text-contents']) {
      assert.ok(texts.rules?.[id]?.help, `rule help: ${id}`);
      assert.ok(texts.checks?.[id]?.pass, `check pass: ${id}`);
    }
  });

  test('t() interpolates and falls back to the key', () => {
    assert.equal(t('ui.header.title', undefined, 'en'), 'Accessibility Report');
    assert.equal(t('ui.does.not.exist', undefined, 'ja'), 'ui.does.not.exist');
  });
});
