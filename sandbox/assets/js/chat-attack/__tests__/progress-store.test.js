import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';

import {
  createProgressStore,
  createEmptyRecord,
  validateRecord,
  STORAGE_KEY,
  LEVEL_COUNT,
  MAX_ATTEMPTS,
  MAX_TIME_SECONDS,
  SCHEMA_VERSION,
} from '../game/progress-store.js';

// Property + unit tests for the persistent progress store.
//
// **Validates: Requirements REQ-3 §§5, 6, 9, 10, REQ-12 §§1-5** — PROP-6, PROP-7
//
// Five clusters from task 18 in `.kiro/specs/sandbox-gandalf-mode/tasks.md`:
//   (a) PROP-6 round-trip — `load()` after `save(rec)` deeply equals `rec` for any
//       valid in-memory record (REQ-12 §1).
//   (b) PROP-7 validation rejection — for any invalid record (bad schemaVersion,
//       wrong levels length, out-of-range attempts, etc.) `load()` returns the
//       fresh empty record and the warn log fires exactly once (REQ-3 §§5, 6).
//   (c) Monotonicity — two consecutive `markCleared` calls for the same level
//       keep the FIRST call's values; the cleared bit never flips back (REQ-3 §10).
//   (d) Write-failure path — when `setItem` throws, the in-memory mirror is
//       preserved and one warn fires (REQ-3 §9, REQ-12 §5).
//   (e) Reset clears the storage key and returns the fresh empty record (REQ-3 §7).

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a fresh in-memory storage stub matching the `Storage` shape used by
 * the progress store. Backed by a `Map` so semantics mirror `localStorage`
 * (string keys, string values, missing keys return `null`).
 *
 * Exposes a `_throwOnSet` toggle for the write-failure path (d) so tests can
 * simulate quota or `SecurityError` failures without touching real storage.
 *
 * @returns {{
 *   getItem: (key: string) => string | null,
 *   setItem: (key: string, value: string) => void,
 *   removeItem: (key: string) => void,
 *   _store: Map<string, string>,
 *   _throwOnSet: boolean,
 *   _throwOnRemove: boolean
 * }}
 */
