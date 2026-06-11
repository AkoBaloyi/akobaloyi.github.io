/**
 * PROP-8 — property + unit tests for leaderboard handle sanitization.
 *
 * Module under test: ../src/leaderboard/sanitize.js
 *   - sanitizeHandle(raw): lowercase, strip outside [a-z0-9_-], truncate to 16.
 *   - isHandleRejected(sanitized, blocklist?): substring + de-leeted match.
 *   - PROFANITY_BLOCKLIST: frozen array of 30 lowercase tokens.
 *
 * Validates: Requirements REQ-5 §§5, 6, 7
 *
 * The sanitizer is pure JS with no worker-runtime dependencies, so fast-check
 * runs fine inside the @cloudflare/vitest-pool-workers (workerd) harness.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  sanitizeHandle,
  isHandleRejected,
  PROFANITY_BLOCKLIST,
} from '../src/leaderboard/sanitize.js';

const NUM_RUNS = 1000;
const HANDLE_RE = /^[a-z0-9_-]{0,16}$/;

describe('PROP-8: sanitizeHandle properties', () => {
  it('(a) output always matches /^[a-z0-9_-]{0,16}$/ (charset + length)', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(HANDLE_RE.test(sanitizeHandle(s))).toBe(true);
      }),
      { numRuns: NUM_RUNS }
    );
    // Broader unicode coverage.
    fc.assert(
      fc.property(fc.fullUnicodeString(), (s) => {
        expect(HANDLE_RE.test(sanitizeHandle(s))).toBe(true);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('(b) is idempotent: sanitize(sanitize(x)) === sanitize(x)', () => {
    fc.assert(
      fc.property(fc.fullUnicodeString(), (s) => {
        const once = sanitizeHandle(s);
        expect(sanitizeHandle(once)).toBe(once);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('(c) length equals min(16, count of valid chars after lowercasing)', () => {
    fc.assert(
      fc.property(fc.fullUnicodeString(), (s) => {
        // Compute the valid count the SAME way the sanitizer does:
        // lowercase first, then strip everything outside [a-z0-9_-].
        const validCount = s.toLowerCase().replace(/[^a-z0-9_-]/g, '').length;
        expect(sanitizeHandle(s).length).toBe(Math.min(16, validCount));
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('(d) output never contains uppercase', () => {
    fc.assert(
      fc.property(fc.fullUnicodeString(), (s) => {
        const out = sanitizeHandle(s);
        expect(out).toBe(out.toLowerCase());
        expect(/[A-Z]/.test(out)).toBe(false);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

describe('isHandleRejected: leet-speak variants on blocklist words', () => {
  // De-leet map in the module: 0->o, 1->l, 3->e, 5->s, @->a.
  // Variants below are chosen so that sanitizeHandle keeps every char AND the
  // de-leeted form lands exactly on a blocklist token.
  const leetVariants = [
    { raw: '5hit', word: 'shit' }, // 5 -> s
    { raw: 'c0ck', word: 'cock' }, // 0 -> o
    { raw: '5lut', word: 'slut' }, // 5 -> s
    { raw: 'r3tard', word: 'retard' }, // 3 -> e
  ];

  it.each(leetVariants)(
    'rejects $raw (de-leets to "$word")',
    ({ raw, word }) => {
      const sanitized = sanitizeHandle(raw);
      // Sanity: the variant survives sanitization unchanged (all valid chars).
      expect(sanitized).toBe(raw.toLowerCase());
      expect(PROFANITY_BLOCKLIST).toContain(word);
      expect(isHandleRejected(sanitized)).toBe(true);
    }
  );

  it('rejects a plain blocklist word with no leet substitution', () => {
    expect(isHandleRejected(sanitizeHandle('cum'))).toBe(true);
  });

  it('rejects a blocklist word embedded in a longer handle', () => {
    expect(isHandleRejected(sanitizeHandle('xx5hitxx'))).toBe(true);
  });

  it('accepts a clean handle', () => {
    expect(isHandleRejected(sanitizeHandle('coolplayer'))).toBe(false);
  });

  it('returns false for empty / non-string input', () => {
    expect(isHandleRejected('')).toBe(false);
    expect(isHandleRejected(undefined)).toBe(false);
  });
});
