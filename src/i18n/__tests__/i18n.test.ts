import fs from 'fs';
import path from 'path';
import {
  a11yRuleShortDescriptionMap,
  a11yRuleLongDescriptionMap,
  a11yRuleStepByStepGuide,
  WCAGclauses,
} from '../../constants/constants.js';
import itemTypeDescription from '../../constants/itemTypeDescription.js';
import {
  getAxeLocale,
  getBundle,
  getItemTypeDescription,
  getOobeeAxeTexts,
  getRuleTexts,
  getWcagClauses,
  isSupportedLanguage,
  normalizeLanguage,
  t,
} from '../index.js';

const localesDir = path.join(process.cwd(), 'src/i18n/locales');
const readLocale = (lang: string, name: string) =>
  JSON.parse(fs.readFileSync(path.join(localesDir, lang, `${name}.json`), 'utf8'));

const flattenKeys = (o: Record<string, any>, prefix = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flattenKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

const placeholders = (s: string) => (s.match(/\{\{\w+\}\}/g) || []).sort().join(',');

describe('i18n', () => {
  test('normalizes and validates language codes', () => {
    expect(normalizeLanguage('JA')).toBe('ja');
    expect(normalizeLanguage('ja-JP')).toBe('ja');
    expect(normalizeLanguage('xx')).toBe('en');
    expect(normalizeLanguage(undefined)).toBe('en');
    expect(isSupportedLanguage('ja')).toBe(true);
    expect(isSupportedLanguage('xx')).toBe(false);
  });

  test('English keeps the original constants unchanged', () => {
    const en = getRuleTexts('en');
    expect(en.shortDescriptionMap).toEqual(a11yRuleShortDescriptionMap);
    expect(en.longDescriptionMap).toEqual(a11yRuleLongDescriptionMap);
    expect(en.stepByStepGuide).toEqual(a11yRuleStepByStepGuide);
    expect(getItemTypeDescription('en')).toEqual(itemTypeDescription);
    expect(getWcagClauses('en')).toEqual(WCAGclauses);
    expect(getAxeLocale('en')).toBeUndefined();
  });

  test('ja translates every rule text', () => {
    const ja = getRuleTexts('ja');
    Object.keys(a11yRuleShortDescriptionMap).forEach(id => {
      expect(ja.shortDescriptionMap[id]).not.toBe(a11yRuleShortDescriptionMap[id]);
      expect(ja.longDescriptionMap[id]).not.toBe(a11yRuleLongDescriptionMap[id]);
      (['check', 'fix', 'review', 'learn'] as const).forEach(f => {
        expect(ja.stepByStepGuide[id][f]).toBeTruthy();
        expect(ja.stepByStepGuide[id][f]).not.toBe(a11yRuleStepByStepGuide[id][f]);
      });
    });
    Object.keys(WCAGclauses).forEach(k => expect(getWcagClauses('ja')[k]).not.toBe(WCAGclauses[k]));
  });

  test('ja ui and axeOobee bundles match English keys and placeholders', () => {
    ['ui', 'axeOobee'].forEach(name => {
      const en = readLocale('en', name);
      const ja = readLocale('ja', name);
      const enKeys = flattenKeys(en);
      const jaBundle = getBundle('ja')[name];
      enKeys.forEach(key => {
        const enValue = key.split('.').reduce((a, p) => a?.[p], en);
        const jaValue = key.split('.').reduce((a, p) => a?.[p], ja);
        expect({ key, defined: jaValue !== undefined }).toEqual({ key, defined: true });
        expect({ key, ph: placeholders(String(jaValue)) }).toEqual({ key, ph: placeholders(String(enValue)) });
      });
      expect(jaBundle).toBeDefined();
    });
  });

  test('ja axe locale comes from axe-core and Oobee custom rules are translated', () => {
    const axeLocale = getAxeLocale('ja');
    expect(axeLocale?.lang).toBe('ja');
    const texts = getOobeeAxeTexts('ja');
    ['oobee-confusing-alt-text', 'oobee-accessible-label', 'oobee-grading-text-contents'].forEach(id => {
      expect(texts.rules?.[id]?.help).toBeTruthy();
      expect(texts.checks?.[id]?.pass).toBeTruthy();
    });
  });

  test('t() interpolates and falls back to the key', () => {
    expect(t('ui.header.title', undefined, 'en')).toBe('Accessibility Report');
    expect(t('ui.does.not.exist', undefined, 'ja')).toBe('ui.does.not.exist');
  });
});
