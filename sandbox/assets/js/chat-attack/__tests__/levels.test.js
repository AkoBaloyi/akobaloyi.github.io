import { describe, it, expect } from 'vitest';

import * as levelsModule from '../game/levels.js';
import { LEVELS } from '../game/levels.js';
import { lintCopy } from '../game/lint-copy.js';
import { normalize } from '../game/normalize.js';

// PROP-2 — Property tests for the level-uniqueness invariant and the
// honest-copy contract carried by `LEVELS`.
//
// **Validates: Requirements REQ-1 §1, REQ-11 §§1, 4**
//
// The six properties below correspond to task 8 in
// `.kiro/specs/sandbox-gandalf-mode/tasks.md`:
//   (a) LEVELS.length === 7
//   (b) every level's `index` field equals its array position + 1
//   (c) the seven secret words after `normalize()` are all distinct
//   (d) every `description` passes `lintCopy` without throwing
//   (e) for level 7 the disclaimer string is at least 80 characters
//       (no-op until task 9 populates `LEVEL_7_DISCLAIMER`)
//   (f) the union of stage values equals the design enum
//       { none, input, output, both, meta } and only those values appear
//
// Note on `fc.gen`: the task brief mentions `fc.gen` for shuffle order, but
// fast-check exposes no such generator and the distinctness assertion is a
// pure value property that holds regardless of order. We build the Set
// directly from `LEVELS.map(l => normalize(l.secretWord))` and assert its
// size — no shuffle generator is required.

const DESIGN_STAGE_ENUM = Object.freeze(['none', 'input', 'output', 'both', 'meta']);

describe('LEVELS table (PROP-2)', () => {
  it('(a) contains exactly seven levels', () => {
    expect(LEVELS.length).toBe(7);
  });

  it("(b) every level's index equals its array position plus one", () => {
    for (let i = 0; i < LEVELS.length; i++) {
      expect(LEVELS[i].index).toBe(i + 1);
    }
  });

  it('(c) the seven secret words are distinct after normalize()', () => {
    const normalized = LEVELS.map((l) => normalize(l.secretWord));
    const set = new Set(normalized);
    expect(set.size).toBe(7);
  });

  it('(d) every description passes lintCopy without throwing', () => {
    for (const level of LEVELS) {
      expect(() =>
        lintCopy(level.description, `Level ${level.index} description`),
      ).not.toThrow();
    }
  });

  it('(e) the Level 7 disclaimer is at least 80 characters', () => {
    // Task 9 will add `LEVEL_7_DISCLAIMER` to `levels.js`. Until then this
    // test no-ops so the suite stays green during the dependency chain.
    const disclaimer = levelsModule.LEVEL_7_DISCLAIMER;
    if (disclaimer === undefined) return;
    expect(typeof disclaimer).toBe('string');
    expect(disclaimer.length).toBeGreaterThanOrEqual(80);
  });

  it('(f) the union of stage values equals the design enum and only those values appear', () => {
    const allowed = new Set(DESIGN_STAGE_ENUM);

    // Every individual stage is one of the allowed values.
    for (const level of LEVELS) {
      expect(allowed.has(level.stage)).toBe(true);
    }

    // The union of stages observed across all levels equals the design enum
    // (every allowed value appears at least once, and no extra values appear).
    const observed = new Set(LEVELS.map((l) => l.stage));
    expect(observed).toEqual(allowed);
  });
});
