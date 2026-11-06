# ADR-0001: Chọn stack cho vn-docs-platform
Trạng thái: PROPOSED - chờ Owner duyệt (CHƯA được duyệt; không viết code ứng dụng trước khi duyệt). Ràng buộc nguồn: CLR-006, CLR-007 (stack đơn giản, chi phí thấp, token thấp).

## Quyết định đề xuất
Node.js 20 LTS + TypeScript + Fastify; SQLite (better-sqlite3, FTS5 cho tìm kiếm); render Markdown phía server bằng markdown-it + sanitize-html; Vitest + ESLint. Một tiến trình, một file DB; deploy bằng một container hoặc VPS nhỏ (ước tính vài USD/tháng) hoặc Fly.io/Railway; sao lưu = sao chép file DB.
Lý do: ít thành phần nhất (không DB server, không build frontend phức tạp), chi phí vận hành thấp, ít token để triển khai, đủ cho MVP. Chi tiết: `.ai-team/architecture/technical-designs/vn-docs-platform.md`.

## Phương án thay thế
1. Next.js (React) + PostgreSQL (Supabase/Neon) + Auth.js. Ưu: UI phong phú, hệ sinh thái lớn, ghi đồng thời tốt hơn, có sẵn auth. Nhược: nhiều thành phần/cấu hình hơn, build nặng, tốn token hơn, chi phí DB cao hơn, phụ thuộc dịch vụ ngoài.
2. Python Django + SQLite/PostgreSQL. Ưu: auth, ORM, migrations, admin dựng sẵn; mặc định bảo mật tốt (CSRF, băm mật khẩu). Nhược: trình soạn thảo tương tác vẫn cần JS riêng, tìm kiếm không dấu phải tự làm (chuẩn hóa hoặc `unaccent` của Postgres); phù hợp nếu Owner ưu tiên Python.

## Đánh đổi
- SQLite: đơn giản, rẻ, nhưng chỉ một node ghi; đường lui sang Postgres qua lớp `db/` (chi phí di chuyển).
- Tự làm auth (scrypt + phiên cookie): nhẹ, không phụ thuộc ngoài, nhưng nhóm tự chịu trách nhiệm bảo mật; giảm rủi ro bằng test IDOR/XSS/rate limit.
- Reader render phía server: nhanh, thân thiện SEO, ít JS; Studio kém "mượt" hơn SPA (chấp nhận ở MVP).
- `better-sqlite3` là native dependency, cần toolchain khi không có prebuilt.

## Đề xuất lệnh check (Orchestrator ghi vào config.json sau khi Owner duyệt)
build `npm run build` | lint `npm run lint` | typecheck `npx tsc --noEmit` | unit `npm test` | integration `npx vitest run test/integration` | static_analysis `npm audit --omit=dev --audit-level=high`.

## Hệ quả
Nếu Owner chọn phương án khác, cập nhật phần stack/lệnh của thiết kế và hợp đồng; mô hình dữ liệu và API nghiệp vụ giữ nguyên.
