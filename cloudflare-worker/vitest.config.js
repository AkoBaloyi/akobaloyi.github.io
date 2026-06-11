import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

// Dev-only test harness for the Cloudflare Worker.
// Loads the production wrangler.toml so the worker is exercised under the
// same compatibility flags it ships with, and declares the KV namespaces
// the worker tests need (RATE_LIMIT is already bound in wrangler.toml; the
// LEADERBOARD binding is added inside the test pool until task 33 wires it
// into wrangler.toml proper).
export default defineWorkersConfig({
  test: {
    passWithNoTests: true,
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          kvNamespaces: ['RATE_LIMIT', 'LEADERBOARD'],
          // Required by @cloudflare/vitest-pool-workers. Scoped to the test
          // harness so production wrangler.toml stays unchanged.
          compatibilityFlags: ['nodejs_compat'],
        },
      },
    },
  },
});
