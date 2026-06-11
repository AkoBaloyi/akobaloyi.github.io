import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { checkWin, userEmittedSecret } from '../game/win-condition.js';
import { normalize } from '../game/normalize.js';

// PROP-3 — Property tests for the pure `checkWin` and `userEmittedSecret`
// helpers in `win-condition.js`.
//
// **Validates: Requirements REQ-1 §§4, 8** — PROP-3
//
// The five properties below correspond exactly to task 11 in
// `.kiro/specs/sandbox-gandalf-mode/tasks.md`:
//   (a) for any non-empty `secret` matching /^[a-z0-9 -]+$/i and any
//       arbitrary `prefix`/`suffix`, `checkWin(prefix + secret + suffix,
//       secret)` is true.
//   (b) for any string that does not contain the secret as a substring
//       after normalization, `checkWin` returns false.
//   (c) `checkWin` is case-insensitive after normalize.
//   (d) `userEmittedSecret` follows the same rules as (a) and (b).
//   (e) REQ-1 §8 — user emits the secret but the model does not — yields
//       `userEmittedSecret = true` and `checkWin = false`.

// Secret generator: non-empty strings drawn from /^[a-z0-9 -]+$/i, capped
// at 20 characters so the search space stays small enough for the negative
// properties' precondition filters to pass at acceptable rates.
const SECRET_CHAR = fc.constantFrom(
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '-', ' '
);
const secretArb = fc.stringOf(SECRET_CHAR, { minLength: 1, maxLength: 20 });

describe('checkWin / userEmittedSecret (PROP-3)', () => {
  it('(a) checkWin is true when the response contains the secret with arbitrary prefix and suffix', () => {
    fc.assert(
      fc.property(secretArb, fc.string(), fc.string(), (secret, prefix, suffix) => {
        // Skip secrets whose normalized form is empty (e.g., all spaces).
        // Such inputs are explicitly disallowed by the win-condition contract
        // and would mask configuration bugs, per win-condition.js.
        fc.pre(normalize(secret) !== '');
        const response = prefix + secret + suffix;
        return checkWin(response, secret) === true;
      })
    );
  });

  it('(b) checkWin is false when the normalized response does not contain the normalized secret', () => {
    fc.assert(
      fc.property(secretArb, fc.string(), (secret, candidate) => {
        fc.pre(normalize(secret) !== '');
        fc.pre(!normalize(candidate).includes(normalize(secret)));
        return checkWin(candidate, secret) === false;
      }),
      // Bump runs because the precondition filter on (b) rejects more
      // aggressively than on the positive properties.
      { numRuns: 300 }
    );
  });

  it('(c) checkWin is case-insensitive after normalize', () => {
    fc.assert(
      fc.property(secretArb, fc.string(), fc.string(), (secret, prefix, suffix) => {
        fc.pre(normalize(secret) !== '');
        const upper = prefix + secret.toUpperCase() + suffix;
        const lower = prefix + secret.toLowerCase() + suffix;
        return checkWin(upper, secret) === true && checkWin(lower, secret) === true;
      })
    );
  });

  it('(d.positive) userEmittedSecret is true when the user message contains the secret', () => {
    fc.assert(
      fc.property(secretArb, fc.string(), fc.string(), (secret, prefix, suffix) => {
        fc.pre(normalize(secret) !== '');
        const message = prefix + secret + suffix;
        return userEmittedSecret(message, secret) === true;
      })
    );
  });

  it('(d.negative) userEmittedSecret is false when the normalized message does not contain the normalized secret', () => {
    fc.assert(
      fc.property(secretArb, fc.string(), (secret, candidate) => {
        fc.pre(normalize(secret) !== '');
        fc.pre(!normalize(candidate).includes(normalize(secret)));
        return userEmittedSecret(candidate, secret) === false;
      }),
      { numRuns: 300 }
    );
  });

  it('(e) REQ-1 §8 — user emits the secret but the model does not: userEmittedSecret=true and checkWin=false', () => {
    fc.assert(
      fc.property(
        secretArb,
        fc.string(),
        fc.string(),
        fc.string(),
        (secret, userPrefix, userSuffix, modelReply) => {
          fc.pre(normalize(secret) !== '');
          // Model reply is only acceptable for this property when its
          // normalized form does not contain the normalized secret —
          // mirrors the structure of property (b) and lets us exercise the
          // exact REQ-1 §8 case without crafting a brittle strip helper.
          fc.pre(!normalize(modelReply).includes(normalize(secret)));

          const userMessage = userPrefix + secret + userSuffix;
          return (
            userEmittedSecret(userMessage, secret) === true &&
            checkWin(modelReply, secret) === false
          );
        }
      ),
      { numRuns: 300 }
    );
  });
});
