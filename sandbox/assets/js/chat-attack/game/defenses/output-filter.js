/**
 * Output filter defense module.
 *
 * Implements the post-generation redaction applied for the levels whose
 * `defenseLayer` is `'output'`, `'dual'`, `'multilingual'`, or `'all'`
 * (Levels 2, 4, 6, and 7 in REQ-1 §2). The filter runs after the model
 * response is received and before it is shown to the player; the
 * Level_Engine still runs `checkWin` against the pre-redaction text so
 * that a successful extraction is detected even though the displayed
 * reply has the secret replaced (design.md §Defense_pipeline).
 *
 * Contract (REQ-1 §2 Levels 2, 4, 6, 7; design.md §Defense_pipeline):
 *   - Pure function: same inputs always yield the same output, no I/O,
 *     no global state, no console output.
 *   - For output-filter levels (`'output'`, `'dual'`), redact the
 *     level's own `secretWord`.
 *   - For multilingual-filter levels (`'multilingual'`, `'all'`),
 *     redact each of the level's three `multilingualSecrets` variants
 *     (English, French, Spanish). For `'all'` the level's own
 *     `secretWord` is also redacted; duplicates (case-insensitive) are
 *     coalesced so the underlying regex set stays minimal.
 *   - For every other level (and for a missing or null `level`),
 *     return `String(text)` unchanged.
 *
 * Implementation notes:
 *   - The redaction operates on the original text rather than the
 *     normalized text so the player sees a human-readable reply with
 *     `[REDACTED]` substituted in place. Case-insensitivity comes from
 *     the regex `i` flag, not from `normalize()`.
 *   - Each secret is wrapped in `\b...\b` word boundaries so we do not
 *     redact substrings inside larger words (for example, `'lighthouse'`
 *     should not match inside `'lighthouseman'`). The standard ECMAScript
 *     `\b` is letter/digit-vs-non-letter/digit, and the hyphen in
 *     `cipher-fox` is a non-word character; the regex `\bcipher-fox\b`
 *     therefore matches in `'The cipher-fox arrived.'` because the
 *     boundaries land between space-and-`c` and `x`-and-`.`. Spaces
 *     and accented letters inside multi-word or non-ASCII secrets are
 *     preserved literally by the escape step below.
 *   - All other regex metacharacters are escaped before assembly so a
 *     hypothetical secret containing `.` or `+` is treated as a literal.
 */

const OUTPUT_FILTER_LAYERS = new Set(['output', 'dual', 'multilingual', 'all']);
const MULTILINGUAL_LAYERS = new Set(['multilingual', 'all']);

const REDACTION = '[REDACTED]';
const REGEX_META = /[.*+?^${}()|[\]\\]/g;

/**
 * Escape regex metacharacters in a literal secret so it can be safely
 * embedded in a `RegExp` source string.
 *
 * @param {string} literal
 * @returns {string}
 */
function escapeForRegex(literal) {
  return literal.replace(REGEX_META, '\\$&');
}

/**
 * Determine the deduplicated list of secret strings to redact for the
 * given level. Exported for tests (PROP-5 cases (a), (e)) so the test
 * suite can assert which secrets the filter would target without
 * inspecting the implementation.
 *
 * Deduplication is case-insensitive and trims surrounding whitespace.
 * Empty strings are dropped. The order of the returned array matches
 * the order in which the underlying regexes are applied; for `'all'`
 * the own `secretWord` is appended last so that the English/French/
 * Spanish variants drive the dedupe decisions for level 7 (where
 * `secretWord === multilingualSecrets.en === 'quasar'`).
 *
 * @param {{ defenseLayer?: string, secretWord?: string,
 *           multilingualSecrets?: { en?: string, fr?: string, es?: string } } | null | undefined} level
 * @returns {string[]} The deduplicated list of secrets the filter
 *   would redact for this level. Empty array when the level has no
 *   output-side defense.
 */
export function getSecretsToRedact(level) {
  if (!level || !OUTPUT_FILTER_LAYERS.has(level.defenseLayer)) {
    return [];
  }

  /** @type {string[]} */
  const collected = [];

  if (MULTILINGUAL_LAYERS.has(level.defenseLayer) && level.multilingualSecrets) {
    for (const lang of ['en', 'fr', 'es']) {
      const variant = level.multilingualSecrets[lang];
      if (typeof variant === 'string') {
        collected.push(variant);
      }
    }
  }

  if (typeof level.secretWord === 'string') {
    collected.push(level.secretWord);
  }

  /** @type {string[]} */
  const deduped = [];
  const seen = new Set();
  for (const raw of collected) {
    const trimmed = raw.trim();
    if (trimmed === '') continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(trimmed);
  }

  return deduped;
}

/**
 * Build a case-insensitive global regex that matches the given literal
 * secret with `\b` word boundaries on either side.
 *
 * @param {string} secret
 * @returns {RegExp}
 */
function buildSecretRegex(secret) {
  return new RegExp(`\\b${escapeForRegex(secret)}\\b`, 'gi');
}

/**
 * Apply the output filter for the given level, redacting every
 * occurrence of the level's secret(s) with `[REDACTED]`.
 *
 * @param {string} text - The model response text.
 * @param {{ defenseLayer?: string, secretWord?: string,
 *           multilingualSecrets?: { en?: string, fr?: string, es?: string } } | null | undefined} level
 *   The active level definition. Must expose `defenseLayer`; may expose
 *   `secretWord` and `multilingualSecrets`. A missing or falsy `level`
 *   is treated as no filter.
 * @returns {string} The redacted text. Always a string, even when the
 *   filter is a no-op (the input is coerced via `String(...)`).
 */
export function applyOutputFilter(text, level) {
  const original = String(text);

  const secrets = getSecretsToRedact(level);
  if (secrets.length === 0) {
    return original;
  }

  let redacted = original;
  for (const secret of secrets) {
    redacted = redacted.replace(buildSecretRegex(secret), REDACTION);
  }

  return redacted;
}
