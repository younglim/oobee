// Localised CLI help (yargs option descriptions, usage, examples, built-in
// yargs strings). Kept out of cli.ts so the option table can be built for any
// language without parsing argv. Language state and tc() live in cliText.ts.
import type { Options } from 'yargs';
import { cliOptions } from '../constants/cliFunctions.js';
import { getCliLanguage, tc } from './cliText.js';

export { initCliLanguage, setCliLanguage, getCliLanguage, tc } from './cliText.js';

/** cliOptions with `describe` swapped for the requested language. */
export const getLocalizedCliOptions = (lang = getCliLanguage()): { [key: string]: Options } =>
  Object.fromEntries(
    Object.entries(cliOptions).map(([key, option]) => {
      const describe = tc(`options.${key}`, undefined, lang);
      return [key, { ...option, describe: describe === `options.${key}` ? option.describe : describe }];
    }),
  );

export const getCliUsage = (version: string, lang = getCliLanguage()): string =>
  tc('usage', { version }, lang);

/**
 * Examples block, rendered via yargs.epilogue() so each command stays on its
 * own unwrapped line (yargs' example() column layout breaks long commands
 * mid-token, which makes them impossible to copy).
 */
export const getCliExamplesEpilogue = (lang = getCliLanguage()): string => {
  // yargs wraps the epilogue at 80 columns by characters; keep each line short
  // (break before the optional device/viewport part) so tokens never split.
  const examples: [string, string][] = [
    ['sitemap', 'npm run cli -- -c [ 1 | sitemap ] -u <url_link>'],
    ['website', 'npm run cli -- -c [ 2 | website ] -u <url_link>'],
    ['custom', 'npm run cli -- -c [ 3 | custom ] -u <url_link>'],
  ];
  const optional = '[ -d <device> | -w <viewport_width> ]';
  const lines = examples.map(
    ([key, cmd]) => `  ${tc(`examples.${key}`, undefined, lang)}:\n    ${cmd} \\\n      ${optional}`,
  );
  return `${tc('examples.title', undefined, lang)}\n${lines.join('\n')}`;
};

/**
 * yargs locale for its built-in strings ("Options:", "Show help", "Missing
 * required argument", …). yargs ships ja.json. Passed explicitly with
 * detectLocale(false) so Windows (where LANG is normally unset) behaves the
 * same as macOS/Linux.
 */
export const getYargsLocale = (lang = getCliLanguage()): string => (lang === 'ja' ? 'ja' : 'en');
