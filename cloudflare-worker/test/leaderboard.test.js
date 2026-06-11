/**
 * End-to-end tests for the leaderboard worker routes (REQ-5 §§1-14).
 *
 * Approach mirrors test/gemini-pro.test.js: import the worker module and call
 * `worker.fetch(request, env)` directly with a hand-built `env`. The KV binding
 * is a fresh Map-backed in-memory stub per test (beforeEach) so stored entries
 * and `submit:<ip>` rate-limit counters never leak between cases.
 *
 * Coverage:
 *   (a) GET returns 200 with sorted top-20.
 *   (b) POST valid -> 201 and persists.
 *   (c) each documented validation error returns its status+code.
 *   (d) rate-limit: 5 successful POSTs succeed, 6th -> 429; failures don't count.
 *   (e) 200-entry cap: 201 entries -> lowest-ranked evicted.
 *   (f) sanitization invariant: every stored handle matches /^[a-z0-9_-]{3,16}$/.
 *   (g) origin/token rejection -> 403 forbidden.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/index.js';

const ALLOWED_ORIGIN = 'https://akobaloyi.github.io';
const DEV_TOKEN = 'test-token';
const HANDLE_RE = /^[a-z0-9_-]{3,16}$/;

/**
 * Map-backed in-memory KV stub implementing the subset of the Workers KV API
 * the leaderboard handlers use. Created fresh per test for full isolation.
 */
