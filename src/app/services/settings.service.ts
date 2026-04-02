import { Injectable, signal, effect, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { ProviderName } from '../providers/provider.interface';

export interface AppSettings {
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  darkMode: boolean;
  fontSize: 'sm' | 'md' | 'lg';
  ollamaBaseUrl: string;
}

const SETTINGS_KEY = 'chatui_settings';
const API_KEY_PREFIX = 'chatui_apikey_';

const DEFAULTS: AppSettings = {
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: '',
  darkMode: true,
  fontSize: 'md',
  ollamaBaseUrl: 'http://localhost:11434',
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private storage = inject(StorageService);

  settings = signal<AppSettings>(
    this.storage.get<AppSettings>(SETTINGS_KEY) ?? { ...DEFAULTS }
  );

  apiKeys = signal<Partial<Record<ProviderName, string>>>(
    this.loadApiKeys()
  );

  constructor() {
    effect(() => {
      this.storage.set(SETTINGS_KEY, this.settings());
    });

    effect(() => {
      this.saveApiKeys(this.apiKeys());
    });

    effect(() => {
      const s = this.settings();
      const root = document.documentElement;
      root.classList.toggle('dark', s.darkMode);
      document.body.classList.toggle('light', !s.darkMode);
      root.classList.remove('font-sm', 'font-md', 'font-lg');
      root.classList.add(`font-${s.fontSize}`);
    });
  }

  updateSettings(patch: Partial<AppSettings>): void {
    this.settings.update(s => ({ ...s, ...patch }));
  }

  setApiKey(provider: ProviderName, key: string): void {
    const trimmed = key.trim();
    this.apiKeys.update(keys => ({ ...keys, [provider]: trimmed }));
  }

  getApiKey(provider: ProviderName): string {
    return (this.apiKeys()[provider] ?? '').trim();
  }

  private loadApiKeys(): Partial<Record<ProviderName, string>> {
    const providers: ProviderName[] = ['openai', 'anthropic', 'gemini', 'groq', 'openrouter', 'ollama'];
    const result: Partial<Record<ProviderName, string>> = {};
    for (const p of providers) {
      const k = this.storage.get<string>(`${API_KEY_PREFIX}${p}`);
      if (k) result[p] = k;
    }
    return result;
  }

  private saveApiKeys(keys: Partial<Record<ProviderName, string>>): void {
    const providers: ProviderName[] = ['openai', 'anthropic', 'gemini', 'groq', 'openrouter', 'ollama'];
    for (const p of providers) {
      if (keys[p]) {
        this.storage.set(`${API_KEY_PREFIX}${p}`, keys[p]!);
      } else {
        this.storage.remove(`${API_KEY_PREFIX}${p}`);
      }
    }
  }
}
