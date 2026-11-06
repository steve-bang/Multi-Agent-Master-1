# UX flows - vn-docs-platform (Đợt 1: REQ-003..008)
Ngôn ngữ UI: tiếng Việt (REQ-002, REQ-007). Không gồm đợt 2/3. Mục "[?]" = chờ BA (xem OPEN_QUESTIONS trong handoff).

## 1. Information architecture
| Khu vực | Route (đề xuất) | Truy cập | REQ |
|---|---|---|---|
| Đăng ký | /dang-ky | Khách | 003 |
| Đăng nhập | /dang-nhap | Khách | 003 |
| Danh sách space | /app | Đã đăng nhập | 003, 004 |
| Trình soạn space | /app/{space}/{page-slug} | Chủ space | 004, 005, 006 |
| Cài đặt space (tên, slug, xuất bản) | /app/{space}/cai-dat | Chủ space | 004, 006 |
| Trang đọc công khai | /{space-slug}/{page-slug} | Mọi người | 006, 007, 008 |
| 404 | mọi URL không hợp lệ/chưa xuất bản | Mọi người | 006 |

## 2. Đăng ký / đăng nhập (REQ-003)
```mermaid
flowchart TD
  A[Vào /dang-ky] --> B[Nhập email + mật khẩu REQ-003]
  B --> C{Email hợp lệ?}
  C -- Không --> E1[Lỗi inline: email không hợp lệ]
  C -- Có --> D{Email đã tồn tại?}
  D -- Có --> E2[Lỗi: email đã được đăng ký + link Đăng nhập]
  D -- Không --> F{Mật khẩu đạt quy tắc? ?}
  F -- Không --> E3[Lỗi inline mật khẩu]
  F -- Có --> G[Tạo tài khoản, tự đăng nhập] --> H[/app - trạng thái rỗng/]
  L[Vào /dang-nhap] --> M{Đúng email+mật khẩu?}
  M -- Có --> H
  M -- Không --> E4[Lỗi chung: không tiết lộ email nào tồn tại]
  M -- Sai nhiều lần --> E5[Thông báo tạm khóa ?]
  X[Khách vào /app/*] --> L2[Chuyển về /dang-nhap, giữ đích quay lại REQ-003]
```

## 3. Space và cây trang (REQ-004, REQ-007)
```mermaid
flowchart TD
  H[/app: danh sách space/] -->|rỗng| H0[Empty: Tạo space đầu tiên]
  H --> N[Nút Tạo space: tên] --> V{Tên rỗng?}
  V -- Có --> E1[Lỗi: nhập tên space]
  V -- Không --> S[Space tạo, slug bỏ dấu tự sinh REQ-007] --> T[Trình soạn với cây rỗng]
  T --> P[Thêm trang / nhóm: tiêu đề] --> PV{Tiêu đề rỗng?}
  PV -- Có --> E2[Lỗi: nhập tiêu đề]
  PV -- Không --> SL{Slug trùng? ?}
  SL -- Có --> SL2[Hậu tố -2 hoặc báo lỗi ?]
  SL -- Không --> TR[Trang hiện trong mục lục REQ-004]
  TR --> R[Đổi tên / Kéo thả hoặc Di chuyển lên-xuống-thụt lề]
  TR --> D[Xóa] --> DC{Có trang con?}
  DC -- Không --> DY[Dialog xác nhận] --> OK[Đã xóa]
  DC -- Có --> DD[Dialog nêu số trang con; quy tắc xử lý ?] --> OK
```

## 4. Soạn Markdown + xem trước (REQ-005)
```mermaid
flowchart TD
  T[Chọn trang] --> ED[Khung soạn Markdown + khung xem trước]
  ED --> TY[Gõ nội dung] --> PR[Xem trước cập nhật REQ-005]
  ED --> IMG[Chèn ảnh] --> IC{Hợp lệ? định dạng/dung lượng ?}
  IC -- Không --> E1[Lỗi ảnh: sai định dạng / quá lớn]
  IC -- Có --> UP[Đang tải lên] --> MD[Chèn cú pháp ảnh]
  TY --> SV[Lưu] --> SC{Thành công?}
  SC -- Có --> OK[Đã lưu HH:mm]
  SC -- Mất kết nối --> E2[Lỗi: chưa lưu, giữ nội dung, nút Thử lại]
  PR --> XS[HTML/script bị loại bỏ khi hiển thị và lưu REQ-005]
```
Rời trang khi có thay đổi chưa lưu: hộp xác nhận (beforeunload + dialog nội bộ).

## 5. Xuất bản và đọc công khai (REQ-006, 007, 008)
```mermaid
flowchart TD
  CS[Cài đặt space] --> PB[Công tắc Xuất bản] --> CF[Dialog xác nhận: URL công khai hiển thị]
  CF --> LIVE[Đã xuất bản: hiện URL + nút Sao chép]
  LIVE --> UNP[Gỡ xuất bản ?] --> G404
  G[Khách mở URL] --> PUB{Space đã xuất bản?}
  PUB -- Không --> G404[404 chung, không lộ nội dung REQ-006]
  PUB -- Có --> PG{Trang tồn tại?}
  PG -- Không --> G404
  PG -- Có --> RD[Trang đọc: mục lục trái, nội dung, Trước/Sau]
  RD --> SR[Ô tìm kiếm] --> Q{Có kết quả?}
  Q -- Có --> RES[Danh sách kết quả; 'cai dat' khớp 'Cài đặt' REQ-008]
  Q -- Không --> NR[Empty: Không tìm thấy kết quả]
  RD --> OLD[Slug cũ sau đổi slug ?]
```
