/**
 * LumiScript-ko — locale-specific CSS appended to the panel stylesheet (fork-only file).
 *
 * Browsers may break Hangul between any two syllables, so a short label such as
 * a "트리거" type pill can wrap one syllable per line in a tight flex row where the
 * English single word ("Trigger") never would. `word-break: keep-all` makes Korean
 * wrap at spaces like English does, keeping upstream layouts intact. Scoped to
 * LumiScript's own roots (dock panel, settings, modals, Lisa, diagnostics).
 * Empty in the English build.
 */

import { APP_LOCALE } from './index.js';

export const LOCALE_CSS =
  APP_LOCALE === 'ko'
    ? `
.ls-panel, .ls-settings, .ls-modal-overlay, .ls-asst-backdrop, .ls-diag-backdrop {
  word-break: keep-all;
}
`
    : '';
