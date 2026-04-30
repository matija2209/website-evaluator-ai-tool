import { BrowserContext, Frame, Page } from 'playwright';
import type { ConsentHandlingConfig, PagePreparationResult } from './types';

const CONSENT_CONTEXT_TERMS = [
  'cookie',
  'cookies',
  'piškot',
  'piskot',
  'zasebnost',
  'privacy',
  'privatnost',
  'privatsphare',
  'datenschutz',
  'consent',
  'soglasje',
  'soglaš',
  'soglas',
  'privolitev',
  'gdpr',
  'eprivacy',
  'onetrust',
  'didomi',
  'cookiebot',
  'cookie bot',
  'trustarc',
  'quantcast'
];

const CONSENT_ACCEPT_TERMS = [
  'sprejmi vse',
  'sprejmi',
  'strinjam se',
  'soglašam',
  'soglasam',
  'dovoli vse',
  'potrdi',
  'v redu',
  'razumem',
  'accept all',
  'accept',
  'agree',
  'allow all',
  'allow',
  'ok',
  'okay',
  'alles akzeptieren',
  'akzeptieren',
  'ich stimme zu',
  'slažem se',
  'slazem se',
  'prihvaćam',
  'prihvacam',
  'dozvoli sve'
];

const CONSENT_NEGATIVE_TERMS = [
  'reject',
  'decline',
  'necessary only',
  'only necessary',
  'settings',
  'preferences',
  'manage options',
  'customize',
  'nastavitve',
  'nastavitve piškotkov',
  'zavrni',
  'samo nujne',
  'uredi nastavitve',
  'mehr optionen',
  'ablehnen'
];

const POPUP_CONTEXT_TERMS = [
  'newsletter',
  'subscribe',
  'discount',
  'promo',
  'promotion',
  'coupon',
  'kupon',
  'popust',
  'akcija',
  'obvestila',
  'notifications',
  'push',
  'app download',
  'download app',
  'adblock',
  'ad blocker',
  'special offer',
  'exclusive offer'
];

const POPUP_CLOSE_TERMS = [
  'close',
  'zapri',
  'dismiss',
  'ne hvala',
  'no thanks',
  'skip',
  'later',
  '×',
  'x',
  'schließen',
  'schliessen'
];

const RISK_TERMS = [
  'login',
  'log in',
  'sign in',
  'signin',
  'register',
  'registration',
  'prijava',
  'vpis',
  'račun',
  'racun',
  'account',
  'checkout',
  'pay',
  'payment',
  'plačilo',
  'placilo',
  'cart',
  'košar',
  'kosar',
  'order',
  'naročilo',
  'narocilo',
  'confirm order',
  'delete',
  'remove',
  'install app',
  'age',
  'age verification',
  'starost',
  'adult',
  'confirm purchase',
  'location',
  'choose store',
  'verify'
];

const CONSENT_MARKER_ATTR = 'data-codex-consent-target';
const POPUP_MARKER_ATTR = 'data-codex-popup-target';

type CandidateKind = 'consent' | 'popup';

interface TextEvaluation {
  score: number;
  matchedTerms: string[];
  riskyTerms: string[];
}

interface MarkedCandidate {
  kind: CandidateKind;
  frameUrl: string;
  marker: string;
  buttonLabel?: string;
  reason: string;
  score: number;
  riskyTerms: string[];
}

interface PreparePageOptions {
  config: ConsentHandlingConfig;
  hadStoredState: boolean;
  extensionActive: boolean;
}

export function normalizeSignalText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function includesAny(text: string, terms: string[]): string[] {
  return terms.filter(term => text.includes(normalizeSignalText(term)));
}

export function evaluateConsentCandidateText(text: string, attributesText: string = ''): TextEvaluation {
  const combined = normalizeSignalText(`${text} ${attributesText}`);
  const matchedTerms = includesAny(combined, CONSENT_CONTEXT_TERMS);
  const riskyTerms = includesAny(combined, RISK_TERMS);

  let score = 0;
  if (matchedTerms.length > 0) score += matchedTerms.length * 3;
  if (combined.includes('cookie') || combined.includes('piskot')) score += 2;
  if (combined.includes('consent') || combined.includes('soglas')) score += 2;

  return { score, matchedTerms, riskyTerms };
}

