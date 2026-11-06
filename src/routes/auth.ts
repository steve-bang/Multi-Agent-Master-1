import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  MAX_PASSWORD,
  MIN_PASSWORD,
  SESSION_MS,
  createSession,
  destroySession,
  isEmail,
  login,
  normEmail,
  register,
  userFromSession,
} from '../auth/service.js';
import vi from '../i18n/vi.json' with { type: 'json' };
import { authPage } from '../render/auth-pages.js';

const COOKIE = 'sid';
const t = vi as Record<string, string>;
const MSG: Record<string, string> = {
  EMAIL_INVALID: t['auth.error.email_invalid'],
  PASSWORD_WEAK: t['auth.error.password_weak'],
  EMAIL_EXISTS: t['auth.error.email_exists'],
  BAD_CREDENTIALS: t['auth.error.bad_credentials'],
  RATE_LIMITED: t['auth.error.rate_limited'],
  FORBIDDEN_ORIGIN: t['auth.error.forbidden_origin'],
  UNAUTHENTICATED: t['auth.error.unauthenticated'],
};

function readCookie(req: FastifyRequest, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

function setCookie(reply: FastifyReply, token: string, maxAgeSec: number): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  reply.header('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`);
}

function fail(reply: FastifyReply, status: number, code: string) {
  return reply.code(status).send({ error: { code, message: MSG[code] } });
}

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // CSRF: request thay đổi dữ liệu phải có Origin trùng Host.
  app.addHook('onRequest', async (req, reply) => {
    if (SAFE.has(req.method)) return;
    const origin = req.headers.origin;
    let ok = false;
    if (origin) {
      try {
        ok = new URL(origin).host === req.headers.host;
      } catch {
        ok = false;
      }
    }
    if (!ok) return fail(reply, 403, 'FORBIDDEN_ORIGIN');
  });

  app.post('/api/auth/register', async (req, reply) => {
    const b = (req.body ?? {}) as { email?: unknown; password?: unknown };
    const email = typeof b.email === 'string' ? normEmail(b.email) : '';
    const password = typeof b.password === 'string' ? b.password : '';
    if (!isEmail(email)) return fail(reply, 400, 'EMAIL_INVALID');
    if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) return fail(reply, 400, 'PASSWORD_WEAK');
    const r = await register(app.db, email, password);
    if ('error' in r) return fail(reply, 409, r.error);
    setCookie(reply, createSession(app.db, r.user.id), SESSION_MS / 1000);
    return reply.code(201).send({ user: r.user });
  });

  app.post('/api/auth/login', async (req, reply) => {
    const b = (req.body ?? {}) as { email?: unknown; password?: unknown };
    const email = typeof b.email === 'string' ? normEmail(b.email) : '';
    const password = typeof b.password === 'string' ? b.password.slice(0, MAX_PASSWORD) : '';
    if (!email || !password) return fail(reply, 401, 'BAD_CREDENTIALS');
    const r = await login(app.db, email, password);
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
