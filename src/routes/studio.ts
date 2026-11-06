import type { FastifyInstance } from 'fastify';
import vi from '../i18n/vi.json' with { type: 'json' };
import { requireAuth } from '../server/guards.js';

const t = vi as Record<string, string>;

export async function studioRoutes(app: FastifyInstance): Promise<void> {
  app.get('/studio', { preHandler: requireAuth }, async (_req, reply) =>
    reply.type('text/html; charset=utf-8').send(
      `<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${t['studio.title']} - ${t['app.name']}</title></head>
<body><main><h1>${t['studio.title']}</h1></main></body>
</html>`,
    ),
  );
}
