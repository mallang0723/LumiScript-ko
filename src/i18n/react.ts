/**
 * LumiScript-ko — rich-text variant of `t` for JSX (fork-only file).
 *
 *   tx('Click {save} to keep changes.', { save: <b>Save</b> })
 *
 * Returns an array of keyed fragments, so it can be dropped straight into JSX.
 * Placeholders without a matching value are rendered literally.
 */

import { createElement, Fragment, type ReactNode } from 'react';
import { APP_LOCALE, lookup, splitTemplate } from './index.js';

export function tx(key: string, parts: Readonly<Record<string, ReactNode>>): ReactNode[] {
  return splitTemplate(lookup(APP_LOCALE, key)).map((piece, i) =>
    createElement(
      Fragment,
      { key: i },
      'text' in piece
        ? piece.text
        : Object.prototype.hasOwnProperty.call(parts, piece.slot)
          ? parts[piece.slot]
          : `{${piece.slot}}`,
    ),
  );
}
