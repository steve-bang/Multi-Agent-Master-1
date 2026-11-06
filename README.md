# vn-docs-platform

Nền tảng tài liệu tiếng Việt (Node 20, TypeScript, Fastify, SQLite).

## Chạy cục bộ
```
npm install
npm run build
SESSION_SECRET=<chuoi-ngau-nhien> DB_PATH=./data/app.db npm start   # http://localhost:3000/healthz
```
Biến môi trường cần có: `SESSION_SECRET`, `DB_PATH`, `PORT` . Phiên lưu phía server (token băm SHA-256); `NODE_ENV=production` bật cờ Secure cho cookie phiên. Repo không có `.env.example`.

## Kiểm tra
```
npm run lint && npx tsc --noEmit && npm test
```
