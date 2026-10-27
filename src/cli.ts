#!/usr/bin/env node
import { createRequire } from 'module';
import type _yargsType from 'yargs';
import { hideBin } from 'yargs/helpers';
import printMessage from 'print-message';
import { devices } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import {
  setHeadlessMode,
  getVersion,
  getStoragePath,
  listenForCleanUp,
  cleanUpAndExit,
} from './utils.js';
import {
  checkUrl,
  prepareData,
  getFileSitemap,
  validEmail,
  validName,
  getScreenToScan,
  validateDirPath,
  validateFilePath,
  validateCustomFlowLabel,
  isRefusedRedirectTarget,
} from './constants/common.js';
import constants, { ScannerTypes } from './constants/constants.js';
import { cliOptions, messageOptions } from './constants/cliFunctions.js';
import combineRun from './combine.js';
import { Answers } from './index.js';
import { consoleLogger } from './logs.js';
import { getLanguage, setLanguage } from './i18n/index.js';
import {
  initCliLanguage,
  tc,
  getLocalizedCliOptions,
  getCliUsage,
  getCliExamplesEpilogue,
  getYargsLocale,
} from './i18n/cli.js';

const appVersion = getVersion();
const rawArgv = hideBin(process.argv);
// CLI text (help, validation messages) follows --lang / OOBEE_LANG, else the
// terminal/OS language. Decided before yargs builds the help text.
initCliLanguage(rawArgv);
// Use yargs' CommonJS build: its platform shim measures text with
// string-width, so Japanese (double-width) help wraps to the terminal width
// and English lines wrap at word boundaries. The ESM shim counts code points,
// which overflows Japanese lines and splits English words mid-token.
const _yargs = createRequire(import.meta.url)('yargs') as typeof _yargsType;
const yargs = _yargs(rawArgv);

