import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { normalize } from '../game/normalize.js';

// PROP-1 — Property tests for the pure `normalize` helper.
//
// **Validates: Requirements REQ-1 §1, Design §Normalization**
//
// The four properties below correspond exactly to task 5 in
// `.kiro/specs/sandbox-gandalf-mode/tasks.md`:
//   (a) idempotency
//   (b) no leading or trailing whitespace
//   (c) output charset restricted to Unicode letters, digits, single spaces, hyphens
//   (d) alphanumeric-only inputs survive intact apart from case folding

describe('normalize (PROP-1)', () => {
  it('(a) is idempotent over arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const once = normalize(s);
        return normalize(once) === once;
      })
    );
  });

  it('(b) output never starts or ends with whitespace', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const out = normalize(s);
        return out === '' || (!/^\s/.test(out) && !/\s$/.test(out));
      })
    );
  });

  it('(c) output contains only letters, digits, single spaces, and hyphens', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const out = normalize(s);
        return /^[\p{L}\p{N} -]*$/u.test(out);
      })
    );
  });

  it('(d) alphanumeric-only inputs pass through with only the casing change', () => {
    const alnumChar = fc.constantFrom(
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
      'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
    );

    fc.assert(
      fc.property(
        fc.stringOf(alnumChar, { minLength: 1, maxLength: 50 }),
        (s) => normalize(s) === s.toLowerCase()
      )
    );
  });
});