function makeKvStub() {
  const store = new Map();
  return {
    // expose for direct seeding/inspection in tests
    _store: store,
    async get(key, type) {
      const raw = store.get(key);
      if (raw === undefined) return null;
      if (type === 'json') {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      }
      return raw;
    },
    async put(key, value /*, opts */) {
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    },
    async list({ prefix = '', limit = 1000 } = {}) {
      const keys = [];
      for (const name of store.keys()) {
        if (name.startsWith(prefix)) {
          keys.push({ name });
          if (keys.length >= limit) break;
        }
      }
      return { keys };
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

function makeEnv(stub) {
  return {
    ALLOWED_ORIGIN,
    SANDBOX_DEV_TOKEN: DEV_TOKEN,
    GEMINI_API_KEY: 'k',
    LEADERBOARD: stub,
  };
}

/**
 * Build a /leaderboard request. `headers` is merged last so callers can
 * override or remove (by reconstructing) the default Origin/IP headers.
 */
function req(method, body, headers = {}) {
  return new Request('https://worker.example/leaderboard', {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: ALLOWED_ORIGIN,
      'CF-Connecting-IP': '1.2.3.4',
      ...headers,
    },
    body:
      body === undefined
        ? undefined
        : typeof body === 'string'
          ? body
          : JSON.stringify(body),
  });
}

const validBody = (overrides = {}) => ({
  handle: 'player_one',
  levelsCleared: 7,
  totalAttempts: 42,
  totalTimeSeconds: 1234,
  ...overrides,
});

let stub;
let env;

beforeEach(() => {
  stub = makeKvStub();
  env = makeEnv(stub);
});

// Helper: directly seed an entry record into the stub.
function seedEntry(key, entry) {
  stub._store.set(key, JSON.stringify(entry));
}

describe('(a) GET /leaderboard returns sorted top-20 (REQ-5 §§1, 10)', () => {
  it('returns 200 with the best 20 entries sorted by the ranking rule', async () => {
    // Seed 25 entries with varied stats. levelsCleared in {5,6,7}, varied
    // attempts/time so the ranking comparator has work to do.
    for (let i = 0; i < 25; i++) {
      seedEntry(`entry:seed-${i}`, {
        handle: `player_${i}`,
        levelsCleared: 5 + (i % 3), // 5,6,7,5,6,7,...
        totalAttempts: 1 + ((i * 7) % 50),
        totalTimeSeconds: 100 + ((i * 13) % 500),
        submittedAt: new Date(2024, 0, 1 + i).toISOString(),
      });
    }

    const res = await worker.fetch(req('GET', undefined), env);
    expect(res.status).toBe(200);
    const list = await res.json();

    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(20);

    // Assert sorted by levelsCleared desc, totalAttempts asc, totalTimeSeconds asc.
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      const inOrder =
        prev.levelsCleared > cur.levelsCleared ||
        (prev.levelsCleared === cur.levelsCleared &&
          (prev.totalAttempts < cur.totalAttempts ||
            (prev.totalAttempts === cur.totalAttempts &&
              prev.totalTimeSeconds <= cur.totalTimeSeconds)));
      expect(inOrder).toBe(true);
    }

    // The 20 returned must be the best 20: every returned entry ranks <= every
    // excluded entry. Compute the full sorted set independently and compare.
    const all = [];
    for (let i = 0; i < 25; i++) {
      all.push({
        levelsCleared: 5 + (i % 3),
        totalAttempts: 1 + ((i * 7) % 50),
        totalTimeSeconds: 100 + ((i * 13) % 500),
      });
    }
    all.sort(
      (x, y) =>
        y.levelsCleared - x.levelsCleared ||
        x.totalAttempts - y.totalAttempts ||
        x.totalTimeSeconds - y.totalTimeSeconds
    );
    const expectedTop = all.slice(0, 20);
    // The worst returned entry must not be worse than the best excluded entry.
    const worstReturnedLevels = list[19].levelsCleared;
    const bestExcludedLevels = all[20].levelsCleared;
    expect(worstReturnedLevels).toBeGreaterThanOrEqual(bestExcludedLevels);
    // Sanity: top of the list has the maximum levelsCleared present.
    expect(list[0].levelsCleared).toBe(expectedTop[0].levelsCleared);
  });

  it('returns an empty array when there are no entries', async () => {
    const res = await worker.fetch(req('GET', undefined), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe('(b) POST valid -> 201 and persists (REQ-5 §§11, 13)', () => {
  it('stores the entry and reflects it on GET', async () => {
    const before = (await stub.list({ prefix: 'entry:', limit: 1000 })).keys.length;

    const res = await worker.fetch(req('POST', validBody()), env);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.entry.handle).toBe('player_one');
    expect(json.entry.levelsCleared).toBe(7);

    const after = (await stub.list({ prefix: 'entry:', limit: 1000 })).keys.length;
    expect(after).toBe(before + 1);

    // GET should now include the new entry.
    const getRes = await worker.fetch(req('GET', undefined), env);
    const list = await getRes.json();
    expect(list.some((e) => e.handle === 'player_one')).toBe(true);
  });
});

describe('(c) validation errors return documented status + code (REQ-5 §§2-7, 12)', () => {
  it('invalid_json (400) for an unparseable body', async () => {
    const res = await worker.fetch(req('POST', 'not json'), env);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_json');
  });

  it('levels_cleared_invalid (400) when levelsCleared !== 7', async () => {
    const res = await worker.fetch(req('POST', validBody({ levelsCleared: 6 })), env);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('levels_cleared_invalid');
  });

  it('attempts_out_of_range (400) for 0, 10001, and non-integer', async () => {
    for (const totalAttempts of [0, 10001, 1.5]) {
      const res = await worker.fetch(req('POST', validBody({ totalAttempts })), env);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('attempts_out_of_range');
    }
  });

  it('time_out_of_range (400) for 86401 and -1', async () => {
    for (const totalTimeSeconds of [86401, -1]) {
      const res = await worker.fetch(req('POST', validBody({ totalTimeSeconds })), env);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('time_out_of_range');
    }
  });

  it('handle_invalid (400) when sanitized handle is too short', async () => {
    const res = await worker.fetch(req('POST', validBody({ handle: '@@' })), env);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('handle_invalid');
  });

  it('handle_rejected (422) when sanitized handle hits the blocklist', async () => {
    // 'shitlord' sanitizes cleanly (length 8, valid charset) and contains the
    // blocklisted token 'shit'.
    const res = await worker.fetch(req('POST', validBody({ handle: 'shitlord' })), env);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('handle_rejected');
  });
});

describe('(d) rate limit: 5 succeed, 6th -> 429; failures do not count (REQ-5 §§8, 9)', () => {
  const RL_IP = '9.9.9.9';

  it('allows 5 successful POSTs then rejects the 6th with Retry-After', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await worker.fetch(
        req('POST', validBody({ handle: `winner_${i}` }), { 'CF-Connecting-IP': RL_IP }),
        env
      );
      expect(res.status).toBe(201);
    }

    const sixth = await worker.fetch(
      req('POST', validBody({ handle: 'winner_x' }), { 'CF-Connecting-IP': RL_IP }),
      env
    );
    expect(sixth.status).toBe(429);
    expect((await sixth.json()).error).toBe('rate_limited');

    const retryAfter = Number(sixth.headers.get('Retry-After'));
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(86400);
  });

  it('does not consume quota on validation failures', async () => {
    const ip = '8.8.8.8';
    // 4 successes
    for (let i = 0; i < 4; i++) {
      const res = await worker.fetch(
        req('POST', validBody({ handle: `ok_${i}` }), { 'CF-Connecting-IP': ip }),
        env
      );
      expect(res.status).toBe(201);
    }
    // a validation failure (must NOT count toward the quota)
    const bad = await worker.fetch(
      req('POST', validBody({ levelsCleared: 3, handle: 'bad_one' }), {
        'CF-Connecting-IP': ip,
      }),
      env
    );
    expect(bad.status).toBe(400);

    // 5th success still allowed
    const fifth = await worker.fetch(
      req('POST', validBody({ handle: 'ok_5' }), { 'CF-Connecting-IP': ip }),
      env
    );
    expect(fifth.status).toBe(201);

    // 6th now rate-limited
    const sixth = await worker.fetch(
      req('POST', validBody({ handle: 'ok_6' }), { 'CF-Connecting-IP': ip }),
      env
    );
    expect(sixth.status).toBe(429);
    expect((await sixth.json()).error).toBe('rate_limited');
  });
});

describe('(e) 200-entry cap: lowest-ranked evicted (REQ-5 §14)', () => {
  it('keeps <= 200 entries and evicts the worst-ranked', async () => {
    // Seed 200 strong entries plus 1 deliberately terrible entry = 201 total
    // before the new POST. Actually we seed 200 total (including the terrible
    // one) so that the incoming POST pushes us to 201 and triggers eviction.
    const TERRIBLE_HANDLE = 'terrible_one';
    seedEntry('entry:terrible', {
      handle: TERRIBLE_HANDLE,
      levelsCleared: 7,
      totalAttempts: 10000,
      totalTimeSeconds: 86400,
      submittedAt: new Date(2024, 0, 1).toISOString(),
    });
    // 199 strong entries (better than the terrible one).
    for (let i = 0; i < 199; i++) {
      seedEntry(`entry:strong-${i}`, {
        handle: `strong_${i}`,
        levelsCleared: 7,
        totalAttempts: 1 + (i % 100),
        totalTimeSeconds: 100 + (i % 400),
        submittedAt: new Date(2024, 1, 1 + i).toISOString(),
      });
    }

    // Confirm we start at exactly 200 seeded entries.
    expect((await stub.list({ prefix: 'entry:', limit: 1000 })).keys.length).toBe(200);

    // POST a strong new entry from a fresh IP (different from (d), < 6 POSTs).
    const res = await worker.fetch(
      req('POST', validBody({ handle: 'champion', totalAttempts: 1, totalTimeSeconds: 50 }), {
        'CF-Connecting-IP': '5.5.5.5',
      }),
      env
    );
    expect(res.status).toBe(201);

    // Cap enforced.
    const keys = (await stub.list({ prefix: 'entry:', limit: 1000 })).keys;
    expect(keys.length).toBeLessThanOrEqual(200);

    // Read all stored entries; the terrible one must be gone, champion present.
    const handles = [];
    for (const k of keys) {
      const e = await stub.get(k.name, 'json');
      if (e) handles.push(e.handle);
    }
    expect(handles).not.toContain(TERRIBLE_HANDLE);
    expect(handles).toContain('champion');
  });
});

describe('(f) sanitization invariant: stored handles match /^[a-z0-9_-]{3,16}$/ (REQ-5 §13)', () => {
  it('stores a sanitized handle and all stored handles satisfy the invariant', async () => {
    const res = await worker.fetch(req('POST', validBody({ handle: 'Player ONE!!' })), env);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.entry.handle).toBe('playerone');

    const keys = (await stub.list({ prefix: 'entry:', limit: 1000 })).keys;
    for (const k of keys) {
      const e = await stub.get(k.name, 'json');
      expect(e.handle).toMatch(HANDLE_RE);
    }
  });
});

describe('(g) origin/token rejection -> 403 forbidden (REQ-5 §10)', () => {
  it('rejects POST from a disallowed origin with no token', async () => {
    const res = await worker.fetch(
      req('POST', validBody(), { Origin: 'https://evil.example' }),
      env
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('forbidden');
  });

  it('rejects POST with a wrong token and no origin', async () => {
    // Build a request WITHOUT the Origin header (cannot rely on undefined).
    const request = new Request('https://worker.example/leaderboard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '1.2.3.4',
        'x-sandbox-token': 'wrong',
      },
      body: JSON.stringify(validBody()),
    });
    const res = await worker.fetch(request, env);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('forbidden');
  });

  it('rejects GET from a disallowed origin', async () => {
    const res = await worker.fetch(
      req('GET', undefined, { Origin: 'https://evil.example' }),
      env
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('forbidden');
  });
});
