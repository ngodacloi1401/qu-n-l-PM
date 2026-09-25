export type AIProvider = 'openai' | 'codex' | 'anthropic';

export interface ProviderModel {
  id: string;
  name: string;
  description: string;
}

const OPENAI_UNSUITABLE = /(image|realtime|audio|transcrib|tts|search|embedding|moderation|sora|codex)/i;

async function fetchOpenAIModelIds(apiKey: string): Promise<string[]> {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) throw Object.assign(new Error('Không thể tải danh sách model từ OpenAI API'), { status: response.status });
  const data: any = await response.json();
  return (Array.isArray(data.data) ? data.data : [])
    .map((item: any) => String(item?.id || ''))
    .filter(Boolean)
    .filter((id: string, index: number, rows: string[]) => rows.indexOf(id) === index);
}

export async function listOpenAIModels(apiKey: string): Promise<ProviderModel[]> {
  return (await fetchOpenAIModelIds(apiKey))
    .filter((id: string) => /^(gpt-|chatgpt-|o\d)/i.test(id) && !OPENAI_UNSUITABLE.test(id))
    .sort((a: string, b: string) => b.localeCompare(a, undefined, { numeric: true }))
    .map((id: string) => ({ id, name: id, description: 'Model có trong tài khoản OpenAI hiện tại' }));
}

export async function listOpenAICodexModels(apiKey: string): Promise<ProviderModel[]> {
  return (await fetchOpenAIModelIds(apiKey))
    .filter((id: string) => /codex/i.test(id) && !/(deprecated|embedding|image|audio|realtime)/i.test(id))
    .sort((a: string, b: string) => b.localeCompare(a, undefined, { numeric: true }))
    .map((id: string) => ({ id, name: id, description: 'Model Codex có trong tài khoản OpenAI hiện tại' }));
}

export async function listAnthropicModels(apiKey: string): Promise<ProviderModel[]> {
  const response = await fetch('https://api.anthropic.com/v1/models?limit=1000', {
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
  });
  if (!response.ok) throw Object.assign(new Error('Không thể tải danh sách model từ Anthropic API'), { status: response.status });
  const data: any = await response.json();
  return (Array.isArray(data.data) ? data.data : [])
    .map((item: any) => ({ id: String(item?.id || ''), name: String(item?.display_name || item?.id || ''), description: 'Model có trong tài khoản Anthropic hiện tại' }))
    .filter((item: ProviderModel) => item.id.startsWith('claude-'))
    .filter((item: ProviderModel, index: number, rows: ProviderModel[]) => rows.findIndex(row => row.id === item.id) === index)
    .sort((a: ProviderModel, b: ProviderModel) => b.id.localeCompare(a.id, undefined, { numeric: true }));
}

function responseError(provider: AIProvider, response: Response, detail: string) {
  const label = provider === 'anthropic' ? 'Anthropic' : provider === 'codex' ? 'OpenAI Codex' : 'OpenAI';
  const status = response.status;
  if (status === 401 || status === 403) return Object.assign(new Error(`${label} API Key không hợp lệ hoặc chưa có quyền sử dụng model.`), { status });
  if (status === 404) return Object.assign(new Error(`Model ${label} đã chọn không tồn tại hoặc API key chưa có quyền truy cập.`), { status });
  if (status === 429) return Object.assign(new Error(`${label} đã hết quota hoặc vượt giới hạn lượt gọi.`), { status });
  return Object.assign(new Error(detail || `${label} API không phản hồi được.`), { status: status || 502 });
}

async function fetchAI(url: string, init: RequestInit) {
  try { return await fetch(url, { ...init, signal: AbortSignal.timeout(165_000) }); }
  catch (error: any) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw Object.assign(new Error('Nhà cung cấp AI chưa trả lời trong thời gian cho phép. Hãy thử lại hoặc chọn model nhanh hơn.'), { status: 504 });
    }
    throw error;
  }
}

async function readEventStream(response: Response, onEvent: (event: any) => void) {
  if (!response.body) throw Object.assign(new Error('Nhà cung cấp AI không trả về luồng dữ liệu.'), { status: 502 });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || '';
    for (const block of blocks) {
      for (const line of block.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try { onEvent(JSON.parse(data)); } catch { /* Ignore keep-alive and malformed provider events. */ }
      }
    }
    if (done) break;
  }
  if (buffer.trim()) {
    for (const line of buffer.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue;
      try { onEvent(JSON.parse(line.slice(5).trim())); } catch { /* Ignore incomplete trailing events. */ }
    }
  }
}

export async function streamOpenAIResponse(apiKey: string, model: string, systemInstruction: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>, onText: (delta: string) => void, onReady?: () => void) {
  const response = await fetchAI('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, instructions: systemInstruction, input: messages, max_output_tokens: 4096, store: false, stream: true }),
  });
  if (!response.ok) {
    const data: any = await response.json().catch(() => ({}));
    throw responseError('openai', response, data?.error?.message);
  }
  onReady?.();
  let text = '';
  await readEventStream(response, event => {
    if (event?.type === 'response.output_text.delta' && typeof event.delta === 'string') { text += event.delta; onText(event.delta); }
    if (event?.type === 'error') throw Object.assign(new Error(event?.error?.message || 'OpenAI stream gặp lỗi.'), { status: 502 });
  });
  if (!text.trim()) throw Object.assign(new Error('OpenAI không trả về nội dung văn bản.'), { status: 502 });
  return text;
}

export async function streamAnthropicResponse(apiKey: string, model: string, systemInstruction: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>, onText: (delta: string) => void, onReady?: () => void) {
  const response = await fetchAI('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, system: systemInstruction, messages, max_tokens: 4096, stream: true }),
  });
  if (!response.ok) {
    const data: any = await response.json().catch(() => ({}));
    throw responseError('anthropic', response, data?.error?.message);
  }
  onReady?.();
  let text = '';
  await readEventStream(response, event => {
    const delta = event?.type === 'content_block_delta' && event?.delta?.type === 'text_delta' ? event.delta.text : '';
    if (typeof delta === 'string' && delta) { text += delta; onText(delta); }
    if (event?.type === 'error') throw Object.assign(new Error(event?.error?.message || 'Anthropic stream gặp lỗi.'), { status: 502 });
  });
  if (!text.trim()) throw Object.assign(new Error('Anthropic không trả về nội dung văn bản.'), { status: 502 });
  return text;
}

export async function generateOpenAIResponse(apiKey: string, model: string, systemInstruction: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>) {
  const response = await fetchAI('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, instructions: systemInstruction, input: messages, max_output_tokens: 4096, store: false }),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw responseError('openai', response, data?.error?.message);
  const text = typeof data.output_text === 'string'
    ? data.output_text
    : (Array.isArray(data.output) ? data.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : []).map((part: any) => part?.text).filter(Boolean).join('\n') : '');
  if (!text.trim()) throw Object.assign(new Error('OpenAI không trả về nội dung văn bản.'), { status: 502 });
  return text;
}

export async function generateAnthropicResponse(apiKey: string, model: string, systemInstruction: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>) {
  const response = await fetchAI('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, system: systemInstruction, messages, max_tokens: 4096 }),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw responseError('anthropic', response, data?.error?.message);
  const text = (Array.isArray(data.content) ? data.content : []).filter((part: any) => part?.type === 'text').map((part: any) => part.text).join('\n');
  if (!text.trim()) throw Object.assign(new Error('Anthropic không trả về nội dung văn bản.'), { status: 502 });
  return text;
}