const options = yargs
  .version(false)
  .locale(getYargsLocale())
  .detectLocale(false)
  .usage(getCliUsage(appVersion))
  .strictOptions(true)
  .options(getLocalizedCliOptions())
  .epilogue(getCliExamplesEpilogue())
  .coerce('d', option => {
    const device = devices[option];
    if (!device && option !== 'Desktop' && option !== 'Mobile') {
      printMessage([tc('messages.invalidDevice')], messageOptions);
      cleanUpAndExit(1);
    }
    return option;
  })
  .coerce('w', option => {
    if (!option || Number.isNaN(option)) {
      printMessage([tc('messages.invalidViewportNumber')], messageOptions);
      cleanUpAndExit(1);
    } else if (option < 320 || option > 1080) {
      printMessage([tc('messages.invalidViewportRange')], messageOptions);
      cleanUpAndExit(1);
    }
    return option;
  })
  .coerce('p', option => {
    if (!Number.isInteger(option) || Number(option) <= 0) {
      printMessage([tc('messages.invalidMaxPages')], messageOptions);
      cleanUpAndExit(1);
    }
    return option;
  })
  .coerce('t', option => {
    if (!Number.isInteger(option) || Number(option) <= 0) {
      printMessage([tc('messages.invalidConcurrency')], messageOptions);
      cleanUpAndExit(1);
    }
    return option;
  })
  .coerce('k', nameEmail => {
    if (nameEmail.indexOf(':') === -1) {
      printMessage([tc('messages.nameEmailFormat')], messageOptions);
      cleanUpAndExit(1);
    }
    const [name, email] = nameEmail.split(':');
    if (name === '' || name === undefined || name === null) {
      printMessage([tc('messages.nameRequired')], messageOptions);
      cleanUpAndExit(1);
    }
    if (!validName(name)) {
      printMessage([tc('messages.invalidName')], messageOptions);
      cleanUpAndExit(1);
    }
    if (!validEmail(email)) {
      printMessage([tc('messages.invalidEmail')], messageOptions);
      cleanUpAndExit(1);
    }
    return nameEmail;
  })
  .coerce('e', option => {
    const validationErrors = validateDirPath(option);
    if (validationErrors) {
      printMessage([tc('messages.invalidExportDir', { errors: validationErrors })], messageOptions);
      cleanUpAndExit(1);
    }
    return option;
  })
  .coerce('x', option => {
    const filename = fileURLToPath(import.meta.url);
    const dirname = `${path.dirname(filename)}/../`; // check in the parent of dist directory

    try {
      return validateFilePath(option, dirname);
    } catch (err) {
      printMessage([tc('messages.invalidBlacklist', { error: String(err) })], messageOptions);
      cleanUpAndExit(1);
    }
  })
  .coerce('i', option => {
    const { choices } = cliOptions.i;
    if (!choices.includes(option)) {
      printMessage([tc('messages.invalidFileTypes', { choices: choices.join(', ') })], messageOptions);
      cleanUpAndExit(1);
    }
    return option;
  })
  .coerce('j', option => {
    const { isValid, errorMessage } = validateCustomFlowLabel(option);
    if (!isValid) {
      printMessage([errorMessage], messageOptions);
      cleanUpAndExit(1);
    }
    return option;
  })
  .coerce('a', option => {
    const { choices } = cliOptions.a;
    if (!choices.includes(option)) {
      printMessage([tc('messages.invalidAdditional', { choices: choices.join(', ') })], messageOptions);
      cleanUpAndExit(1);
    }
    return option;
  })
  .coerce('q', option => {
    try {
      JSON.parse(option);
    } catch {
      // default to empty object
      return '{}';
    }
    return option;
  })
  .coerce('m', option => {
    return option;
  })
  .check(argvs => {
    if (argvs.scanner === ScannerTypes.CUSTOM && argvs.maxpages) {
      throw new Error(tc('messages.maxPagesNotCustom'));
    }
    return true;
  })
  .check(argvs => {
    const scanner = String(argvs.scanner ?? '');

    if (argvs.strategy && scanner !== ScannerTypes.WEBSITE && scanner !== ScannerTypes.CUSTOM && scanner !== ScannerTypes.INTELLIGENT && scanner !== ScannerTypes.SITEMAP && scanner !== ScannerTypes.LOCALFILE) {
      throw new Error(tc('messages.strategyScanTypes'));
    }
    if (argvs.strategy === 'ignore' && scanner !== ScannerTypes.SITEMAP) {
      throw new Error(tc('messages.strategyIgnoreSitemapOnly'));
    }
    return true;
  })
  .coerce('l', option => {
    const duration = Number(option);
    if (isNaN(duration) || duration < 0) {
      printMessage([tc('messages.invalidScanDuration')], messageOptions);
      cleanUpAndExit(1);
    }
    return duration;
  })
  .check(argvs => {
    if (argvs.scanner !== ScannerTypes.WEBSITE && argvs.scanner !== ScannerTypes.CUSTOM && argvs.scanner !== ScannerTypes.INTELLIGENT && argvs.scanner !== ScannerTypes.SITEMAP && argvs.scanner !== ScannerTypes.LOCALFILE && argvs.strategy) {
      throw new Error(tc('messages.strategyScanTypes'));
    }
    if (argvs.strategy === 'ignore' && argvs.scanner !== ScannerTypes.SITEMAP) {
      throw new Error(tc('messages.strategyIgnoreSitemapOnly'));
    }
    return true;
  })
  .conflicts('d', 'w')
  .parse() as unknown as Answers;

setLanguage((options as any).lang ?? process.env.OOBEE_LANG);

if (options.websiteTag) {
  process.env.OOBEE_TAGGED_WEBSITE = options.websiteTag;
}

