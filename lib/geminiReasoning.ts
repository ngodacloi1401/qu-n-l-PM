import type { ReasoningEffort } from './aiProviders.js';
import { ThinkingLevel, type ThinkingConfig } from '@google/genai';

export function parseReasoningEffort(value: unknown): ReasoningEffort {
  return value === 'minimal' || value === 'medium' || value === 'high' ? value : 'low';
}

export function geminiThinkingConfig(model: string, effort: ReasoningEffort): { thinkingConfig: ThinkingConfig } {
  if (/^gemini-2\.5/i.test(model)) {
    const thinkingBudget = effort === 'high' ? 24_576 : effort === 'medium' ? 8_192 : 1_024;
    return { thinkingConfig: { thinkingBudget } };
  }
  const doesNotSupportMinimal = /^gemini-(?:3\.[78]|3\.1-pro)/i.test(model);
  const resolved = effort === 'minimal' && doesNotSupportMinimal ? 'low' : effort;
  const levels: Record<ReasoningEffort, ThinkingLevel> = {
    minimal: ThinkingLevel.MINIMAL,
    low: ThinkingLevel.LOW,
    medium: ThinkingLevel.MEDIUM,
    high: ThinkingLevel.HIGH,
  };
  return { thinkingConfig: { thinkingLevel: levels[resolved] } };
}
