import { ProviderName, AIProvider } from './provider.interface';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';
import { GroqProvider } from './groq.provider';
import { OpenRouterProvider } from './openrouter.provider';
import { OllamaProvider } from './ollama.provider';

const providerInstances: Record<ProviderName, AIProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  gemini: new GeminiProvider(),
  groq: new GroqProvider(),
  openrouter: new OpenRouterProvider(),
  ollama: new OllamaProvider(),
};

export function getProvider(name: ProviderName): AIProvider {
  return providerInstances[name];
}
