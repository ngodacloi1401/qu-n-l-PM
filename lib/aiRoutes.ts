import type { Express, Request, Response } from 'express';
import { createPMChatPrompt } from './geminiChat.js';
import { generateAnthropicResponse, generateOpenAIResponse, listAnthropicModels, listOpenAICodexModels, listOpenAIModels, type AIProvider } from './aiProviders.js';

function providerKey(req: Request, provider: AIProvider) {
  if (provider === 'openai' || provider === 'codex') return ((req.headers['x-openai-api-key'] as string | undefined)?.trim() || process.env.OPENAI_API_KEY || '').trim();
  return ((req.headers['x-anthropic-api-key'] as string | undefined)?.trim() || process.env.ANTHROPIC_API_KEY || '').trim();
}

function providerLabel(provider: AIProvider) {
  return provider === 'openai' ? 'OpenAI / ChatGPT' : provider === 'codex' ? 'OpenAI Codex' : 'Anthropic / Claude';
}

function parseProvider(value: unknown): AIProvider | undefined {
  return value === 'openai' || value === 'codex' || value === 'anthropic' ? value : undefined;
}

export function registerProviderAIRoutes(app: Express) {
  app.get('/api/ai/models', async (req: Request, res: Response) => {
    const provider = parseProvider(req.query.provider);
    if (!provider) return res.status(400).json({ error: 'Nhà cung cấp AI không hợp lệ.' });
    const apiKey = providerKey(req, provider);
    if (!apiKey) return res.status(400).json({ error: `Chưa cấu hình ${providerLabel(provider)} API Key.` });
    try {
      const models = provider === 'openai' ? await listOpenAIModels(apiKey) : provider === 'codex' ? await listOpenAICodexModels(apiKey) : await listAnthropicModels(apiKey);
      return res.json({ models });
    } catch (error: any) {
      return res.status(Number(error?.status) || 502).json({ error: error?.message || `Không thể tải danh sách model ${providerLabel(provider)}.` });
    }
  });

  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    const provider = parseProvider(req.body?.provider);
    if (!provider) return res.status(400).json({ error: 'Nhà cung cấp AI không hợp lệ.' });
    const apiKey = providerKey(req, provider);
    if (!apiKey) return res.status(400).json({ error: `Chưa cấu hình ${providerLabel(provider)} API Key trong Cài đặt.` });
    let chat: ReturnType<typeof createPMChatPrompt>;
    try { chat = createPMChatPrompt(req.body); }
    catch (error: any) { return res.status(400).json({ error: error.message }); }

    const primaryModel = typeof req.body?.model === 'string' && req.body.model.trim() ? req.body.model.trim() : (provider === 'codex' ? 'gpt-5.3-codex' : provider === 'openai' ? 'gpt-5.6-terra' : 'claude-sonnet-4-6');
    const availableModels = Array.isArray(req.body?.context?.availableModels)
      ? req.body.context.availableModels.filter((id: any) => typeof id === 'string' && id.trim()).slice(0, 100)
      : [];
    const candidates = [primaryModel, ...availableModels.filter((id: string) => id !== primaryModel)].slice(0, 4);
    let lastError: any;
    for (const candidate of candidates) {
      try {
        const result = provider === 'anthropic'
          ? await generateAnthropicResponse(apiKey, candidate, chat.systemInstruction, chat.messages)
          : await generateOpenAIResponse(apiKey, candidate, chat.systemInstruction, chat.messages);
        return res.json({ result, usedModel: candidate, requestedModel: primaryModel, fallbackOccurred: candidate !== primaryModel });
      } catch (error: any) {
        lastError = error;
        if (![400, 404, 429, 500, 502, 503, 504].includes(Number(error?.status))) break;
      }
    }
    return res.status(Number(lastError?.status) || 502).json({ error: lastError?.message || `${providerLabel(provider)} không phản hồi được.` });
  });
}
