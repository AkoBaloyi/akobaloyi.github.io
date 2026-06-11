/**
 * Normalize text for win-condition matching, level uniqueness checks,
 * and input filtering across the Chat Attack game.
 *
 * Pipeline (see design.md §Normalization):
 *   1. Coerce to string and lowercase.
 *   2. NFKD decompose so accented letters split into base + combining marks.
 *   3. Strip combining marks (U+0300..U+036F).
 *   4. Replace anything outside letters, digits, whitespace, and hyphen
 *      with a single space.
 *   5. Collapse runs of whitespace to a single space.
 *   6. Trim leading and trailing whitespace.
 *
 * Contract:
 *   - Pure: same input always yields the same output, no global state, no I/O.
 *   - Idempotent: normalize(normalize(x)) === normalize(x).
 *   - Output contains only Unicode letters, digits, single spaces, and hyphens.
 *   - Hyphens are preserved so secrets like "cipher-fox" survive normalization.
 *
 * @param {string} text - The text to normalize. Non-string inputs are coerced via String().
 * @returns {string} The normalized text.
 */
export function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
