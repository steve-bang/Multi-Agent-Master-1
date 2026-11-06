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

## Giới hạn đăng nhập và địa chỉ IP
- Khóa đăng nhập theo cặp (IP, email): 5 lần sai / 15 phút; thêm trần 30 lần sai / IP; đăng ký tối đa 10 lần / IP / 15 phút; tối đa 4 tác vụ scrypt chạy đồng thời.
- IP lấy từ `request.ip` (địa chỉ socket). `X-Forwarded-For` bị bỏ qua trừ khi đặt `TRUST_PROXY=true` (chỉ bật khi chạy sau reverse proxy tin cậy, nếu không kẻ tấn công giả IP để né giới hạn). Mặc định tắt.
