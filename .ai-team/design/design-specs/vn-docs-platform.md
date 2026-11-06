# Design spec - vn-docs-platform (Đợt 1: REQ-003..008)
Chưa có design system trong repo -> định nghĩa tối thiểu dưới đây; đề nghị ghi ADR khi chọn stack (CLR-006). Phong cách kiểu GitBook: nền sáng, nhiều khoảng trắng, mục lục trái.

## 1. Token
| Nhóm | Token | Giá trị | Ghi chú tương phản trên #FFFFFF |
|---|---|---|---|
| Màu | bg / surface | #FFFFFF / #F9FAFB | |
| | text | #111827 | 17:1 |
| | text-muted | #4B5563 | 7.6:1 |
| | primary | #2563EB (hover #1D4ED8, active #1E40AF) | 5.2:1; chữ trắng trên primary đạt 5.2:1 |
| | border (ô nhập, 3:1) | #6B7280 | 4.8:1 |
| | border-subtle | #E5E7EB | chỉ trang trí |
| | error / error-bg | #B91C1C / #FEF2F2 | 6.5:1 |
| | success | #15803D | 5.0:1 |
| | focus ring | 2px #1D4ED8 + offset 2px | >= 3:1 |
| | disabled | chữ #6B7280 nền #F3F4F6 | trạng thái không bắt buộc đạt 4.5 |
| Chữ | font | Inter, "Be Vietnam Pro", system-ui, sans-serif (phải có subset vietnamese) | |
| | cỡ/dòng | 14/20 (phụ), 16/24 (thân UI), 18/30 (thân đọc), 24/32 (H2), 32/40 (H1) | thân 400, tiêu đề 600 |
| | code | ui-monospace, 14/22 | |
| Khoảng cách | scale | 4, 8, 12, 16, 24, 32, 48 px | |
| Bo góc | | 6px (control), 8px (card/dialog) | |
| Kích thước | control cao | 40px (nút/ô nhập), vùng chạm >= 44px trên mobile | WCAG 2.5.8 |
| Chuyển động | | 150ms ease-out; tắt khi prefers-reduced-motion | |

