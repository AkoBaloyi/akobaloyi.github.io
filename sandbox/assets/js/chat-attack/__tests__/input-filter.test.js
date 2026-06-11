import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import {
  applyInputFilter,
  BASE_BANNED_KEYWORDS,
} from '../game/defenses/input-filter.js';
import { LEVELS } from '../game/levels.js';
import { normalize } from '../game/normalize.js';

// PROP-4 — Property tests for the pure `applyInputFilter` defense module.
//
// **Validates: Requirements REQ-1 §2, Design §Testing strategy** — PROP-4
//
// The five properties below correspond exactly to task 13 in
// `.kiro/specs/sandbox-gandalf-mode/tasks.md`:
//   (a) totality — for any unicode message and any level (including
//       null / undefined / numeric `level`) the function never throws.
//   (b) output shape — `allowed` is always a boolean and
//       `sanitizedMessage` is always a string.
//   (c) for levels 1, 2, 5, 6 (defenseLayer ∉ {input, dual, all}) the
//       filter is a pass-through: `allowed === true` for every message.
//   (d) for levels 3, 4, 7 (defenseLayer ∈ {input, dual, all}) any
//       message that contains one of the BASE_BANNED_KEYWORDS as a
//       substring after normalization is blocked with
//       `reason === 'banned_keyword'`.
//   (e) idempotency — applying the filter to its own `sanitizedMessage`
//       under the same level reproduces the same decision.

const INPUT_FILTER_LAYERS = new Set(['input', 'dual', 'all']);

const NON_INPUT_FILTER_LEVELS = LEVELS.filter(
  (l) => !INPUT_FILTER_LAYERS.has(l.defenseLayer),
);
const INPUT_FILTER_LEVELS = LEVELS.filter((l) =>
  INPUT_FILTER_LAYERS.has(l.defenseLayer),
);

// Sanity-check the partition matches the requirement spec so a future
// re-ordering of LEVELS does not silently weaken this suite.
const nonFilterIndexes = NON_INPUT_FILTER_LEVELS.map((l) => l.index).sort();
const filterIndexes = INPUT_FILTER_LEVELS.map((l) => l.index).sort();
if (
  nonFilterIndexes.join(',') !== '1,2,5,6' ||
  filterIndexes.join(',') !== '3,4,7'
) {
  throw new Error(
    'PROP-4 partition mismatch: expected non-filter levels [1,2,5,6] and ' +
      `filter levels [3,4,7], got [${nonFilterIndexes}] and [${filterIndexes}].`,
  );
}

const levelArb = fc.constantFrom(...LEVELS);
const nonInputFilterArb = fc.constantFrom(...NON_INPUT_FILTER_LEVELS);
const inputFilterArb = fc.constantFrom(...INPUT_FILTER_LEVELS);
const bannedKeywordArb = fc.constantFrom(...BASE_BANNED_KEYWORDS);

describe('applyInputFilter (PROP-4)', () => {
  it('(a) never throws for any unicode message and any level', () => {
    fc.assert(
      fc.property(fc.string(), levelArb, (msg, lvl) => {
        applyInputFilter(msg, lvl);
        return true;
      }),
    );
  });

  it('(a.lenient) accepts null / undefined / numeric level without throwing', () => {
    // The contract in input-filter.js explicitly tolerates a missing or
    // falsy `level` and any object lacking `defenseLayer`. We exercise
    // the plausible non-object shapes a caller might pass during
    // development to lock that in.
    fc.assert(
      fc.property(fc.string(), (msg) => {
        applyInputFilter(msg, null);
        applyInputFilter(msg, undefined);
        applyInputFilter(msg, 0); // falsy short-circuit
        applyInputFilter(msg, 5); // truthy non-object, exercises the
                                  // `INPUT_FILTER_LAYERS.has(undefined)`
                                  // branch.
        return true;
      }),
    );
  });

  it('(b) `allowed` is always a boolean and `sanitizedMessage` is always a string', () => {
    fc.assert(
      fc.property(fc.string(), levelArb, (msg, lvl) => {
        const result = applyInputFilter(msg, lvl);
        return (
          typeof result.allowed === 'boolean' &&
          typeof result.sanitizedMessage === 'string'
        );
      }),
    );
  });

  it('(c) levels 1, 2, 5, 6 always allow the message', () => {
    fc.assert(
      fc.property(fc.string(), nonInputFilterArb, (msg, lvl) => {
        return applyInputFilter(msg, lvl).allowed === true;
      }),
    );
  });

  it('(d) levels 3, 4, 7 block any message containing a banned keyword', () => {
    fc.assert(
      fc.property(
        fc.string(),
        bannedKeywordArb,
        fc.string(),
        inputFilterArb,
        (prefix, banned, suffix, lvl) => {
          const text = prefix + banned + suffix;
          // The construction is supposed to preserve the banned keyword
          // as a substring of the normalized text, but because `prefix`
          // and `suffix` can contain combining marks or other characters
          // that interact with NFKD decomposition, we guard with a
          // precondition rather than trust it blindly.
          fc.pre(normalize(text).includes(banned));
          const result = applyInputFilter(text, lvl);
          return (
            result.allowed === false && result.reason === 'banned_keyword'
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('(e) is idempotent: filtering the sanitizedMessage reproduces the same decision', () => {
    fc.assert(
      fc.property(fc.string(), levelArb, (msg, lvl) => {
        const a = applyInputFilter(msg, lvl);
        const b = applyInputFilter(a.sanitizedMessage, lvl);
        return (
          a.allowed === b.allowed &&
          a.reason === b.reason &&
          a.sanitizedMessage === b.sanitizedMessage
        );
      }),
    );
  });
});
