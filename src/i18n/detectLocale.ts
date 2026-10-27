// Detect the user's interface language for CLI output (help text, CLI
// messages). Pure functions take an explicit env so they can be unit tested.
//
// This is used only for the CLI's own text. The report/scan language is NOT
// auto-detected: it stays OOBEE_LANG / --lang / English, so existing CI
// pipelines on Japanese machines keep producing the same artifacts.
//
// Priority (first match wins):
//   1. --lang / -n                    (explicit)
//   2. OOBEE_LANG                     (explicit)
//   3. LC_ALL, LC_MESSAGES, LANG, then LANGUAGE (colon list) — POSIX shells on
//      macOS/Linux, and Git Bash / WSL / MSYS on Windows. "C" and "POSIX" are
//      treated as unset.
//   4. The OS locale via Intl (ICU):
//        Windows: the user locale = Settings → Time & language → Language &
//                 region → Regional format (GetLocaleInfoEx
//                 LOCALE_NAME_USER_DEFAULT). The Windows display language is
//                 not used.
//        macOS:   the system language/region when LANG is not set.
//        Linux:   follows the POSIX locale (same as step 3).
// Only languages Oobee ships are returned; anything else falls back to English.

const SUPPORTED = ['en', 'ja'];
const DEFAULT = 'en';

type Env = Record<string, string | undefined>;

const baseLanguage = (tag?: string): string | undefined => {
  if (typeof tag !== 'string') return undefined;
  // "ja_JP.UTF-8" / "ja-JP" / "ja_JP@euro" / "ja"
  const cleaned = tag.trim().replace(/[.@].*$/, '');
  if (!cleaned || /^(c|posix)$/i.test(cleaned)) return undefined;
  const base = cleaned.toLowerCase().split(/[-_]/)[0];
  return /^[a-z]{2,3}$/.test(base) ? base : undefined;
};

const supported = (base?: string): string | undefined =>
  base && SUPPORTED.includes(base) ? base : undefined;

/** First non-empty POSIX locale variable, honouring LANGUAGE's colon list. */
export const languageFromEnv = (env: Env): string | undefined => {
  for (const key of ['LC_ALL', 'LC_MESSAGES', 'LANG']) {
    const base = baseLanguage(env[key]);
    if (base) return base;
  }
  // LANGUAGE is a GNU priority list ("ja:en"); only consulted after LANG.
  const list = (env.LANGUAGE ?? '').split(':');
  for (const entry of list) {
    const base = baseLanguage(entry);
    if (base) return base;
  }
  return undefined;
};

export const languageFromOs = (): string | undefined => {
  try {
    return baseLanguage(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return undefined;
  }
};

/**
 * Resolve the CLI interface language.
 * Returns one of SUPPORTED, defaulting to English.
 */
export const detectCliLanguage = ({
  explicit,
  env = process.env,
  osLanguage = languageFromOs,
}: {
  explicit?: string;
  env?: Env;
  osLanguage?: () => string | undefined;
} = {}): string => {
  const explicitBase = baseLanguage(explicit) ?? baseLanguage(env.OOBEE_LANG);
  if (explicitBase) return supported(explicitBase) ?? DEFAULT;
  // A POSIX locale variable that names an unsupported language (e.g. LANG=fr_FR)
  // is still the user's choice: fall back to English rather than to the OS.
  const fromEnv = languageFromEnv(env);
  if (fromEnv) return supported(fromEnv) ?? DEFAULT;
  return supported(osLanguage()) ?? DEFAULT;
};

/**
 * Pre-scan argv for -n/--lang without running the full parser, so the help
 * text (built before parsing) can already be in the requested language.
 * Short-flag clusters (e.g. "-xn ja") are deliberately not handled: several
 * Oobee short flags take a value, so a cluster is ambiguous.
 */
export const langFromArgv = (argv: string[]): string | undefined => {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') break;
    const eq = /^(?:--lang|-n)=(.*)$/.exec(arg);
    if (eq) return eq[1];
    if ((arg === '--lang' || arg === '-n') && i + 1 < argv.length) return argv[i + 1];
  }
  return undefined;
};