export function evaluatePopupCandidateText(text: string, attributesText: string = ''): TextEvaluation {
  const combined = normalizeSignalText(`${text} ${attributesText}`);
  const matchedTerms = includesAny(combined, POPUP_CONTEXT_TERMS);
  const riskyTerms = includesAny(combined, RISK_TERMS);

  let score = 0;
  if (matchedTerms.length > 0) score += matchedTerms.length * 3;
  if (combined.includes('newsletter') || combined.includes('subscribe')) score += 2;
  if (combined.includes('popup') || combined.includes('modal')) score += 1;

  return { score, matchedTerms, riskyTerms };
}

export function isSafeConsentAction(label: string): boolean {
  const normalized = normalizeSignalText(label);
  if (!normalized) return false;
  if (includesAny(normalized, RISK_TERMS).length > 0) return false;
  if (includesAny(normalized, CONSENT_NEGATIVE_TERMS).length > 0) return false;
  return includesAny(normalized, CONSENT_ACCEPT_TERMS).length > 0;
}

export function isSafePopupCloseAction(label: string): boolean {
  const normalized = normalizeSignalText(label);
  if (!normalized) return false;
  if (includesAny(normalized, RISK_TERMS).length > 0) return false;
  return includesAny(normalized, POPUP_CLOSE_TERMS).length > 0;
}

async function tryClickMarked(frame: Frame, attributeName: string, marker: string): Promise<boolean> {
  const locator = frame.locator(`[${attributeName}="${marker}"]`).first();
  const count = await locator.count();
  if (count === 0) {
    return false;
  }

  try {
    await locator.click({ timeout: 2000 });
    return true;
  } catch (error) {
    try {
      await locator.evaluate((element: Element) => {
        (element as HTMLElement).click();
      });
      return true;
    } catch {
      return false;
    }
  }
}

