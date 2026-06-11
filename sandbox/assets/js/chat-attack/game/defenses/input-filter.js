/**
 * Input filter defense module.
 *
 * Implements the pre-generation banned-keyword check applied for the
 * levels whose `defenseLayer` is `'input'`, `'dual'`, or `'all'` (Levels
 * 3, 4, and 7 in REQ-1 §2). The filter runs before any call to
 * gemini-2.0-flash and short-circuits the request when the normalized
 * user message contains a banned substring.
 *
 * Contract (REQ-1 §2 Levels 3, 4, 7; design.md §Defense_pipeline):
 *   - Pure function: same inputs always yield the same output, no I/O,
 *     no global state, no console output.
 *   - For input-filter levels, returns `{ allowed: false, reason:
 *     'banned_keyword', sanitizedMessage }` when any keyword in the
 *     effective banned list appears as a substring of the normalized
 *     message; otherwise returns `{ allowed: true, sanitizedMessage }`.
 *   - For every other level (including a missing or null `level`),
 *     returns `{ allowed: true, sanitizedMessage: String(message) }`.
 *   - `sanitizedMessage` is always the original message coerced via
 *     `String(...)`. We deliberately keep the original text so callers
 *     can echo the blocked message back to the user without lossy
 *     mutation.
 */

import { normalize } from '../normalize.js';

/**
 * Base banned-keyword list shared across all input-filter levels.
 * Comparison is `normalize(message).includes(keyword)`, so every entry
 * must already be in normalized form (lowercase letters, digits, single
 * spaces, hyphens). The list is intentionally small: the puzzle is the
 * combined defense pipeline, not the keyword wall.
 *
 * Exported as a frozen array so tests can assert against it without
 * being able to mutate the source-of-truth.
 *
 * @type {ReadonlyArray<string>}
 */
export const BASE_BANNED_KEYWORDS = Object.freeze([
  'secret',
  'password',
  'system prompt',
  'system instruction',
  'instructions',
  'instruction',
  'reveal',
  'leak',
  'tell me',
  'what is the',
  'what is your',
  'spell',
  'translate',
  'encode',
  'base64',
  'rot13',
  'cipher',
]);

const INPUT_FILTER_LAYERS = new Set(['input', 'dual', 'all']);

/**
 * Apply the input filter for the given level.
 *
 * For input-filter levels we also extend the banned list with the
 * level's own `secretWord` and its multilingual variants when present.
 * This is a small generalization beyond the strict task wording: it
 * stops a player from trivially smuggling the secret in their own
 * message and pretending the model emitted it. REQ-1 §8 is enforced
 * downstream by the Level_Engine, but blocking the submission here
 * keeps the attempt path consistent across levels.
 *
 * @param {string} message - The raw user message.
 * @param {{ defenseLayer?: string, secretWord?: string,
 *           multilingualSecrets?: { en?: string, fr?: string, es?: string } } | null | undefined} level
 *   The active level definition. Must expose `defenseLayer`; may expose
 *   `secretWord` and `multilingualSecrets`. A missing or falsy `level`
 *   is treated as no filter.
 * @returns {{ allowed: boolean, reason?: string, sanitizedMessage: string }}
 *   The filter decision. `reason` is only present when `allowed` is
 *   false; the only reason emitted today is `'banned_keyword'`.
 */
export function applyInputFilter(message, level) {
  const sanitizedMessage = String(message);

  if (!level || !INPUT_FILTER_LAYERS.has(level.defenseLayer)) {
    return { allowed: true, sanitizedMessage };
  }

  const effectiveBanned = [...BASE_BANNED_KEYWORDS];

  if (typeof level.secretWord === 'string') {
    const normalizedSecret = normalize(level.secretWord);
    if (normalizedSecret !== '') {
      effectiveBanned.push(normalizedSecret);
    }
  }

  if (level.multilingualSecrets) {
    for (const lang of ['en', 'fr', 'es']) {
      const variant = level.multilingualSecrets[lang];
      if (typeof variant === 'string') {
        const normalizedVariant = normalize(variant);
        if (normalizedVariant !== '') {
          effectiveBanned.push(normalizedVariant);
        }
      }
    }
  }

  const normalizedMessage = normalize(sanitizedMessage);

  for (const banned of effectiveBanned) {
    if (normalizedMessage.includes(banned)) {
      return {
        allowed: false,
        reason: 'banned_keyword',
        sanitizedMessage,
      };
    }
  }

  return { allowed: true, sanitizedMessage };
}
