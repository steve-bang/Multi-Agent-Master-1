import type { FastifyInstance, FastifyReply } from 'fastify';
import * as svc from '../services/docs.js';
import { MSG } from '../server/http.js';
import { requireAuth } from '../server/guards.js';

type Id = { Params: { id?: string; pid?: string } };

export async function docsRoutes(app: FastifyInstance): Promise<void> {
  // Mọi route trong plugin này đều yêu cầu đăng nhập; chủ sở hữu kiểm tra trong service (404 nếu không phải chủ).
  app.addHook('preHandler', requireAuth);
  const uid = (req: { user: { id: number } | null }): number => req.user!.id;
  const run = (reply: FastifyReply, fn: () => unknown, okStatus = 200) => {
    try {
      const out = fn();
      return out === undefined ? reply.code(204).send() : reply.code(okStatus).send(out);
    } catch (e) {
      if (e instanceof svc.DocsError) {
        return reply.code(e.status).send({ error: { code: e.code, message: MSG[e.code], ...e.extra } });
      }
      throw e;
    }
  };
  const body = (req: { body: unknown }) =>
    req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};

  app.get('/api/spaces', (req, reply) => run(reply, () => ({ spaces: svc.listSpaces(app.db, uid(req)) })));
  app.post('/api/spaces', (req, reply) =>
    run(reply, () => ({ space: svc.createSpace(app.db, uid(req), body(req).title) }), 201),
  );
  app.patch<Id>('/api/spaces/:id', (req, reply) =>
    run(reply, () => ({ space: svc.renameSpace(app.db, uid(req), svc.parseId(req.params.id), body(req).title) })),
  );
  app.get<Id>('/api/spaces/:id/tree', (req, reply) =>
    run(reply, () => ({ tree: svc.getTree(app.db, uid(req), svc.parseId(req.params.id)) })),
  );
  app.post<Id>('/api/spaces/:id/pages', (req, reply) =>
    run(reply, () => ({ page: svc.createPage(app.db, uid(req), svc.parseId(req.params.id), body(req)) }), 201),
  );
  app.get<Id>('/api/pages/:pid', (req, reply) =>
    run(reply, () => ({ page: svc.getPage(app.db, uid(req), svc.parseId(req.params.pid)) })),
  );
  app.patch<Id>('/api/pages/:pid', (req, reply) =>
    run(reply, () => ({ page: svc.renamePage(app.db, uid(req), svc.parseId(req.params.pid), body(req).title) })),
  );
  app.post<Id>('/api/pages/:pid/move', (req, reply) =>
    run(reply, () => ({ tree: svc.movePage(app.db, uid(req), svc.parseId(req.params.pid), body(req)) })),
  );
  app.delete<Id & { Querystring: { confirm?: string } }>('/api/pages/:pid', (req, reply) =>
    run(reply, () => {
      svc.deletePage(app.db, uid(req), svc.parseId(req.params.pid), req.query.confirm === '1');
    }),
  );
}
