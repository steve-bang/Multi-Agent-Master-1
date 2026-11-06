# Thiết kế kỹ thuật: vn-docs-platform (MVP đợt 1: REQ-003..008)
Trạng thái: DRAFT, phụ thuộc ADR-0001 (PROPOSED - chờ Owner duyệt). Chưa có code.

## 1. Kiến trúc
Một tiến trình Node.js 20 + TypeScript (Fastify), một DB SQLite (file), không dịch vụ ngoài. Hai bề mặt:
- Reader công khai (REQ-006/007/008): HTML render phía server, mục lục + tìm kiếm, ít JS.
- Studio tác giả (REQ-003/004/005): trang tĩnh + JS thuần gọi API JSON (`/api/*`); preview qua `POST /api/preview`, dùng chung bộ render/sanitize với reader để không lệch.
- i18n: một file `vi.json`, mọi chuỗi UI lấy từ đó (REQ-007, REQ-002). `<html lang="vi">`, UTF-8.
Cấu trúc: `src/{server,routes,services,db,render,i18n}`, `migrations/*.sql`, `test/`.

## 2. Mô hình dữ liệu (SQLite, migrations SQL đánh số)
- `users(id, email UNIQUE COLLATE NOCASE, password_hash, created_at)` - REQ-003
- `sessions(id_hash PK, user_id FK, expires_at)` - lưu hash của token phiên
- `spaces(id, owner_id FK, title, slug UNIQUE, published INT 0/1, created_at)` - REQ-004/006
- `pages(id, space_id FK, parent_id NULL FK, title, slug, position INT, body_md, UNIQUE(space_id, slug))` - REQ-004/005/007
- `pages_fts` (FTS5 trên title_norm, body_norm: bản đã bỏ dấu) - REQ-008
- Xóa trang: cascade xuống trang con, UI bắt buộc xác nhận (giả định, OPEN_QUESTIONS 1).
- Slug: NFD, bỏ dấu, `đ`->`d`, lower, ký tự ngoài [a-z0-9] -> `-`; trùng thì thêm `-2`,`-3`; rỗng -> `trang`. ("Hướng dẫn cài đặt" -> `huong-dan-cai-dat`, REQ-007)
- Tìm kiếm: hàm `fold()` (bỏ dấu + `đ`->`d` + lower) áp cho cả dữ liệu và truy vấn (REQ-008). Không dựa vào `remove_diacritics` của FTS5 vì không xử lý `đ`.
- Cây trang: `parent_id` + `position`; chặn chu trình khi di chuyển; độ sâu tối đa 6 (giả định).

## 3. Bảo mật
- Mật khẩu (REQ-003): `scrypt` của `node:crypto` (N=2^15, salt 16B ngẫu nhiên, so sánh `timingSafeEqual`), tối thiểu 8 ký tự; không lưu/log mật khẩu. Có thể đổi sang argon2id nếu Owner chấp nhận thêm native dependency.
- Phiên: token ngẫu nhiên 32B, cookie `HttpOnly; SameSite=Lax; Secure` (prod), hết hạn 7 ngày; CSRF: SameSite + kiểm tra header `Origin` với mọi method ghi.
- Chống dò mật khẩu: rate limit theo IP+email trên login/register (5 lần/15 phút, in-memory); lỗi chung, không lộ email tồn tại ở login.
- Phân quyền sở hữu (REQ-003): mọi route `/api/spaces|pages` yêu cầu phiên và kiểm tra `spaces.owner_id = user.id`; space người khác trả 404. Có test IDOR riêng.
- XSS (REQ-005): markdown-it `html:false` (HTML thô bị escape), chặn scheme `javascript:`/`data:`/`vbscript:` ở link và ảnh (chỉ http, https, mailto, đường dẫn tương đối), sau đó `sanitize-html` allowlist trên đầu ra (nhiều lớp). Lưu Markdown gốc, sanitize khi render. CSP không `unsafe-inline` (`default-src 'self'; img-src 'self' https:`), `X-Content-Type-Options: nosniff`.
- Công khai (REQ-006): reader chỉ phục vụ space `published=1`, còn lại 404 (không phân biệt "không tồn tại" và "chưa xuất bản").
- Ảnh: MVP chỉ chèn bằng URL; upload file ngoài đợt 1 trừ khi BA xác nhận (OPEN_QUESTIONS 2).
- Truy vấn tham số hóa 100%; body tối đa 1 MB, tiêu đề tối đa 200 ký tự.
- Secrets qua biến môi trường (`SESSION_SECRET`, `DB_PATH`); `.env.example` chỉ có placeholder.

## 4. Chia task triển khai (thứ tự phụ thuộc)
| Task | Nội dung | REQ | Phụ thuộc |
|---|---|---|---|
| I-1 | Khởi tạo: TS, Fastify, SQLite, migrations, lint/test, i18n `vi.json` | REQ-002/007 | ADR được duyệt |
| I-2 | Auth: đăng ký/đăng nhập/đăng xuất, phiên, rate limit, guard | REQ-003 | I-1 |
| I-3 | Space + cây trang CRUD/sắp xếp, slug bỏ dấu, kiểm tra sở hữu | REQ-004/007 | I-2 |
| I-4 | Render Markdown an toàn + preview + trình soạn thảo Studio | REQ-005 | I-3 |
| I-5 | Publish + Reader công khai (mục lục, điều hướng, 404) | REQ-006/007 | I-4 |
| I-6 | Tìm kiếm không dấu (FTS5) trong space | REQ-008 | I-5 |
| I-7 | Rà soát đầu-cuối + README chạy cục bộ + Dockerfile tối thiểu | REQ-001/002/014 | I-6 |

## 5. Chiến lược test
- Unit (Vitest): `slugify`, `fold`, render+sanitize (payload `<script>`, `onerror`, `javascript:`, `data:`), hash/verify mật khẩu, chặn chu trình cây.
- Integration (Vitest + `fastify.inject`, SQLite `:memory:`): luồng AC của REQ-003..008; email trùng; chưa đăng nhập -> 401/302; IDOR giữa 2 user; space chưa publish -> 404; tìm "cai dat" ra "Cài đặt"; "duong" ra "Đường".
- Mỗi AC ánh xạ ít nhất 1 test, tên test chứa REQ ID để `trace` truy vết.
- Tester độc lập chạy lại trên SHA của PR; không cần e2e trình duyệt ở đợt 1 (tiết kiệm chi phí).

## 6. Đề xuất lệnh check (KHÔNG sửa config.json; Orchestrator cập nhật sau khi Owner duyệt ADR)
build `npm run build` (tsc) | lint `npm run lint` (eslint) | typecheck `npx tsc --noEmit` | unit `npm test` (vitest run test/unit) | integration `npx vitest run test/integration` | static_analysis `npm audit --omit=dev --audit-level=high`.

## 7. Rủi ro
SQLite chỉ một ghi tại một thời điểm (đủ cho MVP; đường lui sang Postgres qua lớp `db/`); rate limit in-memory mất khi restart; `better-sqlite3` cần build native khi không có prebuilt.
