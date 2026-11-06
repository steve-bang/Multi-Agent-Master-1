import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { designTokensPage } from '../render/design-tokens-page.js';
import { designTokensCss, parseTokens } from '../render/tokens.js';

// src/assets/css nằm cạnh src/routes; bản build chép vào dist/src/assets/css (scripts/copy-migrations.mjs).
const CSS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'css');
const FONT_FILES = ['inter-latin-wght-normal.woff2', 'inter-vietnamese-wght-normal.woff2'];

function loadFonts(): Map<string, Buffer> {
  const fonts = new Map<string, Buffer>();
  try {
    const pkg = createRequire(import.meta.url).resolve('@fontsource-variable/inter/package.json');
    for (const f of FONT_FILES) fonts.set(f, readFileSync(join(dirname(pkg), 'files', f)));
  } catch {
    fonts.clear(); // thiếu gói font: trả 404, giao diện rơi về font hệ thống (system-ui)
  }
  return fonts;
}

/** Tài sản tĩnh công khai (không cần đăng nhập, không chứa dữ liệu người dùng). */
export async function assetRoutes(app: FastifyInstance): Promise<void> {
  const tokensCss = readFileSync(join(CSS_DIR, 'tokens.css'), 'utf8');
  const appCss = readFileSync(join(CSS_DIR, 'app.css'), 'utf8');
  const demoCss = designTokensCss(parseTokens(tokensCss));
  const page = designTokensPage(tokensCss);
  const fonts = loadFonts();
  const cache = 'public, max-age=3600';

  app.get('/assets/tokens.css', async (_req, reply) =>
    reply.type('text/css; charset=utf-8').header('Cache-Control', cache).send(tokensCss),
  );
  app.get('/assets/app.css', async (_req, reply) =>
    reply.type('text/css; charset=utf-8').header('Cache-Control', cache).send(appCss),
  );
  app.get('/assets/design-tokens.css', async (_req, reply) =>
    reply.type('text/css; charset=utf-8').header('Cache-Control', cache).send(demoCss),
  );
  app.get<{ Params: { file: string } }>('/assets/fonts/:file', async (req, reply) => {
    const buf = fonts.get(req.params.file); // chỉ tên trong danh sách cố định, không ghép đường dẫn từ input
    if (!buf) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy.' } });
    // Preview chạy trong iframe sandbox (origin mờ): tải font là request CORS nên cần cho phép đọc công khai.
    return reply
      .type('font/woff2')
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .header('Access-Control-Allow-Origin', '*')
      .send(buf);
  });
  app.get('/design-tokens', async (_req, reply) =>
    reply.type('text/html; charset=utf-8').header('Cache-Control', 'no-cache').send(page),
  );
}
