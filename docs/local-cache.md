# Cache Redmine trên trình duyệt

- IndexedDB `redmine-pm-cache` lưu danh sách issue, giờ công theo khoảng ngày và báo cáo OT. Khóa cache phân biệt URL Redmine và dấu băm API key; không lưu API key trong IndexedDB.
- Cache được hiển thị trước khi đồng bộ. Trong 60 giây, dữ liệu được dùng lại; nút tải lại bỏ qua thời hạn này. Thời điểm dữ liệu được hiển thị trên màn hình.
- Khi đã tải hết một dự án, đồng bộ trong 24 giờ dùng `updated_on >= thời điểm bắt đầu lần đồng bộ trước - 2 phút`, gộp theo ID và kiểm tra tổng số issue. Tổng số không khớp sẽ tải lại đầy đủ. Sau 24 giờ tải lại toàn bộ. Danh sách có bộ lọc ngày hoặc chỉ tải một phần được tải lại theo truy vấn gốc.
- Tạo, sửa, xóa issue hoặc log giờ qua ứng dụng làm hết hạn cache. Thay đổi từ ứng dụng khác được kiểm tra trong lần tải sau thời hạn 60 giây hoặc khi bấm tải lại.
- OT dùng danh sách issue đã tải đầy đủ nếu có; nếu chưa có sẽ truy vấn `subject=~OT`, rồi kiểm tra từ OT trong subject ở phía ứng dụng. Giờ công được tải theo dự án và khoảng ngày, nối theo issue ID. Không gọi chi tiết từng issue để tìm OT.
- Nút **Tải hết** không còn giới hạn 5000 issue. Nút **Xuất dữ liệu đã tải (JSON)** xuất đúng dữ liệu đã tải, ghi rõ số dòng đã tải và tổng số có trên Redmine. Muốn file đủ dữ liệu, chọn khoảng thời gian Tất cả và bấm Tải hết trước.
- Cache thuộc máy và trình duyệt đang sử dụng; không đồng bộ giữa các thiết bị. File JSON đặt trong workspace có thể được đọc và xử lý trực tiếp.

## Độ ưu tiên

Tracker là loại công việc (Task, Bug, Epic...). Priority là mức ưu tiên riêng. API danh mục hiện trả Must Have, Should Have, Could Have, Won't Have; các issue cũ vẫn có Low, Normal, High, Urgent, Immediate. Bộ lọc kết hợp danh mục hiện hành với mức ưu tiên quan sát từ issue đã tải. Khi sửa issue, giữ được giá trị cũ và chỉ gửi priority_id nếu người dùng thay đổi; tạo mới dùng danh mục hiện hành.
