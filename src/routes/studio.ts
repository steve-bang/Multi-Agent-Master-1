import type { FastifyInstance } from 'fastify';
import { studioPage } from '../render/studio-page.js';
import { requireAuth } from '../server/guards.js';

export async function studioRoutes(app: FastifyInstance): Promise<void> {
  app.get('/studio', { preHandler: requireAuth }, async (_req, reply) =>
    reply.type('text/html; charset=utf-8').send(studioPage('page')),
  );
  app.get('/assets/studio.js', { preHandler: requireAuth }, async (_req, reply) =>
    reply.type('text/javascript; charset=utf-8').send(studioPage('script')),
  );
}
