import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  BANNED_SUPERLATIVES,
  FORBIDDEN_PUNCT,
  lintCopy,
  runDevLintIfDev,
} from '../game/lint-copy.js';

// Unit tests for the honest-copy linter.
//
// **Validates: Requirements REQ-11 §§1, 2, 3, 5**
//
// Covers the contract spelled out in task 7 of
// `.kiro/specs/sandbox-gandalf-mode/tasks.md`:
//   - short text rejected (length < 40)
//   - long text rejected (length > 280)
//   - each banned superlative rejected case-insensitively
//   - em dash rejected
//   - en dash rejected
//   - valid text accepted
//   - runDevLintIfDev warns on dev hosts and is a no-op in production

// A baseline string with exactly 40 plain ASCII letters and a space, well
// inside the [40, 280] range, no banned superlatives, no em or en dash.
const VALID_COPY =
  'A clear and honest description of the level.';

describe('lintCopy length checks (REQ-11 §1)', () => {
  it('rejects text shorter than 40 characters', () => {
    const tooShort = 'short';
    expect(tooShort.length).toBeLessThan(40);
    expect(() => lintCopy(tooShort, 'Test')).toThrow(/length .* out of range/);
  });

  it('rejects text exactly at length 39', () => {
    const text = 'a'.repeat(39);
    expect(() => lintCopy(text, 'Test')).toThrow(/out of range \[40, 280\]/);
  });

  it('accepts text exactly at length 40 (lower bound inclusive)', () => {
    const text = 'a'.repeat(40);
    expect(() => lintCopy(text, 'Test')).not.toThrow();
  });

  it('accepts text exactly at length 280 (upper bound inclusive)', () => {
    const text = 'a'.repeat(280);
    expect(() => lintCopy(text, 'Test')).not.toThrow();
  });

  it('rejects text longer than 280 characters', () => {
    const tooLong = 'a'.repeat(281);
    expect(() => lintCopy(tooLong, 'Test')).toThrow(/length .* out of range/);
  });
});

