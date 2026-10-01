import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import {
  a11yRuleShortDescriptionMap,
  a11yRuleLongDescriptionMap,
  a11yRuleStepByStepGuide,
  WCAGclauses,
} from '../constants/constants.js';
import itemTypeDescription from '../constants/itemTypeDescription.js';

const require = createRequire(import.meta.url);
const dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(dirname, 'locales');

export const DEFAULT_LANGUAGE = 'en';
export const SUPPORTED_LANGUAGES = ['en', 'ja'];

type Bundle = Record<string, any>;

const bundleCache: Record<string, Bundle> = {};
let currentLanguage = DEFAULT_LANGUAGE;

export const normalizeLanguage = (lang?: string): string => {
  if (!lang) return DEFAULT_LANGUAGE;
  const base = lang.trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGUAGES.includes(base) ? base : DEFAULT_LANGUAGE;
};

currentLanguage = normalizeLanguage(process.env.OOBEE_LANG);

export const isSupportedLanguage = (lang?: string): boolean =>
  !!lang && SUPPORTED_LANGUAGES.includes(lang.trim().toLowerCase().split(/[-_]/)[0]);

const loadBundle = (lang: string): Bundle => {
  if (bundleCache[lang]) return bundleCache[lang];
  const dir = path.join(localesDir, lang);
  const bundle: Bundle = {};
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .forEach(f => {
        bundle[path.basename(f, '.json')] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      });
  }
  bundleCache[lang] = bundle;
  return bundle;
};

const deepMerge = (base: any, override: any): any => {
  if (override === undefined || override === null) return base;
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return override;
  const out = { ...base };
  Object.keys(override).forEach(k => {
    out[k] = deepMerge(base[k], override[k]);
  });
  return out;
};

/** Bundle for `lang`, with any missing entries filled in from English. */
export const getBundle = (lang?: string): Bundle => {
  const normalized = normalizeLanguage(lang);
  const en = loadBundle(DEFAULT_LANGUAGE);
  return normalized === DEFAULT_LANGUAGE ? en : deepMerge(en, loadBundle(normalized));
};

export const setLanguage = (lang?: string): string => {
  currentLanguage = normalizeLanguage(lang);
  process.env.OOBEE_LANG = currentLanguage;
  return currentLanguage;
};

export const getLanguage = (): string => currentLanguage;

const interpolate = (text: string, vars?: Record<string, string | number>): string =>
  vars ? text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text;

/** Look up a dotted key such as "ui.header.title" ({{name}} placeholders supported). */
export const t = (key: string, vars?: Record<string, string | number>, lang?: string): string => {
  const value = key.split('.').reduce<any>((acc, part) => acc?.[part], getBundle(lang ?? currentLanguage));
  return typeof value === 'string' ? interpolate(value, vars) : key;
};

/**
 * Rule texts (short/long description, step-by-step guide) for `lang`.
 * English is the original source in constants.ts; other languages overlay it
 * from locales/<lang>/rules.json, so untranslated rules fall back to English.
 */
export const getRuleTexts = (lang?: string) => {
  const normalized = normalizeLanguage(lang ?? currentLanguage);
  const overlay = normalized === DEFAULT_LANGUAGE ? {} : (loadBundle(normalized).rules ?? {});
  return {
    shortDescriptionMap: { ...a11yRuleShortDescriptionMap, ...(overlay.shortDescription ?? {}) },
    longDescriptionMap: { ...a11yRuleLongDescriptionMap, ...(overlay.longDescription ?? {}) },
    stepByStepGuide: { ...a11yRuleStepByStepGuide, ...(overlay.stepByStepGuide ?? {}) },
  };
};

/** Friendly WCAG criterion names (e.g. '1.4.3' → 'Ensure text is easy to read') for `lang`. */
export const getWcagClauses = (lang?: string): Record<string, string> => {
  const normalized = normalizeLanguage(lang ?? currentLanguage);
  const overlay =
    normalized === DEFAULT_LANGUAGE ? {} : (loadBundle(normalized).common?.wcagClauses ?? {});
  return { ...WCAGclauses, ...overlay };
};

/** Category descriptions (mustFix/goodToFix/needsReview/passed) for `lang`. */
export const getItemTypeDescription = (lang?: string): typeof itemTypeDescription => {
  const normalized = normalizeLanguage(lang ?? currentLanguage);
  const overlay =
    normalized === DEFAULT_LANGUAGE ? {} : (loadBundle(normalized).common?.itemTypeDescription ?? {});
  return { ...itemTypeDescription, ...overlay };
};

/**
 * axe-core's shipped locale for `axe.configure({ locale })`.
 * Returns undefined for English (axe default) or when axe-core has no translation.
 * Oobee custom rules are NOT included here: axe throws on locale entries for
 * unregistered rules/checks, so those are applied via getOobeeAxeTexts instead.
 */
export const getAxeLocale = (lang?: string): Record<string, any> | undefined => {
  const normalized = normalizeLanguage(lang ?? currentLanguage);
  if (normalized === DEFAULT_LANGUAGE) return undefined;
  try {
    return require(`axe-core/locales/${normalized}.json`);
  } catch {
    return undefined;
  }
};

export type OobeeAxeTexts = {
  rules?: Record<string, { description?: string; help?: string }>;
  checks?: Record<string, { pass?: string; fail?: string }>;
  runtime: Record<string, string>;
};

/** Translations for Oobee custom axe rules/checks and runtime-built failure messages. */
export const getOobeeAxeTexts = (lang?: string): OobeeAxeTexts => {
  const bundle = getBundle(lang ?? currentLanguage).axeOobee ?? {};
  return { rules: bundle.rules ?? {}, checks: bundle.checks ?? {}, runtime: bundle.runtime ?? {} };
};

/** Same as t() but against an OobeeAxeTexts.runtime map (usable without fs, e.g. in tests). */
export const formatRuntime = (
  texts: OobeeAxeTexts,
  key: string,
  vars?: Record<string, string | number>,
): string => interpolate(texts.runtime[key] ?? key, vars);
