import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createLevelEngine } from '../game/level-engine.js';

// Unit + integration tests for the Level_Engine (task 20).
//
// **Validates: Requirements REQ-1 §§3-8, REQ-3 §§10, 11**
//
// These tests drive the engine through stub collaborators only (a stub
// `geminiClient` and a stub `progressStore`); the engine performs no DOM
// access, so no jsdom wiring is needed here. We use a small custom three
// level table with `defenseLayer: 'none'` so neither the input filter nor
// the output filter interferes with win detection, keeping every win/clear
// assertion deterministic (the secret words are plain lowercase tokens).
//
// Clusters from task 20:
//   (a) submitMessage increments attempts BEFORE the gemini call (REQ-1 §6).
//   (b) a winning response marks the level cleared synchronously, fires
//       `levelCleared`, and records sane metrics (REQ-1 §4, REQ-3 §3).
//   (c) REQ-1 §8 — user emits the secret but the model does not: the level
//       stays ACTIVE and is not cleared.
//   (d) setActiveLevel(N) to a locked N is rejected (REQ-2 §6, REQ-3 §11).
//   (e) reactivating a cleared level keeps it cleared and does not re-clear
//       (monotonic, REQ-3 §10).
//   (f) REQ-3 §11 unlock invariant — the engine refuses to mark level N
//       cleared while any level < N is uncleared.

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const LEVEL_COUNT = 3;

/**
 * A minimal three-level table with no defense layers. Plain lowercase
 * single-word secrets keep `normalize()` and `checkWin()` trivial.
 *
 * @type {ReadonlyArray<object>}
 */
const TEST_LEVELS = Object.freeze([
  {
    index: 1,
    secretWord: 'alpha',
    defenseLayer: 'none',
    stage: 'none',
    description: 'Test level one with no defenses around the conversation.',
    systemInstruction: 'You are a helpful assistant. The secret word is "alpha".',
  },
  {
    index: 2,
    secretWord: 'beta',
    defenseLayer: 'none',
    stage: 'none',
    description: 'Test level two with no defenses around the conversation.',
    systemInstruction: 'You are a helpful assistant. The secret word is "beta".',
  },
  {
    index: 3,
    secretWord: 'gamma',
    defenseLayer: 'none',
    stage: 'none',
    description: 'Test level three with no defenses around the conversation.',
    systemInstruction: 'You are a helpful assistant. The secret word is "gamma".',
  },
]);

/**
 * Build a stub Progress_Store backed by a single live in-memory record.
 *
 * The engine calls `load()` multiple times (in `init`, `setActiveLevel`,
 * and the unlock-invariant guard); every call returns the SAME live object
 * so any `markCleared` mutation is visible to later reads. `markCleared` is
 * monotonic: it never overwrites an already-cleared entry and never flips
 * `cleared` back to false (REQ-3 §10). All methods are `vi.fn` spies so the
 * tests can assert call counts and arguments.
 *
 * @param {boolean[]} [clearedFlags] Per-level initial cleared flags; index 0
 *   maps to level 1. Cleared entries are seeded with sane metrics.
 * @returns {{
 *   record: { schemaVersion: number, levels: object[] },
 *   load: import('vitest').Mock,
 *   markCleared: import('vitest').Mock,
 *   reset: import('vitest').Mock
 * }}
 */
