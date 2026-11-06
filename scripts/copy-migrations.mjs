import { cpSync } from 'node:fs';

cpSync('migrations', 'dist/migrations', { recursive: true });
// CSS dùng chung (tokens.css, app.css) được route /assets/*.css đọc từ dist/src/assets/css.
cpSync('src/assets', 'dist/src/assets', { recursive: true });
