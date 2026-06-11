/**
 * Honest-copy linter for the Chat Attack game tab.
 *
 * Enforces the User_Facing_Copy contract from REQ-11:
 *   §1 length: each piece of copy is between 40 and 280 characters.
 *   §2 banned superlatives: the case-insensitive substring set
 *      { "unbreakable", "bulletproof", "best-in-class", "industry-leading",
 *        "world-class", "state-of-the-art", "cutting-edge", "impenetrable",
 *        "uncrackable" }.
 *   §3 forbidden punctuation: em dash (U+2014) and en dash (U+2013).
 *   §5 dev-only console warning: on `localhost`, `127.0.0.1`, and `*.local`
 *      hosts, log a warning naming the offending text and the violation
 *      rather than throwing.
 *
 * `lintCopy` throws on any violation. `runDevLintIfDev` is the
 * production-safe entry point that warns rather than throws and is a no-op
 * when the page is not on a dev host.
 *
 * @module chat-attack/game/lint-copy
 */

/**
 * Lowercased banned superlative substrings (REQ-11 §2).
 *
 * Comparison is case-insensitive substring matching: any text whose
 * lowercase form contains one of these strings as a substring fails the lint.
 *
 * @type {ReadonlyArray<string>}
 */
export const BANNED_SUPERLATIVES = Object.freeze([
  'unbreakable',
  'bulletproof',
  'best-in-class',
  'industry-leading',
  'world-class',
  'state-of-the-art',
  'cutting-edge',
  'impenetrable',
  'uncrackable',
]);

/**
 * Forbidden punctuation pattern (REQ-11 §3): em dash (U+2014) and en dash (U+2013).
 *
 * @type {RegExp}
 */
export const FORBIDDEN_PUNCT = /[\u2014\u2013]/;

/**
 * Validate a single piece of User_Facing_Copy against REQ-11 §§1-3.
 *
 * Throws `Error` with a message that names the `label` and the violation:
 *   - length out of [40, 280] range
 *   - case-insensitive match against any string in `BANNED_SUPERLATIVES`
 *   - any em dash or en dash via `FORBIDDEN_PUNCT`
 *
 * Checks run in order (length, then banned superlative, then punctuation)
 * and the first violation throws so the caller sees the most specific failure.
 *
 * @param {string} text - The copy to validate.
 * @param {string} label - A human-readable label included in error messages.
 * @returns {void}
 * @throws {Error} when any of the three rules is violated.
 */
export function lintCopy(text, label) {
  if (typeof text !== 'string') {
    throw new Error(`${label}: text must be a string`);
  }

  if (text.length < 40 || text.length > 280) {
    throw new Error(
      `${label}: length ${text.length} is out of range [40, 280]`,
    );
  }

  const lowered = text.toLowerCase();
  for (const banned of BANNED_SUPERLATIVES) {
    if (lowered.includes(banned)) {
      throw new Error(`${label}: banned superlative "${banned}" present`);
    }
  }

  if (FORBIDDEN_PUNCT.test(text)) {
    throw new Error(
      `${label}: em dash (U+2014) or en dash (U+2013) present, use comma or colon instead`,
    );
  }
}

/**
 * Detect whether the current page is running on a dev host (REQ-11 §5).
 *
 * Returns true when `window.location.hostname` is `localhost`, `127.0.0.1`,
 * or matches `*.local`. Returns false in any environment without a usable
 * `window.location` (Node, web workers, SSR), so importing this module
 * server-side or from tests is safe and lint becomes a no-op.
 *
 * @returns {boolean}
 */
function isDevHost() {
  if (typeof window === 'undefined' || !window.location) {
    return false;
  }
  const hostname = window.location.hostname;
  if (typeof hostname !== 'string') {
    return false;
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return true;
  }
  return /\.local$/.test(hostname);
}

/**
 * Run `lintCopy` over an array of `{ text, label }` items, warning rather
 * than throwing when violations are found (REQ-11 §5).
 *
 * Behavior:
 *   - On a dev host (`localhost`, `127.0.0.1`, `*.local`), each violation
 *     is reported via `console.warn(error.message)` and iteration continues.
 *   - On any other host (production GitHub Pages, custom domain, etc.),
 *     the function is a no-op so a missed lint cannot break the page.
 *   - The function never re-throws, even if `lintCopy` throws for reasons
 *     unrelated to the three rules.
 *
 * @param {ReadonlyArray<{ text: string, label: string }>} items
 * @returns {void}
 */
export function runDevLintIfDev(items) {
  if (!isDevHost()) {
    return;
  }
  if (!Array.isArray(items)) {
    return;
  }
  for (const item of items) {
    try {
      lintCopy(item.text, item.label);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(err instanceof Error ? err.message : String(err));
    }
  }
}