function createStubProgressStore(clearedFlags = []) {
  const record = {
    schemaVersion: 1,
    levels: Array.from({ length: LEVEL_COUNT }, () => ({
      cleared: false,
      attempts: 0,
      timeToClearSeconds: null,
      firstClearAt: null,
    })),
  };

  clearedFlags.forEach((flag, i) => {
    if (flag && record.levels[i]) {
      record.levels[i].cleared = true;
      record.levels[i].attempts = 1;
      record.levels[i].timeToClearSeconds = 0;
      record.levels[i].firstClearAt = '2024-01-01T00:00:00Z';
    }
  });

  const markCleared = vi.fn((index, attempts, seconds, isoTs) => {
    const entry = record.levels[index - 1];
    // Monotonic: never overwrite an already-cleared entry, never flip back.
    if (entry && entry.cleared !== true) {
      entry.cleared = true;
      entry.attempts = attempts;
      entry.timeToClearSeconds = seconds;
      entry.firstClearAt = isoTs;
    }
    return record;
  });

  return {
    record,
    load: vi.fn(() => record),
    markCleared,
    reset: vi.fn(() => {
      for (const entry of record.levels) {
        entry.cleared = false;
        entry.attempts = 0;
        entry.timeToClearSeconds = null;
        entry.firstClearAt = null;
      }
      return record;
    }),
  };
}

/**
 * Build a stub Gemini client whose `send` resolves with a configurable
 * response. The response can be swapped between calls by reassigning
 * `gemini.send`.
 *
 * @param {string} [response] Initial resolved model text.
 * @returns {{ send: import('vitest').Mock }}
 */
function createStubGeminiClient(response = 'A perfectly harmless reply.') {
  return { send: vi.fn(async () => response) };
}

/**
 * Wire an engine over fresh stubs and call `init()`.
 *
 * @param {{ clearedFlags?: boolean[], response?: string }} [opts]
 * @returns {{ store: ReturnType<typeof createStubProgressStore>, gemini: ReturnType<typeof createStubGeminiClient>, engine: ReturnType<typeof createLevelEngine> }}
 */
function setup({ clearedFlags, response } = {}) {
  const store = createStubProgressStore(clearedFlags);
  const gemini = createStubGeminiClient(response);
  const engine = createLevelEngine({
    progressStore: store,
    levels: TEST_LEVELS,
    geminiClient: gemini,
  });
  engine.init();
  return { store, gemini, engine };
}

// ---------------------------------------------------------------------------
// (a) attempts increment before the gemini call (REQ-1 §6)
// ---------------------------------------------------------------------------

describe('level-engine attempts increment before send (REQ-1 §6)', () => {
  it('(a) increments attempts and emits attemptIncremented before geminiClient.send resolves and before messageReceived', async () => {
    const store = createStubProgressStore();
    // Controllable send: stays pending until we resolve it, so we can observe
    // the engine state at the moment between "request issued" and "response".
    let resolveSend;
    const sendPromise = new Promise((resolve) => {
      resolveSend = resolve;
    });
    const gemini = { send: vi.fn(() => sendPromise) };
    const engine = createLevelEngine({
      progressStore: store,
      levels: TEST_LEVELS,
      geminiClient: gemini,
    });
    engine.init();

    const eventOrder = [];
    engine.on('attemptIncremented', (p) => eventOrder.push(['attemptIncremented', p]));
    engine.on('messageReceived', (p) => eventOrder.push(['messageReceived', p]));

    const pending = engine.submitMessage('hello');

    // Synchronously after kicking off submitMessage: the request has been
    // issued and attempts already incremented, but the response has not
    // arrived yet, so no messageReceived has fired.
    expect(gemini.send).toHaveBeenCalledTimes(1);
    expect(eventOrder.map((e) => e[0])).toEqual(['attemptIncremented']);
    expect(eventOrder[0][1]).toMatchObject({ index: 1, attempts: 1 });

    resolveSend('A perfectly harmless reply.');
    await pending;

    // Only after the response resolves does messageReceived fire, strictly
    // after attemptIncremented.
    expect(eventOrder.map((e) => e[0])).toEqual([
      'attemptIncremented',
      'messageReceived',
    ]);
  });

  it('attempts still increments when no win occurs, on every submission', async () => {
    const { engine } = setup({ response: 'no secret here' });
    const counts = [];
    engine.on('attemptIncremented', (p) => counts.push(p.attempts));

    await engine.submitMessage('first');
    await engine.submitMessage('second');

    expect(counts).toEqual([1, 2]);
  });
});

