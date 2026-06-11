import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import {
  applyOutputFilter,
  getSecretsToRedact,
} from '../game/defenses/output-filter.js';
import { LEVELS } from '../game/levels.js';
import { normalize } from '../game/normalize.js';

// PROP-5 — Property tests for the pure `applyOutputFilter` defense module.
//
// **Validates: Requirements REQ-1 §2, Design §Testing strategy** — PROP-5
//
// The five properties below correspond exactly to task 15 in
// `.kiro/specs/sandbox-gandalf-mode/tasks.md`:
//   (a) for output-filter levels, the secret word never appears verbatim
//       in the result (after normalization) when the secret has been
//       inserted into the generated text.
//   (b) for non-filter levels, `applyOutputFilter(text, level) === text`
//       for any string input.
//   (c) idempotency — `applyOutputFilter(applyOutputFilter(t, l), l) ===
//       applyOutputFilter(t, l)` for every level.
//   (d) text not containing any of the level's secrets passes through
//       unchanged for any level.
//   (e) for level 6, each of the three multilingual variants
//       (`en`, `fr`, `es`) is independently redacted.

const OUTPUT_FILTER_LAYERS = new Set(['output', 'dual', 'multilingual', 'all']);

const OUTPUT_FILTER_LEVELS = LEVELS.filter((l) =>
  OUTPUT_FILTER_LAYERS.has(l.defenseLayer),
);
const NON_FILTER_LEVELS = LEVELS.filter(
  (l) => !OUTPUT_FILTER_LAYERS.has(l.defenseLayer),
);

// Sanity-check the partition matches the requirement spec so a future
// re-ordering of LEVELS does not silently weaken this suite.
const filterIndexes = OUTPUT_FILTER_LEVELS.map((l) => l.index).sort();
const nonFilterIndexes = NON_FILTER_LEVELS.map((l) => l.index).sort();
if (
  filterIndexes.join(',') !== '2,4,6,7' ||
  nonFilterIndexes.join(',') !== '1,3,5'
) {
  throw new Error(
    'PROP-5 partition mismatch: expected output-filter levels [2,4,6,7] ' +
      `and non-filter levels [1,3,5], got [${filterIndexes}] and ` +
      `[${nonFilterIndexes}].`,
  );
}

const levelArb = fc.constantFrom(...LEVELS);
const outputFilterArb = fc.constantFrom(...OUTPUT_FILTER_LEVELS);
const nonFilterArb = fc.constantFrom(...NON_FILTER_LEVELS);
const langArb = fc.constantFrom('en', 'fr', 'es');

const LEVEL_6 = LEVELS.find((l) => l.index === 6);
if (!LEVEL_6 || !LEVEL_6.multilingualSecrets) {
  throw new Error('PROP-5 setup: level 6 with multilingualSecrets not found.');
}

/**
 * For property (a) and (e): we surround the inserted secret with spaces
 * so it always lands on `\b` word boundaries regardless of what
 * `pre` and `suf` look like. We additionally skip cases where `pre` or
 * `suf` already happen to contain the secret as a substring (after
 * normalization), because in that case a longer word like `"auroras"`
 * legitimately survives redaction (the regex uses `\b` boundaries) and
 * `normalize(result).includes(normalize(secret))` would return true for
 * a reason unrelated to the inserted occurrence.
 */
function neighborhoodSafe(pre, suf, secret) {
  const n = normalize(secret);
  return !normalize(pre).includes(n) && !normalize(suf).includes(n);
}

describe('applyOutputFilter (PROP-5)', () => {
  it('(a) output-filter levels redact the inserted secret in every variant', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        outputFilterArb,
        (pre, suf, lvl) => {
          const secrets = getSecretsToRedact(lvl);
          // Each output-filter level has at least one secret to redact.
          if (secrets.length === 0) return false;
          for (const secret of secrets) {
            if (!neighborhoodSafe(pre, suf, secret)) {
              // Skip neighborhoods that would create a longer-word match
              // where `\b` does not fire — see comment on
              // `neighborhoodSafe`.
              continue;
            }
            const text = pre + ' ' + secret + ' ' + suf;
            const result = applyOutputFilter(text, lvl);
            if (normalize(result).includes(normalize(secret))) {
              return false;
            }
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('(b) non-filter levels are a pass-through for string input', () => {
    fc.assert(
      fc.property(fc.string(), nonFilterArb, (text, lvl) => {
        return applyOutputFilter(text, lvl) === text;
      }),
    );
  });

  it('(c) idempotent for every level', () => {
    fc.assert(
      fc.property(fc.string(), levelArb, (text, lvl) => {
        const once = applyOutputFilter(text, lvl);
        const twice = applyOutputFilter(once, lvl);
        return once === twice;
      }),
    );
  });

  it('(d) text not containing any secret passes through unchanged', () => {
    fc.assert(
      fc.property(fc.string(), levelArb, (text, lvl) => {
        const secrets = getSecretsToRedact(lvl);
        // Skip when the random text already contains a secret (the
        // filter is supposed to redact it, so the input would change).
        // For non-filter levels `secrets` is empty and the precondition
        // is trivially satisfied.
        const normText = normalize(text);
        fc.pre(secrets.every((s) => !normText.includes(normalize(s))));
        return applyOutputFilter(text, lvl) === text;
      }),
      { numRuns: 200 },
    );
  });

  it('(e) level 6 independently redacts each multilingual variant', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        langArb,
        (pre, suf, lang) => {
          const variant = LEVEL_6.multilingualSecrets[lang];
          if (!neighborhoodSafe(pre, suf, variant)) return true; // skip
          const text = pre + ' ' + variant + ' ' + suf;
          const result = applyOutputFilter(text, LEVEL_6);
          return !normalize(result).includes(normalize(variant));
        },
      ),
      { numRuns: 200 },
    );
  });
});
