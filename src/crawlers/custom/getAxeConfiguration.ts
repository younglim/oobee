import { ImpactValue } from "axe-core";
import { evaluateAltText } from "./evaluateAltText.js";

export function getAxeConfiguration({
  enableWcagAaa = false,
  gradingReadabilityFlag = '',
  disableOobee = false,
  locale = undefined,
  oobeeTexts = undefined,
}: {
  enableWcagAaa?: boolean;
  gradingReadabilityFlag?: string;
  disableOobee?: boolean;
  // axe-core locale object (e.g. axe-core/locales/ja.json); omitted for English
  locale?: Record<string, any>;
  // Translations for Oobee custom rules/checks (see src/i18n/locales/<lang>/axeOobee.json)
  oobeeTexts?: {
    rules?: Record<string, { description?: string; help?: string }>;
    checks?: Record<string, { pass?: string; fail?: string }>;
    runtime?: Record<string, string>;
  };
}) {
  // This function is serialised with .toString() and eval'd in the browser,
  // so it must stay self-contained (no imports/closures over module scope).
  const ruleText = (id: string, key: 'description' | 'help', fallback: string): string =>
    oobeeTexts?.rules?.[id]?.[key] || fallback;
  const checkText = (id: string, key: 'pass' | 'fail', fallback: string): string =>
    oobeeTexts?.checks?.[id]?.[key] || fallback;
  const runtimeText = (key: string, fallback: string): string =>
    oobeeTexts?.runtime?.[key] || fallback;

  function getReadabilityInterpretation(score: string): string {
    const num = parseFloat(score);
    if (Number.isNaN(num)) return '';
    if (num > 30) {
      return runtimeText(
        'readabilityJC',
        'It is targeted for junior college (JC) level comprehension and above.',
      );
    }
    return runtimeText(
      'readabilityUniversity',
      'It is targeted for university graduate level comprehension and above.',
    );
  }
  function getReadabilityFailMessage(score: string): string {
    return runtimeText(
      'readabilityGradingFail',
      'Text content is potentially difficult to read.\n  It scored {{score}} out of 50 on the Flesch-Kincaid Readability Test.\n  {{interpretation}}',
    )
      .replace('{{score}}', score)
      .replace('{{interpretation}}', getReadabilityInterpretation(score));
  }
  return {
    ...(locale ? { locale } : {}),
    branding: {
      application: 'oobee',
    },
    checks: [
      {
        id: 'oobee-confusing-alt-text',
        metadata: {
          impact: 'serious' as ImpactValue,
          messages: {
            pass: checkText('oobee-confusing-alt-text', 'pass', 'The image alt text is probably useful.'),
            fail: checkText(
              'oobee-confusing-alt-text',
              'fail',
              "The image alt text set as 'img', 'image', 'picture', 'photo', or 'graphic' is confusing or not useful.",
            ),
          },
        },
        evaluate: evaluateAltText,
      },
      {
        id: 'oobee-accessible-label',
        metadata: {
          impact: 'serious' as ImpactValue,
          messages: {
            pass: checkText('oobee-accessible-label', 'pass', 'The clickable element has an accessible label.'),
            fail: checkText(
              'oobee-accessible-label',
              'fail',
              'The clickable element does not have an accessible label.',
            ),
          },
        },
        evaluate: (node: HTMLElement) => {
          return !node.dataset.flagged; // fail any element with a data-flagged attribute set to true
        },
      },
      ...((enableWcagAaa && gradingReadabilityFlag !== '')
        ? [
          {
            id: 'oobee-grading-text-contents',
            metadata: {
              impact: 'moderate' as ImpactValue,
              messages: {
                pass: checkText('oobee-grading-text-contents', 'pass', 'The text content is easy to understand.'),
                fail: getReadabilityFailMessage(gradingReadabilityFlag),
                incomplete: getReadabilityFailMessage(gradingReadabilityFlag),
              },
            },
            evaluate: (_node: HTMLElement) => false,
          },
        ]
        : []),
    ],
    rules: [
      { id: 'target-size', enabled: true },
      {
        id: 'oobee-confusing-alt-text',
        selector: 'img[alt]',
        enabled: true,
        any: ['oobee-confusing-alt-text'],
        tags: ['wcag2a', 'wcag111'],
        metadata: {
          description: ruleText(
            'oobee-confusing-alt-text',
            'description',
            'Ensures image alt text is clear and useful.',
          ),
          help: ruleText(
            'oobee-confusing-alt-text',
            'help',
            'Image alt text must not be vague or unhelpful.',
          ),
          helpUrl: 'https://www.deque.com/blog/great-alt-text-introduction/',
        },
      },
      {
        id: 'oobee-accessible-label',
        // selector: '*', // to be set with the checker function output xpaths converted to css selectors
        enabled: true,
        any: ['oobee-accessible-label'],
        tags: ['wcag2a', 'wcag211', 'wcag412'],
        metadata: {
          description: ruleText(
            'oobee-accessible-label',
            'description',
            'Ensures clickable elements have an accessible label.',
          ),
          help: ruleText(
            'oobee-accessible-label',
            'help',
            'Clickable elements must have accessible labels.',
          ),
          helpUrl: 'https://www.deque.com/blog/accessible-aria-buttons',
        },
      },
      ...((enableWcagAaa && gradingReadabilityFlag !== '')
        ? [{
            id: 'oobee-grading-text-contents',
            selector: 'html',
            enabled: true,
            any: ['oobee-grading-text-contents'],
            tags: ['wcag2aaa', 'wcag315'],
            metadata: {
              description: ruleText(
                'oobee-grading-text-contents',
                'description',
                'Text content should be easy to understand for individuals with education levels up to university graduates. If the text content is difficult to understand, provide supplemental content or a version that is easy to understand.',
              ),
              help: ruleText(
                'oobee-grading-text-contents',
                'help',
                'Text content should be clear and plain to ensure that it is easily understood.',
              ),
              helpUrl: 'https://www.wcag.com/uncategorized/3-1-5-reading-level/',
            },
          }]
        : []),
    ]
      .filter(rule => (disableOobee ? !rule.id.startsWith('oobee') : true))
      .concat(
        enableWcagAaa
          ? [
            {
              id: 'color-contrast-enhanced',
              enabled: true,
            },
            {
              id: 'identical-links-same-purpose',
              enabled: true,
            },
            {
              id: 'meta-refresh-no-exceptions',
              enabled: true,
            },
          ]
          : [],
      ),
  };
}

