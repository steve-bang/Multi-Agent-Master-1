# Requirements: Nền tảng tài liệu kiểu GitBook cho thị trường Việt Nam

Source of idea: Owner message 2026-11-06: "làm 1 project giống như GitBook, thị trường là ở Việt Nam. Budget giới hạn 10% token."
Chỉ REQ-001, REQ-002 là CONFIRMED. Mọi thứ khác là ASSUMPTION, chờ Owner xác nhận.
Phân đợt: Đợt 1 = MVP nhỏ nhất (REQ-003..008); Đợt 2 = REQ-009..011; Đợt 3 = REQ-012..013.

### REQ-001 Sản phẩm giống GitBook
- Type: FR
- Statement: Sản phẩm là nền tảng soạn và xuất bản tài liệu/tri thức dạng sách-trang tương tự GitBook.
- Status: CONFIRMED
- Source: Owner message 2026-11-06
- Priority: Must
- Acceptance criteria:
  - Given Owner xem bản demo When so với các khả năng cốt lõi của GitBook trong REQ-003..008 Then các khả năng đó có mặt.
- Story: As a Owner I want một sản phẩm như GitBook so that phục vụ thị trường Việt Nam.

### REQ-002 Thị trường Việt Nam
- Type: NFR
- Statement: Sản phẩm nhắm tới người dùng ở Việt Nam (giao diện tiếng Việt; chi tiết ở REQ-007).
- Status: CONFIRMED (phạm vi chung); chi tiết cụ thể là ASSUMPTION
- Source: Owner message 2026-11-06
- Priority: Must
- Acceptance criteria:
  - Given người dùng Việt Nam When dùng sản phẩm Then toàn bộ luồng MVP dùng được bằng tiếng Việt.
- Story: As a người dùng VN I want sản phẩm phù hợp địa phương so that dùng dễ dàng.

### REQ-003 Tài khoản và đăng nhập
- Type: FR
- Statement: Người dùng đăng ký/đăng nhập bằng email + mật khẩu.
- Status: CONFIRMED (phạm vi: email + mật khẩu, nguồn Owner: .ai-team/decisions/owner-001-vn-docs-platform.md); chi tiết cụ thể là ASSUMPTION
- Source: BA đề xuất, chưa xác nhận
- Priority: Must
- Business rules: mật khẩu băm; chỉ chủ sở hữu sửa nội dung của mình.
- Edge cases: email trùng; sai mật khẩu nhiều lần; email không hợp lệ.
- Acceptance criteria:
  - Given email chưa tồn tại When đăng ký hợp lệ Then tạo tài khoản và đăng nhập được.
  - Given email đã tồn tại When đăng ký lại Then báo lỗi, không tạo trùng.
  - Given chưa đăng nhập When vào trang soạn thảo Then bị chuyển về trang đăng nhập.
- Story: As a tác giả I want có tài khoản so that quản lý tài liệu riêng.

### REQ-004 Không gian (space) và cấu trúc trang
- Type: FR
- Statement: Tác giả tạo space, thêm/sửa/xóa/sắp xếp trang và nhóm trang theo cây mục lục.
- Status: ASSUMPTION (thuộc đợt 1, phạm vi đợt 1 đã được Owner duyệt; chi tiết do BA đề xuất)
- Source: BA đề xuất
- Priority: Must
- Edge cases: xóa trang có trang con; tiêu đề trùng/rỗng; cây lồng sâu.
- Acceptance criteria:
  - Given đã đăng nhập When tạo space và trang Then trang hiện trong mục lục.
  - Given trang có trang con When xóa Then yêu cầu xác nhận và xử lý cả trang con theo quy tắc đã chọn.
- Story: As a tác giả I want tổ chức trang theo cây so that người đọc dễ điều hướng.

### REQ-005 Trình soạn thảo Markdown
- Type: FR
- Statement: Tác giả soạn nội dung bằng Markdown (tiêu đề, danh sách, code, bảng, ảnh) có xem trước.
- Status: CONFIRMED (phạm vi: Markdown + xem trước, nguồn Owner: .ai-team/decisions/owner-001-vn-docs-platform.md); chi tiết cụ thể là ASSUMPTION
- Source: BA đề xuất
- Priority: Must
- Edge cases: ảnh quá lớn/sai định dạng; HTML độc hại (XSS); mất kết nối khi lưu.
- Acceptance criteria:
  - Given đang soạn When nhập Markdown Then bản xem trước hiển thị đúng.
  - Given nội dung có script When lưu/hiển thị Then script bị loại bỏ.
