# API contract: vn-docs-platform (MVP đợt 1)
Quy ước: JSON UTF-8; lỗi `{ "error": { "code": "<MA_LOI>", "message": "<tiếng Việt>" } }`; cookie phiên `sid` (HttpOnly). `[A]` = cần đăng nhập và là chủ space. Chưa có code; hợp đồng có thể chỉnh khi I-1 bắt đầu (ghi lại thay đổi).

## Auth (REQ-003)
| Method + Path | Body | Thành công | Lỗi |
|---|---|---|---|
| POST /api/auth/register | `{email, password}` | 201 `{user:{id,email}}` + set cookie | 400 `EMAIL_INVALID`/`PASSWORD_WEAK`; 409 `EMAIL_EXISTS` |
| POST /api/auth/login | `{email, password}` | 200 `{user}` + set cookie | 401 `BAD_CREDENTIALS`; 429 `RATE_LIMITED` |
| POST /api/auth/logout | - | 204, xóa cookie | - |
| GET /api/auth/me | - | 200 `{user}` | 401 `UNAUTHENTICATED` |

## Space (REQ-004, REQ-006) - [A]
| Method + Path | Body | Thành công | Lỗi |
|---|---|---|---|
| GET /api/spaces | - | 200 `{spaces:[{id,title,slug,published}]}` (chỉ của mình) | 401 |
| POST /api/spaces | `{title}` | 201 `{space}` (slug tự sinh, bỏ dấu) | 400 `TITLE_REQUIRED` |
| PATCH /api/spaces/:id | `{title?, published?}` | 200 `{space}` | 404 (không phải chủ) |
| DELETE /api/spaces/:id | - | 204 (xóa cả trang) | 404 |
| GET /api/spaces/:id/tree | - | 200 `{tree:[{id,title,slug,parentId,position,children:[...]}]}` | 404 |

## Trang (REQ-004, REQ-005, REQ-007) - [A]
| Method + Path | Body | Thành công | Lỗi |
|---|---|---|---|
| POST /api/spaces/:id/pages | `{title, parentId?, bodyMd?}` | 201 `{page}` (slug tự sinh) | 400 `TITLE_REQUIRED`/`TOO_DEEP`; 404 |
| GET /api/pages/:pid | - | 200 `{page:{id,title,slug,parentId,bodyMd}}` | 404 |
| PATCH /api/pages/:pid | `{title?, bodyMd?}` | 200 `{page}` | 400 `TOO_LARGE`; 404 |
| POST /api/pages/:pid/move | `{parentId\|null, position}` | 200 `{tree}` | 400 `CYCLE`/`TOO_DEEP`; 404 |
| DELETE /api/pages/:pid?confirm=1 | - | 204 (xóa cả trang con) | 400 `CONFIRM_REQUIRED` nếu có trang con mà thiếu `confirm=1`; 404 |
| POST /api/preview | `{bodyMd}` | 200 `{html}` (đã sanitize) | 401; 400 `TOO_LARGE` |

## Reader công khai (REQ-006, REQ-007, REQ-008) - không cần đăng nhập
| Method + Path | Mô tả | Lỗi |
|---|---|---|
| GET /s/:spaceSlug | HTML: trang đầu + mục lục | 404 nếu không có hoặc chưa publish |
| GET /s/:spaceSlug/:pageSlug | HTML: nội dung đã sanitize + mục lục + điều hướng trước/sau | 404 |
| GET /s/:spaceSlug/search?q= | HTML kết quả tìm kiếm không dấu, tối đa 20 | 404 space; q rỗng -> danh sách rỗng |
| GET /api/public/:spaceSlug/search?q= | 200 `{results:[{title,slug,snippet}]}` | 404 |

Ghi chú: slug trang trùng trong cùng space được thêm hậu tố `-2`; đổi tiêu đề không đổi slug (URL ổn định, giả định, OPEN_QUESTIONS 3). Studio (HTML) tại `/studio`, chưa đăng nhập -> 302 `/dang-nhap`.

## Cập nhật sau T-006 (theo mã thực tế tại b59abca)
- POST /api/spaces/:id/pages nhận thêm `slug?` (tùy chọn, kiểm tra regex, SLUG_INVALID nếu sai).
- PATCH /api/pages/:pid hiện chỉ nhận `title`; `bodyMd` sẽ thêm ở T-007.
- DELETE /api/pages/:pid?confirm=1: trang có con mà thiếu confirm trả 400 CONFIRM_REQUIRED kèm `error.childCount`.
- Giới hạn: 500 trang/space, tiêu đề 200 ký tự, slug 80 ký tự. Space/trang của người khác trả 404.

## Ngoài phạm vi đợt 1 (chốt bởi Orchestrator sau review T-006)
- DELETE /api/spaces/:id và đổi slug space/trang sau khi tạo: KHÔNG làm ở đợt 1, vào backlog. `PATCH /api/spaces/:id {published?}` được thêm ở T-008.
- Slug trang dành riêng của reader (ít nhất `search`): xử lý trong T-009 khi route `/s/:spaceSlug/search` được tạo.
