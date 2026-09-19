export interface GeminiTextModel {
  id: string;
  name: string;
  description: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
}

const UNSUITABLE_FOR_PM_CHAT = /(image|live|tts|transcribe|embedding|robotics|computer-use|aqa|veo|imagen|lyria)/i;

export async function listGeminiTextModels(apiKey: string): Promise<GeminiTextModel[]> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
    headers: { 'x-goog-api-key': apiKey },
  });
  if (!response.ok) throw Object.assign(new Error('Không thể tải danh sách model từ Gemini API'), { status: response.status });
  const data: any = await response.json();
  return (Array.isArray(data.models) ? data.models : [])
    .filter((item: any) => Array.isArray(item.supportedGenerationMethods) && item.supportedGenerationMethods.includes('generateContent'))
    .map((item: any) => ({
      id: String(item.baseModelId || item.name || '').replace(/^models\//, ''),
      name: String(item.displayName || item.baseModelId || item.name || '').replace(/^models\//, ''),
      description: String(item.description || ''),
      inputTokenLimit: Number(item.inputTokenLimit) || undefined,
      outputTokenLimit: Number(item.outputTokenLimit) || undefined,
    }))
    .filter((item: GeminiTextModel) => item.id.startsWith('gemini-') && !UNSUITABLE_FOR_PM_CHAT.test(item.id))
    .filter((item: GeminiTextModel, index: number, rows: GeminiTextModel[]) => rows.findIndex(row => row.id === item.id) === index)
    .sort((a: GeminiTextModel, b: GeminiTextModel) => b.id.localeCompare(a.id, undefined, { numeric: true }));
}
