export async function readIssueListResponse(res: Response) {
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { /* Serverless startup errors are plain text. */ }
  if (!res.ok) {
    const messages: Record<number, string> = {
      401: 'Redmine API Key không hợp lệ (HTTP 401). Kiểm tra khóa trong Cài đặt.',
      403: 'Tài khoản không có quyền xem công việc của dự án (HTTP 403).',
      404: 'Không tìm thấy API công việc hoặc dự án (HTTP 404). Kiểm tra URL Redmine trong Cài đặt.',
      429: 'Redmine đang giới hạn lượt gọi (HTTP 429). Hãy thử lại sau.',
      500: 'API ứng dụng gặp lỗi máy chủ (HTTP 500). Hãy thử lại sau khi bản triển khai cập nhật.',
      502: 'Máy chủ ứng dụng không kết nối được Redmine (HTTP 502).',
      503: 'Dịch vụ công việc tạm thời không khả dụng (HTTP 503).',
      504: 'Tải công việc vượt thời gian chờ (HTTP 504). Hãy thử lại.',
    };
    throw new Error(messages[res.status] || `Lỗi khi tải danh sách công việc (HTTP ${res.status}).`);
  }
  if (!Array.isArray(data?.issues) || !Number.isInteger(data?.total_count) || data.total_count < 0) {
    throw new Error('API công việc trả về dữ liệu không hợp lệ. Kiểm tra bản triển khai máy chủ.');
  }
  return { issues: data.issues, total_count: data.total_count };
}
