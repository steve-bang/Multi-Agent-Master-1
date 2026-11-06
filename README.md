# vn-docs-platform

Nền tảng tài liệu tiếng Việt (Node 20, TypeScript, Fastify, SQLite).

## Chạy cục bộ
```
npm install
npm run build
SESSION_SECRET=<chuoi-ngau-nhien> DB_PATH=./data/app.db npm start   # http://localhost:3000/healthz
```
Biến môi trường cần có: `SESSION_SECRET`, `DB_PATH`, `PORT` (mẫu placeholder trong file env mẫu của repo).

## Kiểm tra
```
npm run lint && npx tsc --noEmit && npm test
```