- Story: As a tác giả I want soạn Markdown so that viết nhanh.

### REQ-006 Xuất bản và đọc công khai
- Type: FR
- Statement: Space có thể xuất bản công khai tại URL cố định; người đọc xem không cần đăng nhập, có mục lục và điều hướng.
- Status: CONFIRMED (phạm vi: chỉ công khai ở MVP, nguồn Owner: .ai-team/decisions/owner-001-vn-docs-platform.md); chi tiết cụ thể là ASSUMPTION
- Source: BA đề xuất
- Priority: Must
- Edge cases: trang chưa xuất bản truy cập trực tiếp; đổi slug; trang 404.
- Acceptance criteria:
  - Given space đã xuất bản When khách mở URL Then đọc được nội dung và mục lục.
  - Given space chưa xuất bản When khách mở URL Then nhận 404/không có quyền, không lộ nội dung.
- Story: As a người đọc I want đọc tài liệu công khai so that không cần tài khoản.

### REQ-007 Giao diện tiếng Việt và Unicode
- Type: NFR
- Statement: UI mặc định tiếng Việt; hỗ trợ Unicode/dấu đầy đủ, slug URL bỏ dấu.
- Status: CONFIRMED (phạm vi: giao diện tiếng Việt, nguồn Owner: .ai-team/decisions/owner-001-vn-docs-platform.md); chi tiết cụ thể là ASSUMPTION
- Source: BA suy ra từ REQ-002
- Priority: Must
- Edge cases: tiêu đề có dấu tạo slug; tìm kiếm không dấu.
- Acceptance criteria:
  - Given tiêu đề "Hướng dẫn cài đặt" When tạo trang Then slug là "huong-dan-cai-dat" và hiển thị đúng dấu.
- Story: As a người dùng VN I want giao diện tiếng Việt so that dễ dùng.

### REQ-008 Tìm kiếm trong space
- Type: FR
- Statement: Người đọc tìm trang theo từ khóa, kể cả gõ không dấu.
- Status: ASSUMPTION (thuộc đợt 1, phạm vi đợt 1 đã được Owner duyệt; chi tiết do BA đề xuất)
- Source: BA đề xuất
- Priority: Should
- Acceptance criteria:
  - Given space có trang "Cài đặt" When tìm "cai dat" Then trang xuất hiện trong kết quả.
- Story: As a người đọc I want tìm kiếm so that nhanh tới nội dung.

### REQ-009 Phiên bản và lịch sử chỉnh sửa
- Type: FR
- Statement: Lưu lịch sử thay đổi trang và khôi phục bản cũ.
- Status: DEFERRED (backlog, Owner chỉ làm MVP: CLR-008)
- Source: BA đề xuất
- Priority: Should

### REQ-010 Cộng tác nhóm và phân quyền
- Type: FR
- Statement: Mời thành viên vào space với vai trò (chủ, biên tập, xem).
- Status: DEFERRED (backlog, Owner chỉ làm MVP: CLR-008)
- Source: BA đề xuất
- Priority: Should

### REQ-011 Tên miền riêng và chia sẻ riêng tư
- Type: FR
- Statement: Gắn tên miền riêng; space riêng tư chỉ truy cập qua link/đăng nhập.
- Status: DEFERRED (backlog, Owner chỉ làm MVP: CLR-008)
- Source: BA đề xuất
- Priority: Could

### REQ-012 Đồng bộ Git / import-export
- Type: FR
- Statement: Import/export Markdown, đồng bộ GitHub.
- Status: DEFERRED (backlog, Owner chỉ làm MVP: CLR-008)
- Source: BA đề xuất
- Priority: Could

### REQ-013 Gói trả phí và thanh toán nội địa
- Type: FR
- Statement: Gói dịch vụ có thu phí, thanh toán nội địa (VNPay/MoMo...).
- Status: DEFERRED (backlog, Owner chỉ làm MVP: CLR-008)
- Source: BA đề xuất
- Priority: Could

### REQ-014 Ràng buộc ngân sách token
- Type: NFR
- Statement: Phạm vi và quy trình phải giữ trong ngân sách ~10% token; ưu tiên MVP nhỏ, tài liệu ngắn.
- Status: CONFIRMED (10% token của phiên Claude Code hiện tại; gần ngưỡng thì dừng và báo Owner; nguồn Owner: .ai-team/decisions/owner-001-vn-docs-platform.md)
- Source: Owner message 2026-11-06
- Priority: Must
- Acceptance criteria:
  - Given kế hoạch đợt 1 When rà soát Then chỉ gồm REQ-003..008.
