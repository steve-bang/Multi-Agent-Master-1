# vn-docs-platform

Nền tảng tài liệu tiếng Việt (Node 20, TypeScript, Fastify, SQLite).

## Chạy cục bộ
```
npm install
npm run build
SESSION_SECRET=<chuoi-ngau-nhien> DB_PATH=./data/app.db npm start   # http://localhost:3000/healthz
```
Biến môi trường cần có: `SESSION_SECRET`, `DB_PATH`, `PORT` . Phiên lưu phía server (token băm SHA-256); Cờ Secure của cookie và CSP `img-src` chỉ https: được bật cho MỌI giá trị NODE_ENV khác `development` và `test` (kể cả khi không đặt: mặc định an toàn là production). Khi chạy dev qua HTTP (localhost) phải đặt `NODE_ENV=development`, ví dụ `NODE_ENV=development SESSION_SECRET=... DB_PATH=./data/app.db npm start`, nếu không trình duyệt sẽ không lưu cookie Secure qua http và ảnh http: bị chặn. Repo không có `.env.example`.

## Kiểm tra
```
npm run lint && npx tsc --noEmit && npm test
```

## Giới hạn đăng nhập và địa chỉ IP
- Khóa đăng nhập theo cặp (IP, email): 5 lần sai / 15 phút; thêm trần 30 lần sai / IP; đăng ký tối đa 10 lần / IP / 15 phút; tối đa 4 tác vụ scrypt chạy đồng thời.
- IP lấy từ `request.ip` (địa chỉ socket). `X-Forwarded-For` bị bỏ qua trừ khi đặt `TRUST_PROXY=true` (chỉ bật khi chạy sau reverse proxy tin cậy, nếu không kẻ tấn công giả IP để né giới hạn). Mặc định tắt.

## Space và cây trang (REQ-004, REQ-007)
- API: xem `src/routes/docs.ts`; giao diện tại `/studio`. Space/trang của người khác trả 404.
- Giới hạn: cây tối đa 4 cấp; tối đa 500 trang mỗi space; tiêu đề tối đa 200 ký tự; slug tối đa 80 ký tự (`a-z0-9` và `-`).
- Slug tự sinh từ tiêu đề (bỏ dấu, `đ`->`d`), trùng trong space thì thêm `-2`, `-3`...; đổi tiêu đề không đổi slug.
- Xóa trang có trang con cần `DELETE /api/pages/:id?confirm=1` (không có thì 400 `CONFIRM_REQUIRED` kèm `childCount`), xóa cả cây.
- Chưa làm: xóa space, xuất bản, tìm kiếm.

## Soạn Markdown và xem trước (REQ-005)
- Hiệu năng xem trước (FND-011): `POST /api/preview` giới hạn theo user, cửa sổ cố định 60 s: tối đa 120 request VÀ tối đa 4 MiB nội dung (ngân sách byte; FND-014); vượt một trong hai -> 429 `PREVIEW_RATE_LIMITED`, header `Retry-After` (bộ đếm trong bộ nhớ, 1 instance; kiểm tra + trừ ngân sách đồng bộ trước khi render; request bị từ chối không bị trừ). Vì sao 4 MiB: ca 200 KB chậm nhất đo ~0,88 s (chặn event loop đúng bằng thời gian render) nên 4 MiB = ~20 request 200 KB/phút = ~17,6 s CPU/phút (~29% một lõi, trần xấu nhất; trước đây 120 x 0,88 s ~ 105 s/phút). Nội dung <= 16 KB vẫn đủ 120 request/phút (120 x 16 KB = 1,9 MiB). Người gõ thật: client dùng debounce 800 ms + 20 ms/KB nên tốc độ request tối đa là 60/(0,8+0,02·KB) mỗi phút; ở 50 KB = 1,8 s -> <= 33 request x 50 KB = 1,6 MiB < 4 MiB; ở 200 KB = 4,8 s -> <= 12,5 x 200 KB = 2,4 MiB < 4 MiB; ở 16 KB = 1,12 s -> <= 53 x 16 KB = 0,85 MiB. Nếu giữ debounce cố định 800 ms thì 75 x 50 KB = 3,7 MiB, sát ngân sách, nên mới tăng debounce theo kích thước. Đánh đổi: nội dung lớn cập nhật xem trước chậm hơn (tối đa ~4,9 s ở 200 KB). Số đo `renderMarkdown` ở ca xấu đúng 200 KB (Node, máy dev, 3 lần chạy, ms): danh sách lồng sâu ~70; blockquote lồng sâu ~7; emphasis lồng ~155; emphasis `**_` lặp ~225-280; `[` lặp ~485-535; `[a](` lặp ~85; backtick lặp ~5; backtick xen kẽ ~150; link dài ~55; bảng lớn ~460-490; entity lặp ~105-117; nhiều đoạn ngắn ~500-545; ảnh lặp ~140. Tăng tuyến tính (không thấy ReDoS/bậc hai), ca tệ nhất ~0,5 s chặn event loop; test hồi quy `test/integration/preview-perf.test.ts` (ngưỡng nới 1500 ms; đặt `PERF_LOG=1` để in số đo).
- `PATCH /api/pages/:pid` nhận `title` và/hoặc `bodyMd` (một transaction); `GET /api/pages/:pid` trả `bodyMd`; `POST /api/preview {bodyMd}` trả `{html}` đã làm sạch.
- Giới hạn nội dung: 200 KB (byte UTF-8) mỗi trang và mỗi lần xem trước; vượt thì 400 `TOO_LARGE` (cả khi vượt giới hạn body 1 MB của server).
- Render dùng một hàm duy nhất `src/render/markdown.ts` (markdown-it `html:false` + sanitize-html): chỉ http/https/mailto, ảnh chỉ http/https (chèn bằng URL, không upload), link có `rel="noopener noreferrer nofollow"`, không có `on*`/`style`. Markdown gốc được lưu, làm sạch khi render.
- Studio: xem trước nằm trong `<iframe sandbox="">` (không script); CSP thêm `img-src 'self' http: https:`. Lưu thủ công, cảnh báo khi rời trang chưa lưu.
