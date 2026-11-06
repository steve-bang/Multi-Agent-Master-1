import { describe, expect, it } from 'vitest';
import { openDb } from '../../src/db/index.js';
import { buildApp } from '../../src/server/app.js';

describe('REQ-001 healthz', () => {
  it('REQ-001 GET /healthz trả 200 {status:ok}', async () => {
    const app = buildApp(openDb(':memory:'));
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });
});
