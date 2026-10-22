/**
 * LumiScript-ko — Korean UI catalog (fork-only files).
 *
 * Key = the exact English source string passed to `t()` / `tx()`.
 * Value = Korean (해요체 for messages, noun form for labels — docs/ko-glossary.md).
 * Keep `{placeholders}` identical. Missing keys fall back to English.
 *
 * Split by UI area (src/i18n/ko/*.ts) so each file stays reviewable. A key may
 * appear in more than one area only with the same value (checked by
 * tests/i18n/ko-catalog.test.ts).
 */

import { KO_COMMON } from './ko/common.js';
import { KO_MANAGE } from './ko/manage.js';
import { KO_STORAGE } from './ko/storage.js';
import { KO_ASSISTANT } from './ko/assistant.js';
import { KO_PANEL } from './ko/panel.js';
import { KO_CARDSCRIPTS } from './ko/cardscripts.js';
import { KO_BACKEND } from './ko/backend.js';
import { KO_REFERENCE } from './ko/reference.js';

export const KO_AREAS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  common: KO_COMMON,
  manage: KO_MANAGE,
  storage: KO_STORAGE,
  assistant: KO_ASSISTANT,
  panel: KO_PANEL,
  cardscripts: KO_CARDSCRIPTS,
  backend: KO_BACKEND,
  reference: KO_REFERENCE,
};

export const KO: Readonly<Record<string, string>> = {
  ...KO_COMMON,
  ...KO_MANAGE,
  ...KO_STORAGE,
  ...KO_ASSISTANT,
  ...KO_PANEL,
  ...KO_CARDSCRIPTS,
  ...KO_BACKEND,
  ...KO_REFERENCE,
};