function createMemoryStorage() {
  const store = new Map();
  return {
    _store: store,
    _throwOnSet: false,
    _throwOnRemove: false,
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      if (this._throwOnSet) {
        throw new Error('QuotaExceededError');
      }
      store.set(key, String(value));
    },
    removeItem(key) {
      if (this._throwOnRemove) {
        throw new Error('SecurityError');
      }
      store.delete(key);
    },
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

// A small set of plausible ISO 8601 timestamps. The validator only requires a
// non-empty string, so the exact format does not matter for round-trip — but
// using realistic values keeps counterexamples readable on failure.
const isoTimestampArb = fc.constantFrom(
  '2024-05-12T14:32:11Z',
  '2025-12-31T23:59:59-05:00',
  '2023-06-01T12:00:00+02:00',
  '2024-01-01T00:00:00Z',
);

const levelArb = fc.record({
  cleared: fc.boolean(),
  attempts: fc.integer({ min: 0, max: MAX_ATTEMPTS }),
  timeToClearSeconds: fc.option(
    fc.integer({ min: 0, max: MAX_TIME_SECONDS }),
    { nil: null },
  ),
  firstClearAt: fc.option(isoTimestampArb, { nil: null }),
});

// Bounded so the serialized JSON stays well under 100 KB (each level is a
// handful of numbers and a short string; 7 levels totals a few hundred bytes).
const recordArb = fc.record({
  schemaVersion: fc.constant(SCHEMA_VERSION),
  levels: fc.array(levelArb, { minLength: LEVEL_COUNT, maxLength: LEVEL_COUNT }),
});

// Mutate a base valid record into one of nine invalid shapes covered by the
// validation gauntlet. Every branch produces a record that `validateRecord`
// returns false for, so `load()` must replace it with a fresh empty record
// and warn exactly once.
const invalidRecordArb = fc.oneof(
  // 1. missing schemaVersion entirely
  recordArb.map((rec) => ({ levels: rec.levels })),
  // 2. wrong schemaVersion (numeric)
  recordArb.chain((rec) =>
    fc.constantFrom(0, 2, 99, -1).map((v) => ({ ...rec, schemaVersion: v })),
  ),
  // 3. wrong schemaVersion (non-numeric type)
  recordArb.chain((rec) =>
    fc.constantFrom('one', null, true).map((v) => ({ ...rec, schemaVersion: v })),
  ),
  // 4. wrong levels length (0..6 — all under the required 7)
  recordArb.chain((rec) =>
    fc.integer({ min: 0, max: 6 }).map((n) => ({
      ...rec,
      levels: rec.levels.slice(0, n),
    })),
  ),
  // 5. levels is not an array
  recordArb.map((rec) => ({ ...rec, levels: { 0: rec.levels[0] } })),
  // 6. non-boolean cleared on a randomly chosen level
  recordArb.chain((rec) =>
    fc
      .tuple(
        fc.integer({ min: 0, max: LEVEL_COUNT - 1 }),
        fc.constantFrom(0, 1, 'true', null, undefined),
      )
      .map(([idx, val]) => {
        const levels = rec.levels.map((l, i) =>
          i === idx ? { ...l, cleared: val } : l,
        );
        return { ...rec, levels };
      }),
  ),
  // 7. attempts out of range or non-integer
  recordArb.chain((rec) =>
    fc
      .tuple(
        fc.integer({ min: 0, max: LEVEL_COUNT - 1 }),
        fc.constantFrom(-1, 10000, 99999, 1.5, 'big', null),
      )
      .map(([idx, val]) => {
        const levels = rec.levels.map((l, i) =>
          i === idx ? { ...l, attempts: val } : l,
        );
        return { ...rec, levels };
      }),
  ),
  // 8. timeToClearSeconds out of range or wrong type
  recordArb.chain((rec) =>
    fc
      .tuple(
        fc.integer({ min: 0, max: LEVEL_COUNT - 1 }),
        fc.constantFrom('foo', 86401, -1, 1.5, true),
      )
      .map(([idx, val]) => {
        const levels = rec.levels.map((l, i) =>
          i === idx ? { ...l, timeToClearSeconds: val } : l,
        );
        return { ...rec, levels };
      }),
  ),
  // 9. firstClearAt empty string or wrong type
  recordArb.chain((rec) =>
    fc
      .tuple(
        fc.integer({ min: 0, max: LEVEL_COUNT - 1 }),
        fc.constantFrom('', 0, 42, true, {}),
      )
      .map(([idx, val]) => {
        const levels = rec.levels.map((l, i) =>
          i === idx ? { ...l, firstClearAt: val } : l,
        );
        return { ...rec, levels };
      }),
  ),
);

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe('progress-store sanity', () => {
  it('createEmptyRecord produces a record that itself validates', () => {
    const rec = createEmptyRecord();
    expect(rec.schemaVersion).toBe(SCHEMA_VERSION);
    expect(rec.levels).toHaveLength(LEVEL_COUNT);
    expect(validateRecord(rec)).toBe(true);
    for (const entry of rec.levels) {
      expect(entry).toEqual({
        cleared: false,
        attempts: 0,
        timeToClearSeconds: null,
        firstClearAt: null,
      });
    }
  });
});

describe('progress-store round-trip (PROP-6, REQ-12 §1)', () => {
  it('(a) load() after save(rec) deeply equals rec for any valid record', () => {
    fc.assert(
      fc.property(recordArb, (rec) => {
        const storage = createMemoryStorage();
        const store = createProgressStore({ storage });
        store.save(rec);
        const loaded = store.load();
        expect(loaded).toEqual(rec);
      }),
      { numRuns: 100 },
    );
  });

  it('serialized records stay well under the 100 KB cap', () => {
    fc.assert(
      fc.property(recordArb, (rec) => {
        const size = JSON.stringify(rec).length;
        return size <= 100 * 1024;
      }),
    );
  });
});

describe('progress-store validation gauntlet (PROP-7, REQ-3 §§5, 6)', () => {
  /** @type {ReturnType<typeof vi.spyOn> | undefined} */
  let warnSpy;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy?.mockRestore();
  });

  it('(b) load() returns a fresh empty record and warns exactly once for any invalid record', () => {
    fc.assert(
      fc.property(invalidRecordArb, (invalid) => {
        // Pre-condition: invalid records must actually fail validation.
        // If `validateRecord` accidentally accepts one, the property is
        // meaningless for that input, so skip via fc.pre.
        fc.pre(validateRecord(invalid) === false);

        const storage = createMemoryStorage();
        storage.setItem(STORAGE_KEY, JSON.stringify(invalid));
        warnSpy.mockClear();

        const store = createProgressStore({ storage });
        const result = store.load();

        expect(result).toEqual(createEmptyRecord());
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toMatch(/progress data corrupted/);
      }),
      { numRuns: 100 },
    );
  });

  it('load() also rejects raw payloads that are not valid JSON', () => {
    const storage = createMemoryStorage();
    storage.setItem(STORAGE_KEY, 'not json {');
    warnSpy.mockClear();

    const store = createProgressStore({ storage });
    const result = store.load();

    expect(result).toEqual(createEmptyRecord());
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/progress data corrupted/);
  });

  it('load() returns a fresh empty record without warning when the key is missing', () => {
    const storage = createMemoryStorage();
    warnSpy.mockClear();

    const store = createProgressStore({ storage });
    const result = store.load();

    expect(result).toEqual(createEmptyRecord());
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('progress-store monotonicity (REQ-3 §10)', () => {
  it('(c) two markCleared calls for the same level keep the first call values', () => {
    const storage = createMemoryStorage();
    const store = createProgressStore({ storage });
    store.load();

    const first = store.markCleared(3, 5, 120, '2024-01-01T00:00:00Z');
    expect(first.levels[2]).toEqual({
      cleared: true,
      attempts: 5,
      timeToClearSeconds: 120,
      firstClearAt: '2024-01-01T00:00:00Z',
    });

    // Second call for the same level with different metrics must be a no-op
    // because monotonicity forbids overwriting an already-cleared entry.
    const second = store.markCleared(3, 99, 7, '2099-12-31T23:59:59Z');
    expect(second.levels[2]).toEqual({
      cleared: true,
      attempts: 5,
      timeToClearSeconds: 120,
      firstClearAt: '2024-01-01T00:00:00Z',
    });

    // Reload from storage to confirm the persisted record matches.
    const reloaded = store.load();
    expect(reloaded.levels[2]).toEqual({
      cleared: true,
      attempts: 5,
      timeToClearSeconds: 120,
      firstClearAt: '2024-01-01T00:00:00Z',
    });
  });

  it('the cleared bit never flips back to false through markCleared', () => {
    const storage = createMemoryStorage();
    const store = createProgressStore({ storage });
    store.load();
    store.markCleared(1, 1, 1, '2024-01-01T00:00:00Z');

    // Even with a wildly different second call, level 1 stays cleared.
    store.markCleared(1, 0, 0, '');
    expect(store.load().levels[0].cleared).toBe(true);
  });
});

describe('progress-store write-failure path (REQ-3 §9, REQ-12 §5)', () => {
  /** @type {ReturnType<typeof vi.spyOn> | undefined} */
  let warnSpy;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy?.mockRestore();
  });

  it('(d) preserves the in-memory state and warns exactly once when setItem throws', () => {
    const storage = createMemoryStorage();
    storage._throwOnSet = true;

    const store = createProgressStore({ storage });
    store.load();
    warnSpy.mockClear();

    store.markCleared(1, 1, 1, '2024-01-01T00:00:00Z');

    // The in-memory mirror reflects the cleared transition even though
    // setItem refused the write, so the gameplay loop continues unchanged
    // for the rest of the session.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/progress persistence failed/);

    // A second markCleared for a different level must NOT trigger another
    // warning — the latch is one-shot per store lifetime.
    store.markCleared(2, 2, 2, '2024-01-02T00:00:00Z');
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // Storage was never written to (both setItem calls threw).
    expect(storage._store.has(STORAGE_KEY)).toBe(false);
  });
});

describe('progress-store reset (REQ-3 §7)', () => {
  it('(e) clears the storage key and returns the fresh empty record', () => {
    const storage = createMemoryStorage();
    const seeded = createEmptyRecord();
    seeded.levels[0].cleared = true;
    seeded.levels[0].attempts = 12;
    seeded.levels[0].timeToClearSeconds = 480;
    seeded.levels[0].firstClearAt = '2024-05-12T14:32:11Z';
    storage.setItem(STORAGE_KEY, JSON.stringify(seeded));

    const store = createProgressStore({ storage });

    // Sanity check: load() returns the populated record before reset.
    const beforeReset = store.load();
    expect(beforeReset.levels[0].cleared).toBe(true);
    expect(beforeReset.levels[0].attempts).toBe(12);

    const after = store.reset();

    expect(after).toEqual(createEmptyRecord());
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage._store.has(STORAGE_KEY)).toBe(false);

    // A subsequent load() (with no key present) returns a fresh empty
    // record without warning — confirming reset wiped the persisted state.
    const reloaded = store.load();
    expect(reloaded).toEqual(createEmptyRecord());
  });
});
