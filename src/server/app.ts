import Fastify, { type FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import { authRoutes } from '../routes/auth.js';
import { docsRoutes } from '../routes/docs.js';
import { healthRoutes } from '../routes/health.js';
import { studioRoutes } from '../routes/studio.js';
import { MSG } from './http.js';
import { registerGlobalGuards } from './guards.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
}

export type AppOptions = { trustProxy?: boolean };

export function buildApp(db: Db, opts: AppOptions = {}): FastifyInstance {
  // trustProxy mặc định tắt: request.ip là địa chỉ socket, bỏ qua X-Forwarded-For (bật bằng TRUST_PROXY=true).
  const trustProxy = opts.trustProxy ?? process.env.TRUST_PROXY === 'true';
  const app = Fastify({ logger: false, bodyLimit: 1024 * 1024, trustProxy });
  app.decorate('db', db);
  registerGlobalGuards(app);
  // Body vượt bodyLimit của Fastify cũng trả envelope lỗi tiếng Việt (không lộ thông báo mặc định).
  app.setErrorHandler((err, _req, reply) => {
    const e = err as { code?: string; statusCode?: number };
    if (e.code === 'FST_ERR_CTP_BODY_TOO_LARGE') return reply.code(400).send({ error: { code: 'TOO_LARGE', message: MSG.TOO_LARGE } });
    const status = e.statusCode && e.statusCode >= 400 && e.statusCode < 500 ? e.statusCode : 500;
    // Lỗi 5xx chỉ ghi log phía server (stderr), client nhận thông báo cố định.
    if (status === 500) console.error('[server] lỗi 5xx:', err);
    return reply.code(status).send({ error: { code: status === 500 ? 'INTERNAL' : 'INVALID_INPUT', message: status === 500 ? MSG.INTERNAL : MSG.INVALID_INPUT } });
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: { code: 'NOT_FOUND', message: MSG.NOT_FOUND } }));
  app.register(healthRoutes);
  app.register(authRoutes);
  app.register(studioRoutes);
  app.register(docsRoutes);
  return app;
}
