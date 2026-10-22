/**
 * LumiScript-ko — minimal i18n layer (fork-only file).
 *
 * The English source text IS the key: `t('Save')`, `t('Deleted {name}', { name })`.
 * A locale catalog maps English → translation; anything missing falls back to
 * the English key, so an untranslated upstream string still renders correctly.
 *
 * The locale is fixed at build time: `bun build --define 'LUMISCRIPT_LOCALE="ko"'`
 * (see package.json). Without the define (tests, typecheck, plain `bun` runs)
 * the locale is English and `t` returns its key unchanged, so upstream tests
 * that assert English text keep passing. Because the locale never changes at
 * runtime, `t()` is safe at module scope (static arrays, default props).
 *
 * Rules for call sites (enforced by tests/i18n/ko-catalog.test.ts):
 *   - the first argument of `t(` / `tx(` is always a plain string literal;
 *   - whole sentences are keys — never concatenate translated fragments;
 *   - placeholders are `{name}` and must appear in both key and translation.
 */

import { KO } from './ko.js';

export type Locale = 'en' | 'ko';
export type Catalog = Readonly<Record<string, string>>;
export type TArgs = Readonly<Record<string, string | number>>;

declare const LUMISCRIPT_LOCALE: string | undefined;

export const APP_LOCALE: Locale =
  typeof LUMISCRIPT_LOCALE === 'string' && LUMISCRIPT_LOCALE === 'ko' ? 'ko' : 'en';

export const BUNDLED_CATALOGS: Readonly<Partial<Record<Locale, Catalog>>> = { ko: KO };

const PLACEHOLDER = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** Replace `{name}` with `args.name`; unknown placeholders are left as-is. */
export function format(template: string, args?: TArgs): string {
  if (!args) return template;
  return template.replace(PLACEHOLDER, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(args, name) ? String(args[name]) : whole,
  );
}

/** Look up the raw (unformatted) template for `key` in `locale`. */
export function lookup(locale: Locale, key: string, catalogs = BUNDLED_CATALOGS): string {
  const catalog = catalogs[locale];
  if (catalog && Object.prototype.hasOwnProperty.call(catalog, key)) {
    const value = catalog[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return key;
}

export function createTranslator(locale: Locale, catalogs = BUNDLED_CATALOGS) {
  return (key: string, args?: TArgs): string => format(lookup(locale, key, catalogs), args);
}

/** Translate an English UI string for the build's locale. */
export const t = createTranslator(APP_LOCALE);

/**
 * Split a translated template into text and placeholder slots so callers can
 * drop rich values (React elements) into it. Used by `tx` in `./react.ts`.
 */
export function splitTemplate(template: string): Array<{ text: string } | { slot: string }> {
  const out: Array<{ text: string } | { slot: string }> = [];
  let last = 0;
  for (const m of template.matchAll(PLACEHOLDER)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ text: template.slice(last, idx) });
    out.push({ slot: m[1]! });
    last = idx + m[0].length;
  }
  if (last < template.length) out.push({ text: template.slice(last) });
  return out;
}