async function scanFrameForCandidate(frame: Frame, kind: CandidateKind): Promise<MarkedCandidate | null> {
  try {
    return await frame.evaluate(
      ({
        kind,
        consentContextTerms,
        consentAcceptTerms,
        consentNegativeTerms,
        popupContextTerms,
        popupCloseTerms,
        riskTerms,
        consentMarkerAttr,
        popupMarkerAttr
      }) => {
        const normalize = (value: string): string =>
          value
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();

        const includesAny = (text: string, terms: string[]): string[] =>
          terms.filter(term => text.includes(normalize(term)));

        const isVisible = (element: Element, minWidth = 24, minHeight = 24): element is HTMLElement => {
          if (!(element instanceof HTMLElement)) return false;
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.width > minWidth &&
            rect.height > minHeight;
        };

        const elementText = (element: Element): string => {
          const htmlElement = element as HTMLElement;
          return [
            htmlElement.innerText || '',
            htmlElement.getAttribute('aria-label') || '',
            htmlElement.getAttribute('title') || '',
            htmlElement.getAttribute('data-testid') || '',
            htmlElement.id || '',
            htmlElement.className || ''
          ].join(' ');
        };

        const actionSelector = 'button, [role="button"], input[type="button"], input[type="submit"], a';
        const candidateSelector = [
          '[id*="cookie" i]',
          '[class*="cookie" i]',
          '[id*="consent" i]',
          '[class*="consent" i]',
          '[id*="privacy" i]',
          '[class*="privacy" i]',
          '[id*="newsletter" i]',
          '[class*="newsletter" i]',
          '[id*="popup" i]',
          '[class*="popup" i]',
          'dialog',
          '[role="dialog"]',
          '[aria-modal="true"]',
          'aside',
          'footer',
          'section',
          'div',
          'form'
        ].join(', ');

        const elements = Array.from(document.querySelectorAll(candidateSelector));
        const ranked = elements
          .filter(element => isVisible(element))
          .map(element => {
            const text = normalize(elementText(element));
            if (!text || text.length < 15 || text.length > 2500) {
              return null;
            }

            const contextTerms = kind === 'consent' ? consentContextTerms : popupContextTerms;
            const matchedTerms = includesAny(text, contextTerms);
            const riskyTerms = includesAny(text, riskTerms);
            const isDialogLike = element.matches('dialog, [role="dialog"], [aria-modal="true"]');
            let score = matchedTerms.length * 3;
            if (kind === 'consent' && (text.includes('cookie') || text.includes('piskot'))) score += 2;
            if (kind === 'consent' && (text.includes('consent') || text.includes('soglas'))) score += 2;
            if (kind === 'popup' && (text.includes('newsletter') || text.includes('subscribe'))) score += 2;
            if (kind === 'popup' && matchedTerms.length === 0 && riskyTerms.length > 0 && isDialogLike) score += 1;

            if (kind === 'consent' && (matchedTerms.length === 0 || score < 3)) {
              return null;
            }

            if (kind === 'popup' && score < 1) {
              return null;
            }

            if (kind === 'popup' && matchedTerms.length === 0 && riskyTerms.length === 0) {
              return null;
            }

            const actions = Array.from(element.querySelectorAll(actionSelector))
              .filter(actionElement => isVisible(actionElement, 8, 8))
              .map(actionElement => {
                const actionText = normalize(elementText(actionElement));
                if (!actionText) return null;

                const negativeMatches = includesAny(actionText, consentNegativeTerms);
                const riskMatches = includesAny(actionText, riskTerms);
                const positiveTerms = kind === 'consent' ? consentAcceptTerms : popupCloseTerms;
                const positiveMatches = includesAny(actionText, positiveTerms);
                const iconOnlyClose = kind === 'popup' && ['x', '×'].includes(actionText);

                const actionScore = positiveMatches.length * 3 + (iconOnlyClose ? 2 : 0);

                if (kind === 'consent' && negativeMatches.length > 0) {
                  return null;
                }

                if (riskMatches.length > 0) {
                  return null;
                }

                if (actionScore === 0) {
                  return null;
                }

                return {
                  element: actionElement as HTMLElement,
                  label: actionText,
                  score: actionScore
                };
              })
              .filter((value): value is { element: HTMLElement; label: string; score: number } => value !== null)
              .sort((left, right) => right.score - left.score);

            return {
              element: element as HTMLElement,
              text,
              score,
              matchedTerms,
              riskyTerms,
              actions
            };
          })
          .filter(
            (
              value
            ): value is {
              element: HTMLElement;
              text: string;
              score: number;
              matchedTerms: string[];
              riskyTerms: string[];
              actions: Array<{ element: HTMLElement; label: string; score: number }>;
            } => value !== null
          )
          .sort((left, right) => right.score - left.score || left.text.length - right.text.length);

        const candidate = ranked[0];
        if (!candidate) {
          return null;
        }

        const markerAttr = kind === 'consent' ? consentMarkerAttr : popupMarkerAttr;
        const marker = `${kind}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        const action = candidate.actions[0];

        if (action) {
          action.element.setAttribute(markerAttr, marker);
        } else {
          candidate.element.setAttribute(markerAttr, marker);
        }

        return {
          kind,
          frameUrl: window.location.href,
          marker,
          buttonLabel: action?.label,
          reason: `${kind} terms: ${candidate.matchedTerms.join(', ') || 'none'}`,
          score: candidate.score,
          riskyTerms: candidate.riskyTerms
        };
      },
      {
        kind,
        consentContextTerms: CONSENT_CONTEXT_TERMS,
        consentAcceptTerms: CONSENT_ACCEPT_TERMS,
        consentNegativeTerms: CONSENT_NEGATIVE_TERMS,
        popupContextTerms: POPUP_CONTEXT_TERMS,
        popupCloseTerms: POPUP_CLOSE_TERMS,
        riskTerms: RISK_TERMS,
        consentMarkerAttr: CONSENT_MARKER_ATTR,
        popupMarkerAttr: POPUP_MARKER_ATTR
      }
    );
  } catch {
    return null;
  }
}

async function findCandidate(page: Page, kind: CandidateKind): Promise<{ frame: Frame; candidate: MarkedCandidate } | null> {
  const candidates: Array<{ frame: Frame; candidate: MarkedCandidate }> = [];

  for (const frame of page.frames()) {
    const candidate = await scanFrameForCandidate(frame, kind);
    if (candidate) {
      candidates.push({ frame, candidate });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => {
    const actionableDelta = Number(Boolean(right.candidate.buttonLabel)) - Number(Boolean(left.candidate.buttonLabel));
    if (actionableDelta !== 0) {
      return actionableDelta;
    }
    return right.candidate.score - left.candidate.score;
  });

  return candidates[0];
}

export async function preparePageForAutomation(
  page: Page,
  context: BrowserContext,
  url: string,
  options: PreparePageOptions
): Promise<PagePreparationResult> {
  const result: PagePreparationResult = {
    consentOutcome: 'not_detected',
    consentMethod: 'none',
    popupOutcome: 'not_detected',
    popupMethod: 'none',
    details: [`Preparing ${url}`]
  };

  await page.waitForTimeout(options.config.settleTimeoutMs);

  if (!options.config.disableFallback) {
    const consentTarget = await findCandidate(page, 'consent');

    if (!consentTarget) {
      if (options.hadStoredState) {
        result.consentOutcome = 'accepted_extension_or_preexisting';
        result.consentMethod = 'preexisting_storage_state';
        result.details.push('No consent banner detected after loading cached state');
      } else if (options.extensionActive) {
        result.consentOutcome = 'accepted_extension_or_preexisting';
        result.consentMethod = 'extension';
        result.details.push('No consent banner detected after extension settle period');
      } else {
        result.details.push('No consent-like UI detected');
      }
    } else {
      result.frameUrl = consentTarget.candidate.frameUrl;
      result.details.push(`Consent candidate in frame ${consentTarget.candidate.frameUrl}`);

      if (consentTarget.candidate.riskyTerms.length > 0 || !consentTarget.candidate.buttonLabel) {
        result.consentOutcome = 'skipped_unsafe';
        result.consentMethod = 'none';
        result.reason = consentTarget.candidate.riskyTerms.length > 0
          ? `Risky consent container terms: ${consentTarget.candidate.riskyTerms.join(', ')}`
          : 'Consent container found without a safe positive action';
      } else if (!isSafeConsentAction(consentTarget.candidate.buttonLabel)) {
        result.consentOutcome = 'skipped_unsafe';
        result.reason = `Candidate action looked unsafe: ${consentTarget.candidate.buttonLabel}`;
      } else {
        const clicked = await tryClickMarked(consentTarget.frame, CONSENT_MARKER_ATTR, consentTarget.candidate.marker);
        if (clicked) {
          await page.waitForTimeout(750);
          result.consentOutcome = 'accepted_fallback';
          result.consentMethod = 'fallback';
          result.details.push(`Clicked consent action: ${consentTarget.candidate.buttonLabel}`);
        } else {
          result.consentOutcome = 'skipped_unsafe';
          result.reason = `Failed to click consent action: ${consentTarget.candidate.buttonLabel}`;
        }
      }
    }
  } else if (options.hadStoredState) {
    result.consentOutcome = 'accepted_extension_or_preexisting';
    result.consentMethod = 'preexisting_storage_state';
    result.details.push('Consent fallback disabled and cached state present');
  }

  if (!options.config.disablePopupCloser) {
    const popupTarget = await findCandidate(page, 'popup');

    if (!popupTarget) {
      result.details.push('No popup-like UI detected');
    } else if (popupTarget.candidate.riskyTerms.length > 0 || !popupTarget.candidate.buttonLabel) {
      result.popupOutcome = 'skipped_unsafe';
      result.reason = popupTarget.candidate.riskyTerms.length > 0
        ? `Risky popup terms: ${popupTarget.candidate.riskyTerms.join(', ')}`
        : 'Popup candidate found without a safe close action';
    } else if (!isSafePopupCloseAction(popupTarget.candidate.buttonLabel)) {
      result.popupOutcome = 'skipped_unsafe';
      result.reason = `Popup close action looked unsafe: ${popupTarget.candidate.buttonLabel}`;
    } else {
      const clicked = await tryClickMarked(popupTarget.frame, POPUP_MARKER_ATTR, popupTarget.candidate.marker);
      if (clicked) {
        await page.waitForTimeout(500);
        result.popupOutcome = 'closed';
        result.popupMethod = 'fallback';
        result.details.push(`Closed popup action: ${popupTarget.candidate.buttonLabel}`);
      } else {
        result.popupOutcome = 'skipped_unsafe';
        result.reason = `Failed to click popup action: ${popupTarget.candidate.buttonLabel}`;
      }
    }
  }

  return result;
}
