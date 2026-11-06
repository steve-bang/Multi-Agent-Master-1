import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/healthz', async () => {
    app.db.prepare('SELECT 1').get();
    return { status: 'ok' };
  });
}
