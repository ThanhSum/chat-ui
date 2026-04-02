import { Injectable, signal, computed, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { SettingsService } from './settings.service';
import { ProviderName } from '../providers/provider.interface';
import { getProvider } from '../providers/provider.index';

export interface OllamaModelMeta {
  parameterSize: string;
  sizeGb: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  durationMs?: number;
  editedAt?: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  provider: ProviderName;
  model: string;
  systemPrompt?: string;
  createdAt: number;
  updatedAt: number;
}

const CONVERSATIONS_KEY = 'chatui_conversations';
const MAX_CONVERSATIONS = 50;

@Injectable({ providedIn: 'root' })
export class ChatService {
  private storage = inject(StorageService);
  private settingsSvc = inject(SettingsService);

  conversations = signal<Conversation[]>(
    this.storage.get<Conversation[]>(CONVERSATIONS_KEY) ?? []
  );
  activeConversationId = signal<string | null>(null);
  isStreaming = signal<boolean>(false);
  error = signal<string | null>(null);
  ollamaModels = signal<string[]>([]);
  ollamaOnline = signal<boolean>(false);
  ollamaModelMeta = signal<Record<string, OllamaModelMeta>>({});
  openRouterModels = signal<string[]>([]);

  selectedProvider = signal<ProviderName>('openai');
  selectedModel = signal<string>('gpt-4o');

  activeConversation = computed<Conversation | null>(() => {
    const id = this.activeConversationId();
    return this.conversations().find(c => c.id === id) ?? null;
  });

  private abortController: AbortController | null = null;

  constructor() {
    this.checkOllama();
    this.fetchOpenRouterModels();
  }

  newConversation(): void {
    const id = crypto.randomUUID();
    const conv: Conversation = {
      id,
      title: 'New Chat',
      messages: [],
      provider: this.selectedProvider(),
      model: this.selectedModel(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.conversations.update(cs => [conv, ...cs]);
    this.activeConversationId.set(id);
    this.error.set(null);
    this.persist();
  }

  selectConversation(id: string): void {
    this.activeConversationId.set(id);
    this.error.set(null);
    const conv = this.conversations().find(c => c.id === id);
    if (conv) {
      this.selectedProvider.set(conv.provider);
      this.selectedModel.set(conv.model);
    }
  }

  applySelectionToActiveConversation(): void {
    const id = this.activeConversationId();
    if (id == null) return;
    const p = this.selectedProvider();
    const m = this.selectedModel();
    this.updateConversation(id, c => ({ ...c, provider: p, model: m, updatedAt: Date.now() }));
    this.persist();
  }

  deleteConversation(id: string): void {
    this.conversations.update(cs => cs.filter(c => c.id !== id));
    if (this.activeConversationId() === id) {
      const remaining = this.conversations();
      this.activeConversationId.set(remaining.length > 0 ? remaining[0].id : null);
    }
    this.persist();
  }

  clearMessages(): void {
    const id = this.activeConversationId();
    if (id == null) return;
    this.updateConversation(id, c => ({ ...c, messages: [], updatedAt: Date.now() }));
    this.persist();
  }

  setConversationSystemPrompt(convId: string, prompt: string): void {
    this.updateConversation(convId, c => ({ ...c, systemPrompt: prompt, updatedAt: Date.now() }));
    this.persist();
  }

  editUserMessage(convId: string, msgId: string, newContent: string): void {
    this.updateConversation(convId, c => {
      const idx = c.messages.findIndex(m => m.id === msgId);
      if (idx === -1) return c;
      return { ...c, messages: c.messages.slice(0, idx), updatedAt: Date.now() };
    });
    this.persist();
    this.sendMessage(newContent);
  }

  sendMessage(userText: string): void {
    const conv = this.activeConversation();
    if (!conv || this.isStreaming()) return;

    const s = this.settingsSvc.settings();
    const apiKey = this.settingsSvc.getApiKey(conv.provider);
    const effectiveSystemPrompt = (conv.systemPrompt !== undefined ? conv.systemPrompt : s.systemPrompt) || undefined;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    };

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    this.updateConversation(conv.id, c => ({
      ...c,
      messages: [...c.messages, userMsg, assistantMsg],
      title: c.messages.length === 0 ? userText.slice(0, 40) : c.title,
      updatedAt: Date.now(),
    }));

    this.isStreaming.set(true);
    this.error.set(null);

    const historyMessages = conv.messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    const allMessages = [...historyMessages, { role: 'user' as const, content: userText }];

    const effectiveApiKey = conv.provider === 'ollama'
      ? this.settingsSvc.settings().ollamaBaseUrl
      : apiKey;

    const streamStart = Date.now();

    const provider = getProvider(conv.provider);
    this.abortController = provider.sendMessage({
      provider: conv.provider,
      model: conv.model,
      messages: allMessages,
      apiKey: effectiveApiKey,
      systemPrompt: effectiveSystemPrompt,
      temperature: s.temperature,
      maxTokens: s.maxTokens,
      onChunk: (text) => {
        this.appendToLastMessage(conv.id, text);
      },
      onDone: () => {
        const durationMs = Date.now() - streamStart;
        this.updateConversation(conv.id, c => {
          const msgs = [...c.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant') {
            msgs[msgs.length - 1] = { ...last, durationMs };
          }
          return { ...c, messages: msgs };
        });
        this.isStreaming.set(false);
        this.abortController = null;
        this.persist();
      },
      onError: (err) => {
        this.isStreaming.set(false);
        this.abortController = null;
        this.error.set(err.message);
        this.updateConversation(conv.id, c => ({
          ...c,
          messages: c.messages.filter(m => m.id !== assistantMsg.id),
        }));
        this.persist();
      },
    });
  }

  stopStreaming(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.isStreaming.set(false);
    this.persist();
  }

  regenerateLastMessage(): void {
    const conv = this.activeConversation();
    if (!conv || this.isStreaming()) return;
    const msgs = conv.messages;
    if (msgs.length === 0 || msgs[msgs.length - 1].role !== 'assistant') return;
    const lastUserMsg = [...msgs].reverse().find(m => m.role === 'user');
    this.updateConversation(conv.id, c => ({ ...c, messages: c.messages.slice(0, -1) }));
    this.persist();
    if (lastUserMsg) this.sendMessage(lastUserMsg.content);
  }

  deleteMessage(convId: string, msgId: string): void {
    this.updateConversation(convId, c => ({
      ...c,
      messages: c.messages.filter(m => m.id !== msgId),
    }));
    this.persist();
  }

  async checkOllama(): Promise<void> {
    const base = this.settingsSvc.settings().ollamaBaseUrl;
    try {
      const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        const rawModels: any[] = data.models ?? [];
        const models: string[] = rawModels.map((m: any) => m.name as string);
        const meta: Record<string, OllamaModelMeta> = {};
        for (const m of rawModels) {
          meta[m.name as string] = {
            parameterSize: (m.details?.parameter_size as string) ?? '',
            sizeGb: m.size ? `${(m.size / 1e9).toFixed(1)} GB` : '',
          };
        }
        this.ollamaModels.set(models);
        this.ollamaModelMeta.set(meta);
        this.ollamaOnline.set(true);
        return;
      }
    } catch {}
    this.ollamaOnline.set(false);
    this.ollamaModels.set([]);
    this.ollamaModelMeta.set({});
  }

  async fetchOpenRouterModels(): Promise<void> {
    const apiKey = this.settingsSvc.getApiKey('openrouter');
    if (!apiKey) return;
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        const ids: string[] = (data.data ?? []).map((m: any) => m.id as string);
        this.openRouterModels.set(ids);
      }
    } catch {}
  }

  private updateConversation(id: string, updater: (c: Conversation) => Conversation): void {
    this.conversations.update(cs => cs.map(c => c.id === id ? updater(c) : c));
  }

  private appendToLastMessage(convId: string, text: string): void {
    this.conversations.update(cs =>
      cs.map(c => {
        if (c.id !== convId) return c;
        const msgs = [...c.messages];
        const last = msgs[msgs.length - 1];
        if (last && last.role === 'assistant') {
          msgs[msgs.length - 1] = { ...last, content: last.content + text };
        }
        return { ...c, messages: msgs };
      })
    );
  }

  private persist(): void {
    let convs = this.conversations();
    if (convs.length > MAX_CONVERSATIONS) {
      convs = convs.slice(0, MAX_CONVERSATIONS);
      this.conversations.set(convs);
    }
    this.storage.set(CONVERSATIONS_KEY, convs);
  }
}