describe('lintCopy banned superlatives (REQ-11 §2)', () => {
  it('exposes exactly the nine banned superlatives in lowercase form', () => {
    expect([...BANNED_SUPERLATIVES]).toEqual([
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
  });

  // One assertion per word so a regression in any single entry is obvious.
  for (const word of [
    'unbreakable',
    'bulletproof',
    'best-in-class',
    'industry-leading',
    'world-class',
    'state-of-the-art',
    'cutting-edge',
    'impenetrable',
    'uncrackable',
  ]) {
    it(`rejects copy containing "${word}" (lowercase)`, () => {
      const padding = 'x'.repeat(60);
      const text = `${padding} ${word} ${padding}`;
      expect(() => lintCopy(text, 'Test')).toThrow(
        new RegExp(`banned superlative "${word.replace(/[-]/g, '\\-')}"`),
      );
    });
  }

  it('rejects banned superlatives case-insensitively (mixed case)', () => {
    const padding = 'x'.repeat(60);
    const text = `${padding} UnBrEaKaBlE ${padding}`;
    expect(() => lintCopy(text, 'Test')).toThrow(
      /banned superlative "unbreakable"/,
    );
  });

  it('rejects banned superlatives in ALL CAPS', () => {
    const padding = 'x'.repeat(60);
    const text = `${padding} STATE-OF-THE-ART ${padding}`;
    expect(() => lintCopy(text, 'Test')).toThrow(
      /banned superlative "state-of-the-art"/,
    );
  });
});

describe('lintCopy forbidden punctuation (REQ-11 §3)', () => {
  it('exposes the FORBIDDEN_PUNCT regex matching em and en dashes', () => {
    expect(FORBIDDEN_PUNCT.test('\u2014')).toBe(true);
    expect(FORBIDDEN_PUNCT.test('\u2013')).toBe(true);
    expect(FORBIDDEN_PUNCT.test('-')).toBe(false);
  });

  it('rejects copy containing an em dash (U+2014)', () => {
    const padding = 'word '.repeat(10);
    const text = `${padding}\u2014 a clarifying clause ${padding}`;
    expect(() => lintCopy(text, 'Test')).toThrow(/em dash .* or en dash/);
  });

  it('rejects copy containing an en dash (U+2013)', () => {
    const padding = 'word '.repeat(10);
    const text = `${padding}\u2013 a clarifying clause ${padding}`;
    expect(() => lintCopy(text, 'Test')).toThrow(/em dash .* or en dash/);
  });

  it('accepts copy with a regular ASCII hyphen-minus (U+002D)', () => {
    const text = `${'word '.repeat(8)}- a clarifying clause that is long enough.`;
    expect(text.length).toBeGreaterThanOrEqual(40);
    expect(() => lintCopy(text, 'Test')).not.toThrow();
  });
});

describe('lintCopy valid copy (positive case)', () => {
  it('accepts a typical level description', () => {
    expect(VALID_COPY.length).toBeGreaterThanOrEqual(40);
    expect(VALID_COPY.length).toBeLessThanOrEqual(280);
    expect(() => lintCopy(VALID_COPY, 'Level 1 description')).not.toThrow();
  });

  it('includes the label in the thrown error message', () => {
    expect(() => lintCopy('too short', 'Level 1 description')).toThrow(
      /Level 1 description/,
    );
  });
});

describe('runDevLintIfDev (REQ-11 §5)', () => {
  /** @type {PropertyDescriptor | undefined} */
  let originalLocationDescriptor;
  /** @type {ReturnType<typeof vi.spyOn> | undefined} */
  let warnSpy;

  beforeEach(() => {
    originalLocationDescriptor = Object.getOwnPropertyDescriptor(
      window,
      'location',
    );
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalLocationDescriptor) {
      Object.defineProperty(window, 'location', originalLocationDescriptor);
    }
    warnSpy?.mockRestore();
  });

  /**
   * @param {string} hostname
   */
  function setHostname(hostname) {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname },
    });
  }

  it('warns once per failing item on a localhost dev host', () => {
    setHostname('localhost');
    runDevLintIfDev([
      { text: 'too short', label: 'A' },
      { text: VALID_COPY, label: 'B' },
    ]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/A:.*length.*out of range/);
  });

  it('warns on a 127.0.0.1 dev host', () => {
    setHostname('127.0.0.1');
    runDevLintIfDev([{ text: 'too short', label: 'A' }]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('warns on any *.local host', () => {
    setHostname('mybox.local');
    runDevLintIfDev([{ text: 'too short', label: 'A' }]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('is a no-op in production (non-dev hostname)', () => {
    setHostname('akobaloyi.github.io');
    runDevLintIfDev([
      { text: 'too short', label: 'A' },
      { text: 'a'.repeat(500), label: 'B' },
      { text: `${'x '.repeat(30)}\u2014`, label: 'C' },
    ]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn on dev hosts when every item passes lintCopy', () => {
    setHostname('localhost');
    runDevLintIfDev([
      { text: VALID_COPY, label: 'A' },
      { text: VALID_COPY, label: 'B' },
    ]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('never throws, even when items violate multiple rules', () => {
    setHostname('localhost');
    expect(() =>
      runDevLintIfDev([
        { text: 'short', label: 'A' },
        { text: `${'x '.repeat(30)}unbreakable`, label: 'B' },
        { text: `${'x '.repeat(30)}\u2013`, label: 'C' },
      ]),
    ).not.toThrow();
    expect(warnSpy).toHaveBeenCalledTimes(3);
  });

  it('tolerates a missing or non-array items argument', () => {
    setHostname('localhost');
    expect(() => runDevLintIfDev(undefined)).not.toThrow();
    expect(() => runDevLintIfDev(null)).not.toThrow();
    expect(() => runDevLintIfDev('not an array')).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