## 2. Thành phần và trạng thái
| Thành phần | Default | Hover | Focus | Disabled | Loading | Empty | Error |
|---|---|---|---|---|---|---|---|
| Nút chính | nền primary, chữ trắng 16/24 | #1D4ED8 | ring focus | #F3F4F6, con trỏ not-allowed, aria-disabled | spinner + chữ "Đang xử lý...", chặn bấm lại | - | - |
| Nút phụ | viền #6B7280, nền trắng | nền #F3F4F6 | ring | như trên | như trên | - | - |
| Ô nhập (email, mật khẩu, tiêu đề) | viền #6B7280, nhãn luôn hiện phía trên | viền #111827 | ring + viền primary | nền #F3F4F6 | - | placeholder #4B5563 | viền #B91C1C, biểu tượng + thông báo dưới ô, aria-describedby, aria-invalid |
| Mật khẩu | có nút Hiện/Ẩn (aria-pressed) | | | | | | |
| Danh sách space (card) | tên, slug, trạng thái Đã xuất bản/Bản nháp (chữ + màu) | nổi bóng nhẹ | ring | - | skeleton 3 card | "Bạn chưa có space nào" + nút "Tạo space đầu tiên" | "Không tải được danh sách. Thử lại" |
| Cây trang (mục lục) | mục 14/20, thụt lề 16px/cấp, rộng 280px, nhóm có mũi tên | nền #F3F4F6, hiện nút "..." | ring; mục hiện tại aria-current="page" nền #EFF6FF | - | skeleton 5 dòng | "Chưa có trang. Thêm trang đầu tiên" | "Không tải được mục lục. Thử lại" |
| Menu "..." (Đổi tên, Thêm trang con, Lên, Xuống, Thụt lề, Xóa) | | | điều hướng phím mũi tên | | | | |
| Dialog xác nhận xóa | tiêu đề, mô tả, nút "Hủy" (focus mặc định) và "Xóa" (nền #B91C1C) | | focus bị nhốt, Esc = Hủy | | "Đang xóa..." | - | thông báo lỗi trong dialog |
| Trình soạn | 2 khung (soạn / xem trước), thanh công cụ: Đậm, Nghiêng, Tiêu đề, Danh sách, Code, Bảng, Ảnh | nút công cụ nền #F3F4F6 | ring | Lưu disabled khi không đổi | "Đang lưu..." | trang mới: placeholder "Bắt đầu viết bằng Markdown..." | xem mục 3 |
| Xem trước | cùng kiểu với trang đọc; aria-live="polite" không đọc từng ký tự (debounce 300ms) | | | | | "Xem trước sẽ hiện ở đây" | - |
| Công tắc Xuất bản | role="switch", nhãn "Xuất bản công khai" | | ring | | "Đang xuất bản..." | - | "Không thể xuất bản. Thử lại" |
| Ô tìm kiếm (trang đọc) | nhãn ẩn thị giác "Tìm trong tài liệu", placeholder "Tìm kiếm...", phím tắt "/" | | ring | | "Đang tìm..." | - | "Tìm kiếm tạm thời lỗi. Thử lại" |
| Kết quả tìm | tiêu đề (link) + đoạn trích, tối đa theo BA [?] | nền #F3F4F6 | ring | | | "Không tìm thấy kết quả cho "{từ khóa}"" | |
| Toast | góc dưới phải, role="status" (lỗi: role="alert"), tự tắt 5s (không tự tắt nếu lỗi) | | | | | | |

## 3. Chuỗi tiếng Việt (thông báo chính)
| Ngữ cảnh | Chuỗi |
|---|---|
| Email sai định dạng | Email không hợp lệ. Ví dụ: ten@congty.vn |
| Email trống / mật khẩu trống | Vui lòng nhập email. / Vui lòng nhập mật khẩu. |
| Mật khẩu yếu [quy tắc chờ BA] | Mật khẩu chưa đạt yêu cầu: {quy tắc}. |
| Email trùng | Email này đã được đăng ký. Đăng nhập hoặc dùng email khác. |
| Sai đăng nhập | Email hoặc mật khẩu không đúng. |
| Khóa tạm [chờ BA] | Bạn đã thử quá nhiều lần. Vui lòng thử lại sau {n} phút. |
| Cần đăng nhập | Vui lòng đăng nhập để tiếp tục. |
| Không có quyền | Bạn không có quyền chỉnh sửa nội dung này. |
| Tên/tiêu đề trống | Vui lòng nhập tên space. / Vui lòng nhập tiêu đề trang. |
| Xóa trang có con | Trang "{tên}" có {n} trang con. {hậu quả theo quy tắc BA}. Bạn có chắc muốn xóa? |
| Xóa trang không con | Xóa trang "{tên}"? Thao tác này không thể hoàn tác. |
| Ảnh lỗi | Ảnh không hợp lệ. Chỉ chấp nhận {định dạng}, tối đa {dung lượng}. |
| Lưu thành công / lỗi | Đã lưu lúc {HH:mm}. / Chưa lưu được. Nội dung của bạn vẫn được giữ. Thử lại. |
| Rời trang chưa lưu | Bạn có thay đổi chưa lưu. Rời đi sẽ mất các thay đổi này. |
| Xuất bản xác nhận / xong | Xuất bản space tại {URL}? Bất kỳ ai có đường dẫn đều đọc được. / Đã xuất bản. |
| 404 | Không tìm thấy trang. Trang không tồn tại hoặc chưa được xuất bản. (nút "Về trang chủ") |
| Lỗi mạng chung | Mất kết nối. Kiểm tra mạng và thử lại. |

Slug (REQ-007): chữ thường, bỏ dấu, đ->d, ký tự không phải a-z0-9 -> "-", gộp "-" liên tiếp, bỏ "-" đầu/cuối. Ví dụ "Hướng dẫn cài đặt" -> huong-dan-cai-dat. Cho phép sửa slug trước khi lưu. Tìm kiếm (REQ-008): chuẩn hóa không dấu + chữ thường ở cả từ khóa và dữ liệu.

## 4. Bố cục và responsive
| Màn hình | 360 | 768 | 1280 |
|---|---|---|---|
| Auth | 1 cột, thẻ full-width, padding 16 | thẻ giữa rộng 400 | như 768 |
| Trình soạn | Mục lục thành drawer (nút "Mục lục"); tab Soạn / Xem trước | Mục lục drawer; soạn + xem trước 2 cột 50/50 | Mục lục 280 cố định + soạn + xem trước 2 cột |
| Trang đọc | Thanh trên: logo, nút Mục lục, nút tìm; nội dung padding 16, rộng chữ tối đa 100% | Mục lục drawer; nội dung max 680 | Mục lục 280 trái, nội dung max 720 giữa, "Trước/Sau" cuối bài |
| Danh sách space | 1 cột card | 2 cột | 3 cột, max-width 1120 |
Bảng/code trong nội dung: cuộn ngang trong khung, không tràn trang. Không cuộn 2 chiều ở 320px (WCAG 1.4.10).

## 5. Truy cập (WCAG 2.2 AA)
- Tương phản chữ >= 4.5:1, thành phần UI/viền ô nhập/focus >= 3:1; không dùng màu làm tín hiệu duy nhất (trạng thái luôn kèm chữ/biểu tượng).
- Thứ tự focus theo thị giác: skip link "Bỏ qua tới nội dung" -> thanh trên -> mục lục -> nội dung. Focus luôn thấy, không bị header/dialog che (2.4.11).
- Form: label gắn for/id; lỗi qua aria-describedby + aria-invalid; khi submit lỗi đưa focus vào ô lỗi đầu tiên và có tóm tắt role="alert". autocomplete: email, current-password / new-password (3.3.8, cho phép trình quản lý mật khẩu và dán).
- Landmark: header, nav (aria-label "Mục lục"), main, search. Lang="vi" trên html; đoạn khác ngôn ngữ có lang riêng. Ảnh cần alt: ô "Mô tả ảnh" khi chèn.
- Cây trang: role="tree"/treeitem hoặc danh sách lồng nav với aria-expanded; phím mũi tên, Home/End. Sắp xếp phải có phương án không kéo thả (menu Lên/Xuống/Thụt lề) (2.5.7).
- Vùng chạm >= 44px mobile (tối thiểu 24px). Tôn trọng prefers-reduced-motion. Dialog: role="dialog" aria-modal, trả focus về nút gọi khi đóng.
- Nội dung Markdown dựng ra: heading phân cấp đúng, bảng có th scope, link phân biệt không chỉ bằng màu (gạch chân).
