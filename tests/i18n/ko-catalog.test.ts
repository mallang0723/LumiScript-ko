/**
 * LumiScript-ko — Korean catalog checks (fork-only file).
 *
 * 1. Every `t('…')` / `tx('…')` call in src/ passes a plain string literal.
 * 2. Every key used in src/ has a Korean entry (missing keys).
 * 3. Every catalog entry is still used in src/ (stale keys after an upstream merge).
 * 4. `{placeholder}` sets match between key and translation (argument parity).
 * 5. Translations are actually Korean (untranslated strings), and code spans
 *    (`backticks`, api.* names, UPPER_SNAKE event names) survive untouched.
 * 6. The translator itself: fallback, formatting, rich-text splitting.
 */

import { describe, test, expect } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { KO } from '../../src/i18n/ko.js';
import { APP_LOCALE, createTranslator, format, splitTemplate, t } from '../../src/i18n/index.js';

const ROOT = join(import.meta.dir, '..', '..');
const SRC = join(ROOT, 'src');

/**
 * Values that are intentionally identical to (or not Hangul in) the English key —
 * product names and pure symbols. Keep this list short.
 */
const INTENTIONALLY_UNCHANGED = new Set<string>([
  'LumiScript',
  'AsyncFunction',
  'IntelliSense',
  'Lisa',
  'JSON',
  'OK',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'generated' || name === 'corpus' || name === 'i18n') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

interface CallSite { file: string; line: number; key?: string; raw: string }

/** Parse a JS string literal starting at `src[i]` (quote char). Returns [value, endIndex] or null. */
function readLiteral(src: string, i: number): [string, number] | null {
  const q = src[i];
  if (q !== '\'' && q !== '"' && q !== '`') return null;
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') { j += 2; continue; }
    if (q === '`' && c === '$' && src[j + 1] === '{') return null; // template with substitutions
    if (c === q) break;
    j++;
  }
  if (j >= src.length) return null;
  const literal = src.slice(i, j + 1);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const value = new Function(`return ${literal};`)() as string;
  return [value, j + 1];
}

function collectCalls(): CallSite[] {
  const calls: CallSite[] = [];
  const re = /(?<![\w.$])(t|tx)\(/g;
  for (const file of walk(SRC)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(re)) {
      let i = (m.index ?? 0) + m[0].length;
      while (/\s/.test(src[i] ?? '')) i++;
      const line = src.slice(0, m.index).split('\n').length;
      const lit = readLiteral(src, i);
      calls.push({
        file: relative(ROOT, file),
        line,
        key: lit?.[0],
        raw: src.slice(m.index, Math.min(src.length, (m.index ?? 0) + 80)).split('\n')[0]!,
      });
    }
  }
  return calls;
}

const CALLS = collectCalls();
const USED_KEYS = new Set(CALLS.flatMap((c) => (c.key === undefined ? [] : [c.key])));
const placeholders = (s: string) => [...s.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((m) => m[1]).sort();
const HANGUL = /[가-힣]/;

describe('ko catalog', () => {
  test('the i18n layer is actually used', () => {
    expect(CALLS.length).toBeGreaterThan(100);
  });

  test('every t()/tx() call passes a string literal key', () => {
    const bad = CALLS.filter((c) => c.key === undefined).map((c) => `${c.file}:${c.line}  ${c.raw}`);
    expect(bad).toEqual([]);
  });

  test('no missing keys — every key used in src/ has a Korean entry', () => {
    const missing = [...USED_KEYS].filter((k) => !Object.prototype.hasOwnProperty.call(KO, k));
    const where = missing.map((k) => {
      const c = CALLS.find((x) => x.key === k)!;
      return `${c.file}:${c.line}  ${JSON.stringify(k)}`;
    });
    expect(where).toEqual([]);
  });

  test('no stale keys — every catalog entry is used in src/', () => {
    const stale = Object.keys(KO).filter((k) => !USED_KEYS.has(k));
    expect(stale).toEqual([]);
  });

  test('argument parity — same {placeholders} in key and translation', () => {
    const bad = Object.entries(KO)
      .filter(([k, v]) => JSON.stringify(placeholders(k)) !== JSON.stringify(placeholders(v)))
      .map(([k, v]) => `${JSON.stringify(k)} → ${JSON.stringify(v)}`);
    expect(bad).toEqual([]);
  });

  test('no untranslated strings — values are non-empty Korean', () => {
    const bad = Object.entries(KO)
      .filter(([k, v]) => !INTENTIONALLY_UNCHANGED.has(k) && (v.trim() === '' || !HANGUL.test(v)))
      .map(([k, v]) => `${JSON.stringify(k)} → ${JSON.stringify(v)}`);
    expect(bad).toEqual([]);
  });

  test('code spans survive translation (backticks, api.* names, EVENT_NAMES)', () => {
    const bad: string[] = [];
    for (const [k, v] of Object.entries(KO)) {
      const tokens = [
        ...[...k.matchAll(/`[^`]+`/g)].map((m) => m[0]),
        ...[...k.matchAll(/\bapi\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g)].map((m) => m[0]),
        ...[...k.matchAll(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g)].map((m) => m[0]),
      ];
      for (const tok of tokens) if (!v.includes(tok)) bad.push(`${JSON.stringify(k)} lost ${tok}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('translator', () => {
  test('tests run unlocalised (no LUMISCRIPT_LOCALE define) so upstream English assertions hold', () => {
    expect(APP_LOCALE).toBe('en');
    expect(t('this key does not exist {x}', { x: 1 })).toBe('this key does not exist 1');
  });

  test('ko translator returns Korean and falls back to the English key', () => {
    const ko = createTranslator('ko', { ko: { 'Save': '저장', 'Deleted {name}': '{name} 삭제함' } });
    expect(ko('Save')).toBe('저장');
    expect(ko('Deleted {name}', { name: 'a' })).toBe('a 삭제함');
    expect(ko('Untranslated')).toBe('Untranslated');
  });

  test('format leaves unknown placeholders and code braces alone', () => {
    expect(format('{ extensionId, permission } {n}', { n: 2 })).toBe('{ extensionId, permission } 2');
    expect(format('{a}{a}', { a: 'x' })).toBe('xx');
  });

  test('splitTemplate yields text and slots in order', () => {
    expect(splitTemplate('Click {save} now')).toEqual([{ text: 'Click ' }, { slot: 'save' }, { text: ' now' }]);
  });
});
