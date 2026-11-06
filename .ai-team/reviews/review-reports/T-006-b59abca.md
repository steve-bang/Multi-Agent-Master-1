# Review T-006 (REQ-004, REQ-007) - SHA b59abca

Lưu ý: kết luận mang tính tư vấn, KHÔNG phải GitHub approve và không thay CI. Chưa có PR (NO-PR-YET).
HEAD nhánh ai/vn-docs-platform = 341adf2 (đã xác nhận); mã T-006 đến b59abca; diff `650bf44..b59abca` đã đọc đủ (services/docs.ts, routes/docs.ts, studio-page.ts, studio.ts, http.ts, app.ts, test, README).

## Bằng chứng
checks-b59abca213ba.json: build, lint, typecheck, unit, integration, static_analysis đều PASS; 44/44 test (docs.test.ts 16). Mã đọc trực tiếp, không dựa báo cáo Dev.

## Kiểm tra theo trọng tâm
1. IDOR: mọi route đều qua requireAuth; mọi truy vấn id đi qua ownedSpace/ownedPage (JOIN owner_id). parseId sai -> 404. Trang/space khác chủ hoặc khác space của cùng chủ dùng làm parent: 404 (parent tra trong pages của space đích). Thứ tự kiểm tra: quyền sở hữu trước, validate body sau -> không phân biệt được 404/400 giữa "không tồn tại" và "của người khác". Không có đường lộ. OK.
2. Cây: depth = depthOf(parent)+1 <= 4 (create); depthOf(parent)+height(page) <= 4 (move) đúng; vòng lặp chặn trước khi ghi; position dồn lại cả cha cũ lẫn cha mới sau move/delete; cascade nhờ foreign_keys=ON (src/db/index.ts:48) và ON DELETE CASCADE; đếm+xóa cùng transaction; 500 trang kiểm tra trong transaction. better-sqlite3 đồng bộ nên không có race trong một tiến trình. OK.
3. Slug: NFD + bỏ dấu tổ hợp + đ + regex ASCII; rỗng -> 'space'/'trang'; hậu tố tính trong transaction, cắt để không vượt 80; UNIQUE(space_id,slug) và UNIQUE(slug) toàn cục làm lưới an toàn. Đường dẫn công khai là /s/:spaceSlug (hợp đồng) nên slug 'api', 'studio', 'assets', 'dang-nhap' KHÔNG va chạm route hệ thống. Ngoại lệ: xem F-1.
4. XSS: studio.js chỉ dùng textContent/createElement/setAttribute với giá trị cố định; chuỗi i18n nhúng qua JSON với '<' đã thoát; confirm() chỉ nhận text. CSP default-src 'self' không cho inline script. Không có đường XSS.
5. Validate: tiêu đề trim, <=200 ký tự (theo code point), slug regex ASCII <=80, position nguyên 0..100000, parentId nguyên >=1, SQL tham số hóa toàn bộ. Origin guard áp cho POST/PATCH/DELETE. OK.
6. Test: IDOR (9 route), 401, 403 Origin, depth/chiều cao cây con, vòng, position, cascade, 500 đều khẳng định đúng hành vi (có snapshot DB trước/sau). Thiếu nhỏ (không chặn): parent là trang của space khác cùng chủ; slugify với chuỗi Unicode lạ.
7. Hợp đồng: xem F-2.

## Findings (đều LOW)
- F-1 LOW: slug trang 'search' trùng route /s/:spaceSlug/search (T-009) -> trang không truy cập được.
- F-2 LOW: hợp đồng API còn DELETE /api/spaces/:id và PATCH space `published?`, chưa có trong mã và chưa ghi rõ trong "Cập nhật sau T-006"; `published` thuộc T-008 nhưng DELETE space không thuộc task nào.

## Suggestions (không bắt buộc)
- Giới hạn số space/user và rate limit ghi (hiện chỉ 500 trang/space, không giới hạn số space).
- Hậu tố -N khi tạo space làm lộ gián tiếp sự tồn tại của slug space chưa xuất bản của người khác (hệ quả của UNIQUE toàn cục; cân nhắc khi làm T-008).
- Tiêu đề chỉ gồm ký tự độ rộng 0 (U+200B) vẫn qua trim; JSON body sai cú pháp trả lỗi mặc định Fastify (tiếng Anh, khác envelope) - cân nhắc chuẩn hóa.
- UI: window.prompt/confirm, thiếu điều hướng bàn phím, chưa test trình duyệt (Dev đã nêu) - chấp nhận cho đợt này, nên xử lý ở T-010/a11y.
- Không có API đổi slug sau khi tạo: Owner có nêu "link cũ khi đổi slug trả 404", cần BA/Orchestrator xác nhận có thuộc đợt 1 không.

## VERDICT: APPROVE_RECOMMENDED (tư vấn; không phải GitHub approve). Không có BLOCKER/HIGH/MEDIUM.
SHA_REVIEWED: b59abca213bab7a389dd251bf614d9b0d93885e1 (HEAD nhánh 341adf2 chỉ thêm artefact .ai-team, ngoài phạm vi mã)
