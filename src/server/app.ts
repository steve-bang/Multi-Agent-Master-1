import Fastify, { type FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import { authRoutes } from '../routes/auth.js';
import { healthRoutes } from '../routes/health.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
}

export function buildApp(db: Db): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 1024 * 1024 });
  app.decorate('db', db);
  app.register(healthRoutes);
  app.register(authRoutes);
  return app;
}
