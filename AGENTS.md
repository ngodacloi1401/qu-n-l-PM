# Quy định Hoạt động Dự án AnyBIM PM Workspace (AGENTS.md)

Chào mừng bạn đến với dự án quản lý tiến độ và công việc tích hợp AnyBIM Redmine.

## Nguyên tắc Tối thượng: Quy trình Chuẩn Doanh nghiệp (BA & Dev Workflow)

Mỗi khi người dùng đưa ra yêu cầu mới, bạn **BẮT BUỘC** phải tuân theo quy trình chuẩn 3 giai đoạn:

1. **[BA Perspective] - Đọc Skill `ba-role`**:
   - Thấu hiểu bài toán cốt lõi, giá trị mang lại cho người dùng, phạm vi (In-scope vs Out-of-scope).
   - Phân tích hiện trạng (As-Is) và đích đến (To-Be).
   - Phân tích 3 luồng: Happy path, Sad path, Edge cases.
   - **Chủ động đặt câu hỏi làm rõ (Clarification Questions)** nếu có điểm mơ hồ hoặc có nhiều lựa chọn triển khai.
   - Thiết lập bộ tiêu chí nghiệm thu (Acceptance Criteria - AC).
2. **[Implementation Plan] - Lên Kế hoạch Triển khai**:
   - Vạch rõ danh sách file can thiệp, luồng dữ liệu, đánh giá rủi ro hồi quy (Regression risk).
3. **[Dev Perspective] - Đọc Skill `dev-role`**:
   - Thực thi code sạch, chuẩn TypeScript strict, tuân thủ UI/UX design tokens.
   - Chạy `tsc --noEmit` và test suite `node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts` (Zero Regressions).
   - Đối chiếu nghiệm thu đầy đủ các tiêu chí AC trước khi báo cáo hoàn thành.

---

## Danh mục Skills & Rules trong Dự án
- **Skill BA**: [SKILL.md](file:///d:/app/.agents/skills/ba-role/SKILL.md)
- **Skill Dev**: [SKILL.md](file:///d:/app/.agents/skills/dev-role/SKILL.md)
- **Skill Redmine**: [SKILL.md](file:///d:/app/.agents/skills/redmine/SKILL.md)
- **Quy trình SDLC**: [company_sdlc_process.md](file:///d:/app/.agents/rules/company_sdlc_process.md)
