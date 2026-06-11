/**
 * Leaderboard handle sanitization and profanity filtering.
 *
 * Pure ES module — no I/O and no worker-runtime dependencies — so it can be
 * unit-tested in plain Node/vitest as well as the Cloudflare workers pool, and
 * imported by `src/index.js` for the `POST /leaderboard` validation pipeline
 * (tasks 38/39).
 *
 * Implements REQ-5:
 *   §5  — sanitization pass: lowercase, strip outside `[a-z0-9_-]`, truncate to 16.
 *   §6  — handles shorter than 3 chars are invalid (length check lives in the
 *         caller; this module supplies the sanitized value to measure).
 *   §7  — reject sanitized handles that match the profanity blocklist.
 *   §13 — sanitization invariant: stored handles always match `^[a-z0-9_-]{3,16}$`.
 */

/**
 * Server-side profanity blocklist.
 *
 * A conservative, internal set of lowercase tokens drawn from the
 * `[a-z0-9_-]` charset (the only characters a sanitized handle can contain).
 * Borderline-innocuous words are intentionally excluded to avoid frustrating
 * legitimate users. The list is internal and can be expanded later without a
 * spec change. Frozen to keep it a stable, read-only constant.
 *
 * @type {ReadonlyArray<string>}
 */
export const PROFANITY_BLOCKLIST = Object.freeze([
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'dick',
  'cock',
  'pussy',
  'asshole',
  'bastard',
  'slut',
  'whore',
  'wanker',
  'bollocks',
  'nigger',
  'nigga',
  'faggot',
  'fag',
  'retard',
  'spic',
  'chink',
  'kike',
  'wetback',
  'tranny',
  'rape',
  'rapist',
  'molest',
  'nazi',
  'hitler',
  'kkk',
  'cum',
]);

/**
 * Letter-substitution ("leet speak") map used to catch obvious obfuscations of
 * blocklisted words. `@` cannot appear in a sanitized handle (it is stripped by
 * {@link sanitizeHandle}), but it is kept here for robustness when this function
 * is called on raw input.
 *
 * @type {Readonly<Record<string, string>>}
 */
const LEET_MAP = Object.freeze({
  '0': 'o',
  '1': 'l',
  '3': 'e',
  '5': 's',
  '@': 'a',
});

/**
 * Sanitize a raw handle into the canonical leaderboard form (REQ-5 §5).
 *
 * Lowercases the input, strips every character outside `[a-z0-9_-]`, and
 * truncates the result to 16 characters. The function is pure, total
 * (never throws — non-string input yields `''`), and idempotent
 * (`sanitizeHandle(sanitizeHandle(x)) === sanitizeHandle(x)`).
 *
 * @param {unknown} raw - Arbitrary input, expected to be a string.
 * @returns {string} A handle matching `^[a-z0-9_-]{0,16}$`.
 */
export function sanitizeHandle(raw) {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 16);
}

/**
 * Decide whether a (sanitized) handle should be rejected as profane (REQ-5 §7).
 *
 * Matching strategy: a sanitized handle has no spaces, so "whole-word match"
 * is interpreted pragmatically as substring containment — a blocklisted token
 * appearing anywhere in the handle rejects it. The check runs against both the
 * handle and a "de-leeted" variant of it (applying {@link LEET_MAP}, e.g.
 * `5h1t` -> `shit`) so simple letter substitutions cannot bypass the list.
 * Comparison is case-insensitive (the handle is lowercased defensively even
 * though {@link sanitizeHandle} already lowercases its output).
 *
 * @param {string} sanitized - A handle, normally the output of {@link sanitizeHandle}.
 * @param {ReadonlyArray<string>} [blocklist=PROFANITY_BLOCKLIST] - Lowercase tokens to match.
 * @returns {boolean} `true` if the handle matches any blocklist token, else `false`.
 */
export function isHandleRejected(sanitized, blocklist = PROFANITY_BLOCKLIST) {
  if (typeof sanitized !== 'string' || sanitized.length === 0) {
    return false;
  }

  const lower = sanitized.toLowerCase();
  const deLeeted = lower.replace(/[01345@]/g, (ch) => LEET_MAP[ch] ?? ch);

  for (const word of blocklist) {
    if (lower.includes(word) || deLeeted.includes(word)) {
      return true;
    }
  }
  return false;
}
