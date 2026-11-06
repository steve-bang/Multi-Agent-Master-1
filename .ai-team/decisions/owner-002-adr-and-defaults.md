# Quyết định của Project Owner - duyệt stack và bộ mặc định (2026-11-06)

Nguồn: tin nhắn Owner trong phiên Claude Code: "Đồng ý hết, theo nghiêng của bạn" (đáp lại đề xuất ADR-0001 và bộ mặc định chi tiết).

- ADR-0001: DUYỆT Node.js 20 + TypeScript + Fastify + SQLite (better-sqlite3, FTS5), render Markdown phía server.
- Ảnh: chỉ chèn bằng URL, không upload file ở đợt 1.
- Độ sâu cây trang tối đa: 4 cấp.
- Mật khẩu tối thiểu 8 ký tự; khóa đăng nhập 5 lần sai / 15 phút; đợt 1 chỉ có đăng xuất (không quên mật khẩu, không xác minh email).
- Xóa trang có trang con: xóa cả cây sau hộp thoại xác nhận nêu số trang con.
- Slug trùng trong space: tự thêm hậu tố -2, cho sửa trước khi lưu; đổi tiêu đề KHÔNG đổi slug.
- URL công khai /{space-slug}/{page-slug}; xuất bản theo cả space; có gỡ xuất bản; link cũ khi đổi slug trả 404; space chưa xuất bản trả 404.
- Lưu: nút Lưu thủ công kèm cảnh báo rời trang. Tìm kiếm: tiêu đề + nội dung, tối đa 20 kết quả, có đoạn trích. Không giao diện tối ở đợt 1.