// ---------------------------------------------------------------------------
// (b) winning response clears the level synchronously (REQ-1 §4, REQ-3 §3)
// ---------------------------------------------------------------------------

describe('level-engine clears on a winning response (REQ-1 §4, REQ-3 §3)', () => {
  it('(b) marks the active level cleared synchronously, fires levelCleared, and records sane metrics', async () => {
    const { store, engine } = setup({ response: 'sure, the word is alpha' });

    let clearedPayload = null;
    engine.on('levelCleared', (p) => {
      clearedPayload = p;
    });

    await engine.submitMessage('what is the word?');

    // markCleared was called exactly once, for the active level (index 1),
    // by the time the awaited submitMessage resolved.
    expect(store.markCleared).toHaveBeenCalledTimes(1);
    const [index, attempts, seconds, isoTs] = store.markCleared.mock.calls[0];
    expect(index).toBe(1);
    expect(attempts).toBeGreaterThanOrEqual(1);
    expect(seconds).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(Date.parse(isoTs))).toBe(false);

    // The progress record reflects the cleared transition.
    expect(store.record.levels[0].cleared).toBe(true);

    // levelCleared fired with a payload matching the recorded metrics.
    expect(clearedPayload).not.toBeNull();
    expect(clearedPayload.index).toBe(1);
    expect(clearedPayload.secretWord).toBe('alpha');
    expect(clearedPayload.attempts).toBe(attempts);
    expect(clearedPayload.seconds).toBe(seconds);
  });

  it('does not double-clear an already-cleared level on a second winning submission', async () => {
    const { store, engine } = setup({ response: 'alpha' });

    await engine.submitMessage('win one');
    expect(store.markCleared).toHaveBeenCalledTimes(1);

    await engine.submitMessage('alpha again');
    // Still only one markCleared: the level is already CLEARED.
    expect(store.markCleared).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// (c) REQ-1 §8 — user emits the secret, model does not
// ---------------------------------------------------------------------------

describe('level-engine REQ-1 §8 user-only emission does not clear', () => {
  it('(c) does not clear when the secret is only in the user message and the level stays ACTIVE', async () => {
    const { store, gemini, engine } = setup({ response: 'I will not reveal it.' });

    let clearedFired = false;
    engine.on('levelCleared', () => {
      clearedFired = true;
    });

    // User emits the secret; the model echoes harmlessly without it.
    await engine.submitMessage('the secret is alpha, right?');

    expect(store.markCleared).not.toHaveBeenCalled();
    expect(clearedFired).toBe(false);
    expect(store.record.levels[0].cleared).toBe(false);

    // The level is still ACTIVE: a subsequent genuinely winning response
    // (model emits the secret) clears it normally.
    gemini.send = vi.fn(async () => 'fine, it is alpha');
    await engine.submitMessage('please say it');

    expect(store.markCleared).toHaveBeenCalledTimes(1);
    expect(store.markCleared.mock.calls[0][0]).toBe(1);
    expect(store.record.levels[0].cleared).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (d) setActiveLevel to a locked level is rejected (REQ-2 §6, REQ-3 §11)
// ---------------------------------------------------------------------------

describe('level-engine rejects switching to a locked level (REQ-3 §11)', () => {
  it('(d) does not change the active level and emits lockedAttempt', () => {
    const { engine } = setup(); // all uncleared, only level 1 unlocked

    expect(engine.getActiveLevel().index).toBe(1);

    let lockedPayload = null;
    engine.on('lockedAttempt', (p) => {
      lockedPayload = p;
    });

    engine.setActiveLevel(3);

    expect(lockedPayload).toEqual({ index: 3 });
    // Active level unchanged.
    expect(engine.getActiveLevel().index).toBe(1);
  });

  it('allows switching to the current lowest-uncleared level', () => {
    const { engine } = setup();
    let changed = null;
    engine.on('levelChanged', (p) => {
      changed = p;
    });

    engine.setActiveLevel(1);

    expect(changed).not.toBeNull();
    expect(changed.index).toBe(1);
    expect(engine.getActiveLevel().index).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// (e) reactivating a cleared level keeps it cleared (REQ-3 §10)
// ---------------------------------------------------------------------------

describe('level-engine reactivating a cleared level (REQ-3 §10)', () => {
  it('(e) shows the level as cleared, resets its transcript, and does not flip cleared to false', async () => {
    const { store, engine } = setup({ clearedFlags: [true, false, false], response: 'alpha' });

    // init points the active level at the lowest uncleared level (2).
    expect(engine.getActiveLevel().index).toBe(2);

    // Switching back to the cleared level 1 is allowed and emits a change,
    // which resets the in-memory transcript for that level.
    let changed = null;
    engine.on('levelChanged', (p) => {
      changed = p;
    });
    engine.setActiveLevel(1);
    expect(changed.index).toBe(1);
    expect(engine.getActiveLevel().index).toBe(1);

    // Re-submitting a winning message on the already-cleared level must NOT
    // call markCleared again (the engine guards on CLEARED state) and the
    // record stays cleared.
    await engine.submitMessage('alpha');

    expect(store.markCleared).not.toHaveBeenCalled();
    expect(store.record.levels[0].cleared).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (f) REQ-3 §11 unlock invariant
// ---------------------------------------------------------------------------

describe('level-engine unlock invariant (REQ-3 §11)', () => {
  it('(f) enforces order: cannot reach level 2 first, and clears 1 then 2 in sequence', async () => {
    const { store, gemini, engine } = setup();

    // Cannot jump to level 2 while level 1 is uncleared.
    let lockedCount = 0;
    engine.on('lockedAttempt', () => {
      lockedCount += 1;
    });
    engine.setActiveLevel(2);
    expect(lockedCount).toBe(1);
    expect(engine.getActiveLevel().index).toBe(1);

    // Clear level 1.
    gemini.send = vi.fn(async () => 'alpha');
    await engine.submitMessage('go');
    expect(store.record.levels[0].cleared).toBe(true);

    // Now level 2 unlocks; switch and clear it.
    engine.setActiveLevel(2);
    expect(engine.getActiveLevel().index).toBe(2);
    gemini.send = vi.fn(async () => 'beta');
    await engine.submitMessage('go');
    expect(store.record.levels[1].cleared).toBe(true);

    // markCleared was driven in ascending order: level 1 first, then level 2.
    expect(store.markCleared.mock.calls.map((c) => c[0])).toEqual([1, 2]);
  });

  it("(f) the engine's defensive guard refuses to clear level 2 when level 1 is uncleared", async () => {
    // The public API cannot normally place the active level on 2 while
    // level 1 is uncleared (test (d) proves the lock). To exercise the
    // engine's internal REQ-3 §11 guard directly, we drive a legitimate
    // switch to level 2 and then corrupt the live progress record so that
    // level 1 reads as uncleared at win time. The guard must then refuse
    // to mark level 2 cleared.
    const { store, gemini, engine } = setup();

    // Legitimately clear level 1 and move to level 2.
    gemini.send = vi.fn(async () => 'alpha');
    await engine.submitMessage('go');
    engine.setActiveLevel(2);
    expect(engine.getActiveLevel().index).toBe(2);
    expect(store.markCleared.mock.calls.map((c) => c[0])).toEqual([1]);

    // Corrupt the live record: pretend level 1 is no longer cleared.
    store.record.levels[0].cleared = false;

    // A winning response on level 2 would normally clear it, but the
    // unlock-invariant guard sees level 1 uncleared and refuses.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    gemini.send = vi.fn(async () => 'beta');
    await engine.submitMessage('go');
    warnSpy.mockRestore();

    // markCleared was NOT called for level 2; only the earlier level-1 call
    // exists. Level 2 stays uncleared.
    expect(store.markCleared.mock.calls.map((c) => c[0])).toEqual([1]);
    expect(store.record.levels[1].cleared).toBe(false);
  });
});
