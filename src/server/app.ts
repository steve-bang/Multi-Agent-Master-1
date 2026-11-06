import Fastify, { type FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import { authRoutes } from '../routes/auth.js';
import { healthRoutes } from '../routes/health.js';
import { studioRoutes } from '../routes/studio.js';
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
  app.register(healthRoutes);
  app.register(authRoutes);
  app.register(studioRoutes);
  return app;
}
