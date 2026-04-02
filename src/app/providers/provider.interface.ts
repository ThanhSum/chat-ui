export type ProviderName =
  | 'openai'
  | 'gemini'
  | 'groq'
  | 'openrouter'
  | 'ollama'
  | 'anthropic';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface SendMessageParams {
  provider: ProviderName;
  model: string;
  messages: Message[];
  apiKey: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

export interface AIProvider {
  sendMessage(params: SendMessageParams): AbortController;
}

export const PROVIDER_LABELS: Record<ProviderName, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  groq: 'Groq',
  openrouter: 'OpenRouter',
  ollama: 'Ollama (Local)',
};

export const STATIC_MODELS: Record<Exclude<ProviderName, 'ollama' | 'openrouter'>, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3', 'o4-mini'],
  anthropic: ['claude-opus-4-6', 'claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-3-5'],
  gemini: ['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-1.5-pro'],
  groq: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
};
