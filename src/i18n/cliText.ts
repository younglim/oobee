// CLI language state + translator for CLI text. Dependency-free apart from
// the i18n bundle loader, so both constants/cliFunctions.ts (option coerce
// messages) and i18n/cli.ts (help builder) can import it without a cycle.
import { DEFAULT_LANGUAGE, getBundle, normalizeLanguage } from './index.js';
import { detectCliLanguage, langFromArgv } from './detectLocale.js';

let cliLanguage = DEFAULT_LANGUAGE;

const interpolate = (text: string, vars?: Record<string, string | number>): string =>
  vars ? text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text;

/** Decide and remember the CLI language for this process. */
export const initCliLanguage = (argv: string[], env: NodeJS.ProcessEnv = process.env): string => {
  cliLanguage = detectCliLanguage({ explicit: langFromArgv(argv), env });
  return cliLanguage;
};

export const setCliLanguage = (lang?: string): string => {
  cliLanguage = normalizeLanguage(lang);
  return cliLanguage;
};

export const getCliLanguage = (): string => cliLanguage;

/** Translate a CLI key (e.g. "messages.invalidDevice") in the CLI language. */
export const tc = (key: string, vars?: Record<string, string | number>, lang = cliLanguage): string => {
  const value = key.split('.').reduce<any>((acc, part) => acc?.[part], getBundle(lang).cli);
  return typeof value === 'string' ? interpolate(value, vars) : key;
};
