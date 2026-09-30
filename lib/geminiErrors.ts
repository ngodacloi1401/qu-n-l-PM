export function geminiErrorResponse(error: any) {
  const status = Number(error?.status || error?.code) || 500;
  const text = String(error?.message || '');
  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid/i.test(text)) return { status: 403, error: 'Gemini API Key không hợp lệ hoặc không có quyền sử dụng model. Kiểm tra khóa và quyền trong Google AI Studio.' };
  if (status === 429) return { status, error: 'Gemini đã hết quota hoặc vượt giới hạn lượt gọi. Kiểm tra quota trong Google AI Studio và thử lại sau.' };
  if (status === 404) return { status, error: 'Model Gemini đã chọn không tồn tại hoặc khóa chưa có quyền truy cập model này. Chọn model khác rồi thử lại.' };
  if (status === 504 || /timeout|timed out|aborted/i.test(text)) return { status: 504, error: 'Gemini phản hồi vượt thời gian chờ. Hãy thử lại hoặc chọn model nhanh hơn.' };
  if (status === 400) return { status, error: 'Gemini từ chối yêu cầu báo cáo. Kiểm tra model đã chọn và cấu hình API trong Google AI Studio.' };
  if (status === 500) return { status, error: 'Máy chủ Gemini gặp lỗi nội bộ (500). Hãy thử lại hoặc chọn model khác.' };
  if (status === 503) return { status, error: 'Dịch vụ Gemini tạm thời quá tải hoặc bảo trì (503). Hãy thử lại sau ít phút.' };
  if (/ECONNREFUSED|ENOTFOUND|fetch failed|network/i.test(text)) return { status: 502, error: 'Không kết nối được máy chủ Gemini. Kiểm tra kết nối mạng và thử lại.' };
  return { status: 502, error: `Dịch vụ Gemini không phản hồi (HTTP ${status}). Hãy thử lại hoặc chọn model khác.` };
}
