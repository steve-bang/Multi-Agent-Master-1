import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  MAX_EMAIL,
  MAX_PASSWORD,
  MIN_PASSWORD,
  SESSION_MS,
  createSession,
  destroySession,
  isEmail,
  login,
  normEmail,
  register,
  reserveAttempt,
  userFromSession,
} from '../auth/service.js';
import { authPage } from '../render/auth-pages.js';
import { COOKIE, fail, readCookie } from '../server/http.js';

function setCookie(reply: FastifyReply, token: string, maxAgeSec: number): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  reply.header('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`);
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // CSRF Origin và header bảo mật là guard toàn app: xem src/server/guards.ts.
  app.post('/api/auth/register', async (req, reply) => {
    const b = (req.body ?? {}) as { email?: unknown; password?: unknown };
    const email = typeof b.email === 'string' ? normEmail(b.email) : '';
    const password = typeof b.password === 'string' ? b.password : '';
    if (!isEmail(email)) return fail(reply, 400, 'EMAIL_INVALID');
    if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) return fail(reply, 400, 'PASSWORD_WEAK');
    if (!reserveAttempt(app.db, 'register', req.ip, '')) return fail(reply, 429, 'RATE_LIMITED');
    const r = await register(app.db, email, password);
    if ('error' in r) return fail(reply, 409, r.error);
    setCookie(reply, createSession(app.db, r.user.id), SESSION_MS / 1000);
    return reply.code(201).send({ user: r.user });
  });

  app.post('/api/auth/login', async (req, reply) => {
    const b = (req.body ?? {}) as { email?: unknown; password?: unknown };
    const email = typeof b.email === 'string' ? normEmail(b.email) : '';
    const password = typeof b.password === 'string' ? b.password.slice(0, MAX_PASSWORD) : '';
    // Email quá dài bị từ chối trước khi chạm DB.
    if (!email || !password || email.length > MAX_EMAIL) return fail(reply, 401, 'BAD_CREDENTIALS');
    const r = await login(app.db, email, password, req.ip);
    if ('error' in r) return fail(reply, r.error === 'RATE_LIMITED' ? 429 : 401, r.error);
    setCookie(reply, createSession(app.db, r.user.id), SESSION_MS / 1000);
    return { user: r.user };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const tok = readCookie(req, COOKIE);
    if (tok) destroySession(app.db, tok);
    setCookie(reply, '', 0);
    return reply.code(204).send();
  });

  app.get('/api/auth/me', async (req, reply) => {
    const user = userFromSession(app.db, readCookie(req, COOKIE));
    if (!user) return fail(reply, 401, 'UNAUTHENTICATED');
    return { user };
  });

  app.get('/dang-ky', async (_req, reply) => reply.type('text/html; charset=utf-8').send(authPage('register')));
  app.get('/dang-nhap', async (_req, reply) => reply.type('text/html; charset=utf-8').send(authPage('login')));
  app.get('/assets/auth.js', async (_req, reply) =>
    reply.type('text/javascript; charset=utf-8').send(authPage('script')),
  );
}
