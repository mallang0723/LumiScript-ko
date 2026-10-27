/**
 * The single outbound-HTTP chokepoint (`guardedCorsFetch`): everything routes through `spindle.cors` → the
 * host's `safeFetch` (SSRF-hardened). LumiScript-ko removed upstream's direct-fetch escape hatch for allowlisted hosts.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { guardedCorsFetch, setAllowedPrivateHostsReader } from '../../src/engine/api/utils.js';

describe('guardedCorsFetch — SSRF-guarded egress routing', () => {
  const realFetch = globalThis.fetch;
  const realSpindle = (globalThis as unknown as { spindle?: unknown }).spindle;
  let corsCalls: Array<[string, unknown]>;
  let fetchCalls: string[];

  beforeEach(() => {
    corsCalls = [];
    fetchCalls = [];
    (globalThis as unknown as { spindle: unknown }).spindle = {
      cors: async (url: string, opts: unknown) => {
        corsCalls.push([url, opts]);
        return { status: 200, statusText: 'OK', headers: {}, body: 'via-cors' };
      },
    };
    globalThis.fetch = (async (url: string | URL) => {
      fetchCalls.push(String(url));
      return new Response('via-direct', { status: 201, statusText: 'Created', headers: { 'x-test': 'y' } });
    }) as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    (globalThis as unknown as { spindle?: unknown }).spindle = realSpindle;
    setAllowedPrivateHostsReader(() => []);
  });

  test('non-allowlisted host → hardened cors path (never a direct fetch)', async () => {
    setAllowedPrivateHostsReader(() => ['localhost:11434']);
    const r = await guardedCorsFetch('https://example.com/data', { method: 'GET' }) as { body: string };
    expect(corsCalls.length).toBe(1);
    expect(fetchCalls.length).toBe(0);
    expect(r.body).toBe('via-cors');
  });

  test('empty allowlist → a private host still goes through cors (default-safe)', async () => {
    setAllowedPrivateHostsReader(() => []);
    await guardedCorsFetch('http://localhost:11434/api', { method: 'GET' });
    expect(corsCalls.length).toBe(1);
    expect(fetchCalls.length).toBe(0);
  });

  test('a domain that resolves to an allowlisted IP still uses cors (literal match only, no rebinding bypass)', async () => {
    setAllowedPrivateHostsReader(() => ['127.0.0.1', 'localhost']);
    await guardedCorsFetch('http://evil.example.com/', { method: 'GET' });
    expect(corsCalls.length).toBe(1); // fails closed to the hardened path
    expect(fetchCalls.length).toBe(0);
  });

  test('LumiScript-ko: even an allowlisted trusted-local host goes through cors (direct path removed)', async () => {
    setAllowedPrivateHostsReader(() => ['localhost:11434']);
    await guardedCorsFetch('http://localhost:11434/api', { method: 'GET' });
    expect(corsCalls.length).toBe(1);
    expect(fetchCalls.length).toBe(0);
  });

  test('SECURITY: a file:// URL to an allowlisted IP goes through cors, never a direct fetch', async () => {
    setAllowedPrivateHostsReader(() => ['127.0.0.1']);
    await guardedCorsFetch('file://127.0.0.1/etc/passwd', { method: 'GET' });
    expect(corsCalls.length).toBe(1); // routed to the hardened path (where safeFetch rejects the scheme)
    expect(fetchCalls.length).toBe(0); // NOT the direct local-file read
  });

  test('cors path drops the AbortSignal (it cannot cross the worker boundary)', async () => {
    setAllowedPrivateHostsReader(() => ['127.0.0.1']); // example.com is NOT allowlisted → cors path
    await guardedCorsFetch('https://example.com/x', { method: 'GET', signal: new AbortController().signal });
    expect(corsCalls.length).toBe(1);
    const [, opts] = corsCalls[0]!;
    expect((opts as { signal?: unknown }).signal).toBeUndefined();
  });
});