const scanInit = async (argvs: Answers): Promise<string> => {
  const updatedArgvs = { ...argvs };

  // Cannot use data.browser and data.isHeadless as the connectivity check comes first before prepareData
  setHeadlessMode(updatedArgvs.browserToRun, updatedArgvs.headless);
  const statuses = constants.urlCheckStatuses;

  let data;
  try {
    data = await prepareData(updatedArgvs);
  } catch (e) {
    consoleLogger.error(`Error preparing data: ${e.message}\n${e.stack}`);
    cleanUpAndExit(1);
  }

  // Executes cleanUp script if error encountered
  listenForCleanUp(data.randomToken);

  const res = await checkUrl(
    data.type,
    data.entryUrl,
    data.browser,
    data.userDataDirectory,
    data.playwrightDeviceDetailsObject,
    data.extraHTTPHeaders,
    data.fileTypes,
  );

  if (res.httpStatus)
    consoleLogger.info(`Connectivity Check HTTP Response Code: ${res.httpStatus}`);

  if (res.status === statuses.success.code) {
    // Keep browser-resolved URL as entryUrl for downstream scan metadata/events
    // on non-custom scans.
    if (data.type !== ScannerTypes.CUSTOM) {
      // asgard-0001: defence in depth — never adopt a redirect-resolved seed
      // that pivots a public entry URL onto an internal/metadata address.
      if (res.url !== data.entryUrl && (await isRefusedRedirectTarget(data.entryUrl, res.url))) {
        const msg = 'Refusing to scan: entry URL redirected to an internal/metadata address.';
        printMessage([msg], messageOptions);
        consoleLogger.info(msg);
        cleanUpAndExit(statuses.systemError.code);
        return;
      }
      data.entryUrl = res.url;
      data.url = res.url;
    }
    if (process.env.OOBEE_VALIDATE_URL) {
      consoleLogger.info('Url is valid');
      cleanUpAndExit(0, data.randomToken);
      return;
    }
    // fall through (continue normal flow after success)
  } else {
    const match = Object.values(statuses).find((s: any) => s.code === res.status);
    let msg = match && 'message' in match ? match.message : 'Unknown error';
    if (res.status === statuses.errorStatusReceived.code && res.httpStatus) {
      msg = `${msg}${res.httpStatus}.`;
    }
    printMessage([msg], messageOptions);
    consoleLogger.info(msg);
    cleanUpAndExit(res.status);
    return;
  }

  if (process.env.OOBEE_VERBOSE) {
    const randomTokenMessage = {
      type: 'randomToken',
      payload: `${data.randomToken}`,
    };
    if (process.send) {
      process.send(JSON.stringify(randomTokenMessage));
    }
  }

  const screenToScan = getScreenToScan(data.deviceChosen, data.customDevice, data.viewportWidth);

  printMessage([`Oobee version: ${appVersion}`, 'Starting scan...'], messageOptions);
  consoleLogger.info(`Oobee version: ${appVersion}`);

  await combineRun(data, screenToScan);

  return getStoragePath(data.randomToken);
};

const optionsAnswer: Answers = {
  scanner: options.scanner,
  header: options.header,
  browserToRun: options.browserToRun,
  zip: options.zip,
  url: options.url,
  finalUrl: options.finalUrl,
  headless: options.headless,
  maxpages: options.maxpages,
  metadata: options.metadata,
  safeMode: options.safeMode,
  strategy: options.strategy,
  fileTypes: options.fileTypes,
  nameEmail: options.nameEmail,
  additional: options.additional,
  customDevice: options.customDevice,
  deviceChosen: options.deviceChosen,
  followRobots: options.followRobots,
  customFlowLabel: options.customFlowLabel,
  viewportWidth: options.viewportWidth,
  isLocalFileScan: options.isLocalFileScan,
  exportDirectory: options.exportDirectory,
  clonedBrowserDataDir: options.clonedBrowserDataDir,
  specifiedMaxConcurrency: options.specifiedMaxConcurrency,
  blacklistedPatternsFilename: options.blacklistedPatternsFilename,
  playwrightDeviceDetailsObject: options.playwrightDeviceDetailsObject,
  ruleset: options.ruleset,
  generateJsonFiles: options.generateJsonFiles,
  scanDuration: options.scanDuration,
  lang: getLanguage(),
};

await scanInit(optionsAnswer);
cleanUpAndExit(0);

export default options;
