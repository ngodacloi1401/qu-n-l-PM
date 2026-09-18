# Kiểm tra tracker Redmine AnyBIM

Ngày kiểm tra: 18/09/2026. Đọc đủ 6.650 issue có quyền truy cập, gồm issue đóng. Đọc chi tiết tối đa 3 issue gần cập nhật nhất của từng tracker có dữ liệu. Các trường dưới đây là trường xuất hiện trong dữ liệu issue, không phải cấu hình quản trị workflow.

| Tracker | Số issue | Mô tả trên Redmine | Trường tùy chỉnh xuất hiện |
|---|---:|---|---|
| Epic | 73 | Mô tả về một tính năng lớn | IssueGroup |
| User Story | 551 | Mô tả một yêu cầu cụ thể của user | Review, Document/Srs-Urd/Acceptance, Report By, IssueGroup |
| Enhancement/Improvement | 86 | Yêu cầu cải tiến so với hiện tại Tương đương User story | Review, Document/Srs-Urd/Acceptance, Report By, IssueGroup |
| Change request | 4 | Thay đổi từ Khách hàng hoặc PO so với thống nhất ban đầu Nó tương đương với user story và có thể là Epics | Review, Document/Srs-Urd/Acceptance, ProjectCode, IssueGroup |
| Implement | 1088 | Dành cho Dev code và test | Report By, Checklist DEV-CODE, DEV-Testing, ProjectCode, IssueGroup |
| Task | 2479 | Giành cho BA hoặc các công việc không cần test | Review, Report By, Code Optimizing, ProjectCode, IssueGroup |
| Test | 499 | Giành riêng cho QA để tesing cho Userstory | Review, ProjectCode, Checklist QA-TEST, IssueGroup |
| Defect(GapBA) | 0 | Lỗi phát sinh do yêu cầu sai, không rõ, hoặc thiết kế sai  Không phải do code sai |  |
| Bug | 1870 | Lỗi xuất hiện trong quá trình code (lập trình sai, logic sai) | Regression Bug, Not bug, Review, Report By, ProjectCode, Actual/Expect Result, Bugs_step_to_reproduce, IssueGroup |
| UI Design | 0 | Giành riêng cho team thiết kế giao diện |  |
| Ecosystem | 0 | Hệ sinh thái |  |
| System | 0 | Hệ thống |  |
| Subsystem | 0 | Phân hệ |  |
| Cluster | 0 | Cụm mô-đun |  |
| Module | 0 | Mô-đun |  |
| Feature | 0 | Tính năng |  |
| Function | 0 | Chức năng |  |

## Issue đã đọc chi tiết

- Epic: [#40756](https://redmine.anybim.vn/issues/40756), [#39077](https://redmine.anybim.vn/issues/39077), [#39076](https://redmine.anybim.vn/issues/39076)
- User Story: [#41048](https://redmine.anybim.vn/issues/41048), [#41045](https://redmine.anybim.vn/issues/41045), [#41035](https://redmine.anybim.vn/issues/41035)
- Enhancement/Improvement: [#40226](https://redmine.anybim.vn/issues/40226), [#38716](https://redmine.anybim.vn/issues/38716), [#37871](https://redmine.anybim.vn/issues/37871)
- Change request: [#40273](https://redmine.anybim.vn/issues/40273), [#40268](https://redmine.anybim.vn/issues/40268), [#40236](https://redmine.anybim.vn/issues/40236)
- Implement: [#40852](https://redmine.anybim.vn/issues/40852), [#40734](https://redmine.anybim.vn/issues/40734), [#40230](https://redmine.anybim.vn/issues/40230)
- Task: [#41092](https://redmine.anybim.vn/issues/41092), [#41091](https://redmine.anybim.vn/issues/41091), [#41090](https://redmine.anybim.vn/issues/41090)
- Test: [#41081](https://redmine.anybim.vn/issues/41081), [#41079](https://redmine.anybim.vn/issues/41079), [#41076](https://redmine.anybim.vn/issues/41076)
- Bug: [#41082](https://redmine.anybim.vn/issues/41082), [#41004](https://redmine.anybim.vn/issues/41004), [#40920](https://redmine.anybim.vn/issues/40920)

## OT
Có 21 issue có từ OT trong subject, tất cả thuộc Task. Tổng 30 lượt log, 110.5 giờ trong toàn bộ lịch sử đã đọc. Đây không phải tổng riêng tháng 09/2026.

Ứng dụng nhận diện từ OT trong subject (ví dụ [OT], OT - ..., không phân biệt hoa/thường), cộng giờ từ time entries theo ngày spent_on. Không cộng estimated_hours hoặc spent_hours của issue cha để tránh tính lặp. Issue không có lượt log trong khoảng ngày không tạo giờ OT.
