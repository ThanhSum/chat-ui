# UI Elements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GitHub-style polish to three component areas: model selector (status dot + rich card), input bar (slash commands, system prompt pill, token counter), and message bubbles (square avatars, edit, timestamps, streaming badge, code blocks with line numbers).

**Architecture:** Targeted component upgrades — each of the five tasks is self-contained and touches only the listed files. No layout shell changes. Light/dark mode is preserved throughout using Tailwind's `dark:` variant (class-based, toggled via `html.dark`).

**Tech Stack:** Angular 17+ standalone components, Tailwind CSS v4 (custom dark variant), `highlight.js` for code, `marked` for markdown, `@angular/build:unit-test` (vitest runner) for tests.

---

## File Map

| File | Change |
|---|---|
| `src/app/services/chat.service.ts` | Add `OllamaModelMeta`, extend `ChatMessage`/`Conversation`, add `editUserMessage`, `clearMessages`, `setConversationSystemPrompt`, update `sendMessage` |
| `src/app/services/chat.service.spec.ts` | **Create** — service unit tests |
| `src/app/components/sidebar/model-selector/model-selector.component.ts` | Status dot, rich card dropdown for Ollama |
| `src/app/components/chat/input-bar/input-bar.component.ts` | System prompt pill, slash commands, token counter, toolbar |
| `src/app/components/chat/message-bubble/message-bubble.component.ts` | Square avatars, edit user messages, timestamps, streaming badge, assistant border |
| `src/styles.scss` | Rewrite code block styles for line numbers + lang dots; remove `.streaming-cursor` |

---

## Task 1: Extend ChatService — data model + new methods

**Files:**
- Modify: `src/app/services/chat.service.ts`
- Create: `src/app/services/chat.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/services/chat.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { ChatService } from './chat.service';
import { StorageService } from './storage.service';

const mockStorage = {
  get: () => null,
  set: () => {},
  remove: () => {},
};

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ChatService,
        { provide: StorageService, useValue: mockStorage },
      ],
    });
    service = TestBed.inject(ChatService);

    // Seed one conversation with two messages
    const convId = 'conv-1';
    service.conversations.set([{
      id: convId,
      title: 'Test',
      messages: [
        { id: 'msg-1', role: 'user', content: 'Hello', timestamp: 1000 },
        { id: 'msg-2', role: 'assistant', content: 'Hi', timestamp: 2000 },
        { id: 'msg-3', role: 'user', content: 'Follow up', timestamp: 3000 },
        { id: 'msg-4', role: 'assistant', content: 'Sure', timestamp: 4000 },
      ],
      provider: 'ollama',
      model: 'llama3.2',
      createdAt: 1000,
      updatedAt: 4000,
    }]);
    service.activeConversationId.set(convId);
  });

  describe('editUserMessage', () => {
    it('removes the target message and all messages after it', () => {
      service.editUserMessage('conv-1', 'msg-3', 'Edited follow up');
      const msgs = service.activeConversation()!.messages;
      // msg-3 and msg-4 are gone; editUserMessage also calls sendMessage which
      // needs a network — we just verify truncation happened before sendMessage
      expect(msgs.find(m => m.id === 'msg-3')).toBeUndefined();
      expect(msgs.find(m => m.id === 'msg-4')).toBeUndefined();
    });

    it('keeps messages before the edited message', () => {
      service.editUserMessage('conv-1', 'msg-3', 'Edited');
      const msgs = service.activeConversation()!.messages;
      expect(msgs.find(m => m.id === 'msg-1')).toBeTruthy();
      expect(msgs.find(m => m.id === 'msg-2')).toBeTruthy();
    });
  });

  describe('clearMessages', () => {
    it('empties the message list', () => {
      service.clearMessages();
      expect(service.activeConversation()!.messages.length).toBe(0);
    });

    it('does nothing when no active conversation', () => {
      service.activeConversationId.set(null);
      expect(() => service.clearMessages()).not.toThrow();
    });
  });

  describe('setConversationSystemPrompt', () => {
    it('stores the system prompt on the conversation', () => {
      service.setConversationSystemPrompt('conv-1', 'You are a pirate.');
      expect(service.activeConversation()!.systemPrompt).toBe('You are a pirate.');
    });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /Users/sumtran/Workspace/chat-ui && ng test --watch=false
```

Expected: failures because `editUserMessage`, `clearMessages`, `setConversationSystemPrompt`, and `systemPrompt` don't exist yet.

- [ ] **Step 3: Update ChatService**

Replace `src/app/services/chat.service.ts` with:

```ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { SettingsService } from './settings.service';
import { ProviderName } from '../providers/provider.interface';
import { getProvider } from '../providers/provider.index';

export interface OllamaModelMeta {
  parameterSize: string;   // e.g. "3.2B"
  sizeGb: string;          // e.g. "1.9 GB"
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  durationMs?: number;   // ms from first token to stream end (assistant only)
  editedAt?: number;     // unix ms of last user edit (user only)
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  provider: ProviderName;
  model: string;
  systemPrompt?: string;   // per-conversation override; falls back to global setting
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
    // Truncate to everything before the edited message, then re-send
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
        const models: string[] = (data.models ?? []).map((m: any) => m.name as string);
        const meta: Record<string, OllamaModelMeta> = {};
        for (const m of data.models ?? []) {
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
ng test --watch=false
```

Expected: all 5 new tests pass. Ignore any pre-existing `app.spec.ts` failures if present.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/chat.service.ts src/app/services/chat.service.spec.ts
git commit -m "feat: extend ChatService with model meta, editUserMessage, clearMessages, per-conv system prompt"
```

---

## Task 2: Model selector — status dot + rich card

**Files:**
- Modify: `src/app/components/sidebar/model-selector/model-selector.component.ts`

- [ ] **Step 1: Replace model-selector.component.ts**

```ts
import {
  Component, inject, computed, ChangeDetectionStrategy,
  signal, HostListener, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../../services/chat.service';
import { ProviderName, PROVIDER_LABELS, STATIC_MODELS } from '../../../providers/provider.interface';

@Component({
  selector: 'app-model-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-2 border-t border-gray-200 p-3 dark:border-gray-700">

      <!-- Provider -->
      <div>
        <label class="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">Provider</label>
        <div class="relative">
          <select
            [ngModel]="chat.selectedProvider()"
            (ngModelChange)="onProviderChange($event)"
            class="w-full appearance-none rounded border border-[#d1d9e0] bg-[#f6f8fa] py-2 pr-8 text-sm text-[#1f2328]
                   focus:border-[#388bfd] focus:outline-none
                   dark:border-[#30363d] dark:bg-[#161b22] dark:text-[#e6edf3] dark:focus:border-[#388bfd]"
            [class.pl-7]="chat.selectedProvider() === 'ollama'"
            [class.pl-3]="chat.selectedProvider() !== 'ollama'"
          >
            @for (p of providers; track p.value) {
              <option [value]="p.value">{{ p.label }}</option>
            }
          </select>

          @if (chat.selectedProvider() === 'ollama') {
            <span
              class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
              [class.bg-[#3fb950]]="chat.ollamaOnline()"
              [class.shadow-[0_0_4px_#3fb950]]="chat.ollamaOnline()"
              [class.bg-[#f85149]]="!chat.ollamaOnline()"
            ></span>
          }

          <svg class="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
               viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clip-rule="evenodd" />
          </svg>
        </div>

        @if (chat.selectedProvider() === 'ollama') {
          <p class="mt-1 text-[10px]"
             [class.text-[#3fb950]]="chat.ollamaOnline()"
             [class.text-[#f85149]]="!chat.ollamaOnline()">
            @if (chat.ollamaOnline()) {
              ● Connected · {{ chat.ollamaModels().length }} model{{ chat.ollamaModels().length === 1 ? '' : 's' }}
            } @else {
              ● Offline
            }
          </p>
        }
      </div>

      <!-- Model -->
      <div>
        <label class="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">Model</label>

        @if (chat.selectedProvider() === 'ollama') {
          <!-- Rich card dropdown for Ollama -->
          <div class="relative">
            <div
              (click)="modelDropdownOpen.set(!modelDropdownOpen())"
              class="w-full cursor-pointer rounded border border-[#d1d9e0] bg-[#f6f8fa] px-3 py-2 text-sm
                     hover:border-gray-400
                     dark:border-[#30363d] dark:bg-[#161b22] dark:hover:border-[#8b949e]"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="truncate font-semibold text-[#1f2328] dark:text-[#e6edf3]">
                    {{ chat.selectedModel() || 'No model selected' }}
                  </div>
                  @if (currentMeta(); as meta) {
                    <div class="text-[10px] text-[#656d76] dark:text-[#8b949e]">
                      {{ meta.parameterSize }}{{ meta.parameterSize && meta.sizeGb ? ' · ' : '' }}{{ meta.sizeGb }}
                    </div>
                  }
                </div>
                <svg class="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clip-rule="evenodd" />
                </svg>
              </div>
            </div>

            @if (modelDropdownOpen()) {
              <ul class="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-48 overflow-y-auto rounded border border-[#d1d9e0] bg-[#f6f8fa] shadow-lg dark:border-[#30363d] dark:bg-[#161b22]">
                @if (availableModels().length === 0) {
                  <li class="px-3 py-2 text-sm text-gray-500">No models available</li>
                }
                @for (m of availableModels(); track m) {
                  <li
                    (click)="selectOllamaModel(m)"
                    class="cursor-pointer px-3 py-2 text-sm hover:bg-[#eaeef2] dark:hover:bg-[#21262d]"
                    [class.bg-[#eaeef2]]="m === chat.selectedModel()"
                    [class.dark:bg-[#21262d]]="m === chat.selectedModel()"
                  >
                    <div class="font-medium text-[#1f2328] dark:text-[#e6edf3]">{{ m }}</div>
                    @if (getMeta(m); as meta) {
                      <div class="text-[10px] text-[#656d76] dark:text-[#8b949e]">
                        {{ meta.parameterSize }}{{ meta.parameterSize && meta.sizeGb ? ' · ' : '' }}{{ meta.sizeGb }}
                      </div>
                    }
                  </li>
                }
              </ul>
            }
          </div>

        } @else {
          <!-- Standard select for non-Ollama -->
          <div class="relative">
            <select
              [ngModel]="chat.selectedModel()"
              (ngModelChange)="onModelChange($event)"
              class="w-full appearance-none rounded border border-[#d1d9e0] bg-[#f6f8fa] px-3 py-2 pr-8 text-sm text-[#1f2328]
                     focus:border-[#388bfd] focus:outline-none
                     dark:border-[#30363d] dark:bg-[#161b22] dark:text-[#e6edf3]"
            >
              @for (m of availableModels(); track m) {
                <option [value]="m">{{ m }}</option>
              }
              @if (availableModels().length === 0) {
                <option value="" disabled>No models available</option>
              }
            </select>
            <svg class="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
                 viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clip-rule="evenodd" />
            </svg>
          </div>
        }
      </div>
    </div>
  `,
})
export class ModelSelectorComponent {
  chat = inject(ChatService);
  private el = inject(ElementRef);

  modelDropdownOpen = signal(false);

  providers: { value: ProviderName; label: string }[] = (
    Object.keys(PROVIDER_LABELS) as ProviderName[]
  ).map(k => ({ value: k, label: PROVIDER_LABELS[k] }));

  availableModels = computed<string[]>(() => {
    const p = this.chat.selectedProvider();
    if (p === 'ollama') return this.chat.ollamaModels();
    if (p === 'openrouter') return this.chat.openRouterModels();
    return STATIC_MODELS[p as keyof typeof STATIC_MODELS] ?? [];
  });

  currentMeta = computed(() =>
    this.chat.ollamaModelMeta()[this.chat.selectedModel()] ?? null
  );

  getMeta(modelName: string) {
    return this.chat.ollamaModelMeta()[modelName] ?? null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.el.nativeElement.contains(event.target as Node)) {
      this.modelDropdownOpen.set(false);
    }
  }

  onProviderChange(provider: ProviderName): void {
    this.modelDropdownOpen.set(false);
    this.chat.selectedProvider.set(provider);
    const models = this.availableModels();
    this.chat.selectedModel.set(models[0] ?? '');
    this.chat.applySelectionToActiveConversation();
  }

  onModelChange(model: string): void {
    this.chat.selectedModel.set(model);
    this.chat.applySelectionToActiveConversation();
  }

  selectOllamaModel(model: string): void {
    this.modelDropdownOpen.set(false);
    this.onModelChange(model);
  }
}
```

- [ ] **Step 2: Manual verification**

Run `ng serve`, open the app, switch provider to Ollama. Verify:
- Green dot + "Connected · N models" when Ollama is running
- Red dot + "Offline" when Ollama is stopped (`ollama stop` or kill the process)
- Clicking the model card opens a dropdown showing all models with param/size metadata
- Clicking outside closes the dropdown
- Switching to a non-Ollama provider shows the regular `<select>`

- [ ] **Step 3: Commit**

```bash
git add src/app/components/sidebar/model-selector/model-selector.component.ts
git commit -m "feat: add Ollama status dot and rich model card to model selector"
```

---

## Task 3: Input bar — system prompt pill, slash commands, token counter

**Files:**
- Modify: `src/app/components/chat/input-bar/input-bar.component.ts`

- [ ] **Step 1: Replace input-bar.component.ts**

```ts
import {
  Component, inject, ElementRef, ViewChild,
  ChangeDetectionStrategy, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../../services/chat.service';

interface SlashCommand {
  cmd: string;
  description: string;
  prefix: string;  // text prepended to input, or '' for action-only commands
}

const SLASH_COMMANDS: SlashCommand[] = [
  { cmd: '/explain', description: 'Explain this topic or code', prefix: 'Explain this: ' },
  { cmd: '/fix',     description: 'Fix bugs in code or text',   prefix: 'Fix the bugs in: ' },
  { cmd: '/clear',   description: 'Clear conversation history', prefix: '' },
  { cmd: '/system',  description: 'Edit system prompt',         prefix: '' },
];

@Component({
  selector: 'app-input-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
      <div class="mx-auto w-full min-w-0 max-w-2xl">

        @if (chat.error()) {
          <div class="mb-3 flex min-w-0 max-w-full items-start gap-2 overflow-hidden rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/50 dark:text-red-200">
            <span class="mt-0.5 shrink-0 text-red-500 dark:text-red-400">&#9888;</span>
            <span class="max-h-48 min-w-0 flex-1 overflow-y-auto break-all whitespace-pre-wrap leading-relaxed">{{ chat.error() }}</span>
            <button type="button" (click)="chat.error.set(null)"
                    class="ml-1 shrink-0 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200">&#10005;</button>
          </div>
        }

        @if (chat.selectedProvider() === 'ollama' && !chat.ollamaOnline()) {
          <div class="mb-3 rounded border border-yellow-600 bg-yellow-50 px-4 py-2 text-sm text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-200">
            &#9888; Ollama not detected — local models unavailable
          </div>
        }

        <!-- System prompt pill + ⌘K hint -->
        <div class="mb-2 flex items-center gap-2">
          <button
            (click)="toggleSystemPrompt()"
            class="flex items-center gap-1.5 rounded border border-[#d1d9e0] bg-[#f6f8fa] px-2 py-1 text-[11px] text-[#656d76]
                   hover:border-gray-400 hover:text-[#1f2328]
                   dark:border-[#30363d] dark:bg-[#161b22] dark:text-[#8b949e] dark:hover:border-[#8b949e] dark:hover:text-[#e6edf3]"
          >
            <svg class="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z"/>
            </svg>
            System prompt
            <span class="rounded bg-[#e8ecf0] px-1 py-0.5 text-[10px] text-[#1f2328] dark:bg-[#21262d] dark:text-[#8b949e]">
              {{ activeSystemPromptLabel() }}
            </span>
          </button>
          <span class="flex-1"></span>
          <span class="text-[11px] text-[#8b949e]">⌘K to search</span>
        </div>

        <!-- System prompt inline editor (expanded) -->
        @if (systemPromptOpen()) {
          <div class="mb-2 rounded border border-[#d1d9e0] bg-[#f6f8fa] p-2 dark:border-[#30363d] dark:bg-[#161b22]">
            <textarea
              [(ngModel)]="systemPromptText"
              rows="3"
              placeholder="You are a helpful assistant..."
              class="w-full resize-none bg-transparent text-sm text-[#1f2328] outline-none placeholder:text-gray-400
                     dark:text-[#e6edf3] dark:placeholder:text-gray-600"
            ></textarea>
            <div class="mt-1.5 flex justify-end gap-2">
              <button (click)="cancelSystemPrompt()"
                      class="rounded px-2 py-1 text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
                Cancel
              </button>
              <button (click)="saveSystemPrompt()"
                      class="rounded bg-[#238636] px-2 py-1 text-xs text-white hover:bg-[#2ea043]">
                Save
              </button>
            </div>
          </div>
        }

        <!-- Main input -->
        <div class="relative">
          <!-- Slash command popup -->
          @if (slashMenuVisible() && filteredCommands().length > 0) {
            <div class="absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded border border-[#d1d9e0] bg-[#f6f8fa] shadow-lg dark:border-[#30363d] dark:bg-[#161b22]">
              @for (c of filteredCommands(); track c.cmd; let i = $index) {
                <div
                  (click)="applySlashCommand(c)"
                  class="cursor-pointer px-3 py-2 hover:bg-[#eaeef2] dark:hover:bg-[#21262d]"
                  [class.bg-[#eaeef2]]="i === 0"
                  [class.dark:bg-[#21262d]]="i === 0"
                >
                  <span class="text-sm font-semibold text-[#388bfd]">{{ c.cmd }}</span>
                  <span class="ml-2 text-xs text-[#656d76] dark:text-[#8b949e]">{{ c.description }}</span>
                </div>
              }
            </div>
          }

          <!-- Input box -->
          <div class="flex flex-col rounded border border-[#d1d9e0] bg-white transition-colors
                      focus-within:border-[#388bfd]
                      dark:border-[#30363d] dark:bg-[#0d1117] dark:focus-within:border-[#388bfd]">
            <textarea
              #textarea
              [(ngModel)]="inputText"
              (input)="autoResize()"
              (keydown.enter)="onEnter($any($event))"
              (keydown.escape)="slashMenuOpen.set(false)"
              [disabled]="chat.isStreaming()"
              placeholder="Message... (type / for commands)"
              rows="1"
              class="max-h-48 min-h-10 flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-normal
                     text-gray-900 outline-none placeholder:text-gray-400
                     disabled:opacity-50 dark:text-gray-100 dark:placeholder:text-gray-500"
            ></textarea>

            <!-- Toolbar -->
            <div class="flex items-center gap-2 border-t border-[#eaeef2] px-3 py-1.5 dark:border-[#21262d]">
              <span class="text-xs text-[#8b949e]">↵ Send · ⇧↵ Newline</span>
              <span class="flex-1"></span>
              <span class="text-xs" [class.text-[#8b949e]]="!tokenWarning()" [class.text-[#d29922]]="tokenWarning()">
                ~{{ tokenCount() }} tokens
              </span>

              @if (chat.isStreaming()) {
                <button (click)="stop()"
                        class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-red-600 transition-colors hover:bg-red-500"
                        title="Stop">
                  <span class="block h-2.5 w-2.5 rounded-sm bg-white"></span>
                </button>
              } @else {
                <button (click)="send()"
                        [disabled]="!inputText.trim() || !chat.activeConversation()"
                        class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-[#238636] transition-colors
                               hover:bg-[#2ea043] disabled:cursor-not-allowed disabled:opacity-30"
                        title="Send">
                  <svg class="h-4 w-4 rotate-90 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              }
            </div>
          </div>
        </div>

      </div>
    </div>
  `,
})
export class InputBarComponent {
  @ViewChild('textarea') textareaRef!: ElementRef<HTMLTextAreaElement>;

  chat = inject(ChatService);
  inputText = '';
  systemPromptText = '';
  systemPromptOpen = signal(false);
  slashMenuOpen = signal(false);

  slashMenuVisible = computed(() => this.inputText.startsWith('/') && this.inputText.length >= 1);

  filteredCommands = computed(() => {
    const q = this.inputText.toLowerCase();
    return SLASH_COMMANDS.filter(c => c.cmd.startsWith(q));
  });

  tokenCount = computed(() => Math.round(this.inputText.length / 4));

  // Warn when over 2000 tokens (no per-model limit known at this layer)
  tokenWarning = computed(() => this.tokenCount() > 2000);

  activeSystemPromptLabel = computed(() => {
    const conv = this.chat.activeConversation();
    if (conv?.systemPrompt !== undefined) {
      return conv.systemPrompt.length > 0 ? 'custom' : 'default';
    }
    const global = this.chat['settingsSvc']?.settings().systemPrompt;
    return global?.length ? 'global' : 'default';
  });

  toggleSystemPrompt(): void {
    if (this.systemPromptOpen()) {
      this.cancelSystemPrompt();
    } else {
      this.systemPromptText = this.chat.activeConversation()?.systemPrompt ?? '';
      this.systemPromptOpen.set(true);
    }
  }

  saveSystemPrompt(): void {
    const id = this.chat.activeConversation()?.id;
    if (id) {
      this.chat.setConversationSystemPrompt(id, this.systemPromptText);
    }
    this.systemPromptOpen.set(false);
  }

  cancelSystemPrompt(): void {
    this.systemPromptOpen.set(false);
  }

  applySlashCommand(command: SlashCommand): void {
    if (command.cmd === '/clear') {
      if (confirm('Clear all messages in this conversation?')) {
        this.chat.clearMessages();
      }
      this.inputText = '';
      this.resetHeight();
      return;
    }
    if (command.cmd === '/system') {
      this.inputText = '';
      this.resetHeight();
      this.systemPromptText = this.chat.activeConversation()?.systemPrompt ?? '';
      this.systemPromptOpen.set(true);
      return;
    }
    this.inputText = command.prefix;
    // Focus the textarea
    setTimeout(() => this.textareaRef?.nativeElement.focus(), 0);
  }

  onEnter(event: KeyboardEvent): void {
    if (!event.shiftKey) {
      event.preventDefault();
      if (this.slashMenuVisible() && this.filteredCommands().length > 0) {
        this.applySlashCommand(this.filteredCommands()[0]);
        return;
      }
      this.send();
    }
  }

  send(): void {
    const text = this.inputText.trim();
    if (!text || this.chat.isStreaming()) return;
    if (!this.chat.activeConversation()) {
      this.chat.newConversation();
    }
    this.inputText = '';
    this.chat.sendMessage(text);
    setTimeout(() => this.resetHeight(), 0);
  }

  stop(): void {
    this.chat.stopStreaming();
  }

  autoResize(): void {
    const el = this.textareaRef?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 192) + 'px';
  }

  private resetHeight(): void {
    const el = this.textareaRef?.nativeElement;
    if (el) el.style.height = 'auto';
  }
}
```

**Note on `activeSystemPromptLabel`:** it accesses the private `settingsSvc` via `this.chat['settingsSvc']`. This is acceptable for a display label. Alternatively, inject `SettingsService` directly in this component — either approach works.

- [ ] **Step 2: Manual verification**

Run `ng serve`. Verify:
- System prompt pill visible above input; clicking it opens an inline editor
- Saving stores it on the conversation; switching conversations shows the correct label (`default`, `custom`, `global`)
- Typing `/` shows the slash command popup
- Typing `/ex` narrows to `/explain`
- Pressing Enter with the popup visible applies the top command
- `/clear` prompts for confirmation then clears messages
- `/system` opens the system prompt editor
- Token count updates as you type; turns amber past 2000

- [ ] **Step 3: Commit**

```bash
git add src/app/components/chat/input-bar/input-bar.component.ts
git commit -m "feat: add system prompt pill, slash commands, and token counter to input bar"
```

---

## Task 4: Message bubbles — avatars, timestamps, streaming badge, edit

**Files:**
- Modify: `src/app/components/chat/message-bubble/message-bubble.component.ts`

- [ ] **Step 1: Replace message-bubble.component.ts**

```ts
import {
  Component, Input, OnChanges, SimpleChanges, inject,
  signal, ChangeDetectionStrategy, ElementRef, ViewChild, AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { ChatMessage } from '../../../services/chat.service';
import { ChatService } from '../../../services/chat.service';
import { SettingsService } from '../../../services/settings.service';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="group flex w-full py-2"
      [class.justify-end]="message.role === 'user'"
      [class.justify-start]="message.role === 'assistant'"
    >
      <!-- Assistant avatar -->
      @if (message.role === 'assistant') {
        <div class="mr-3 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded border border-[#30363d] bg-[#161b22] text-[#8b949e]">
          <svg viewBox="0 0 16 16" class="h-4 w-4" fill="currentColor">
            <path d="M0 8C0 3.58 3.58 0 8 0s8 3.58 8 8-3.58 8-8 8S0 12.42 0 8Zm5.5-1.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-4.5 4a3.5 3.5 0 0 0 3.5 0 .75.75 0 1 0-.75-1.3 2 2 0 0 1-2 0A.75.75 0 1 0 6 10.5Z"/>
          </svg>
        </div>
      }

      <div class="flex min-w-0 max-w-[min(100%,36rem)] flex-col">

        <!-- Editing state (user messages only) -->
        @if (editing()) {
          <div class="rounded border border-[#388bfd] bg-white p-2 dark:bg-[#0d1117]">
            <textarea
              [(ngModel)]="editText"
              rows="3"
              class="w-full resize-none bg-transparent text-sm text-gray-900 outline-none dark:text-gray-100"
            ></textarea>
            <div class="mt-1 flex justify-end gap-2">
              <button (click)="cancelEdit()"
                      class="rounded px-2 py-1 text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
                Cancel
              </button>
              <button (click)="saveEdit()"
                      class="rounded bg-[#238636] px-2 py-1 text-xs text-white hover:bg-[#2ea043]">
                Save & Resend
              </button>
            </div>
          </div>
        } @else {
          <!-- Normal bubble -->
          <div
            #bubbleEl
            class="prose prose-sm max-w-none rounded px-4 py-3 text-sm leading-relaxed
                   prose-headings:scroll-mt-4
                   [&_li>p]:my-0 [&_ol]:my-2 [&_ul]:my-2"
            [class.prose-invert]="message.role === 'assistant' && settings.settings().darkMode"
            [class.prose-gray]="message.role === 'assistant' && !settings.settings().darkMode"
            [class.bg-[#1f6feb]]="message.role === 'user'"
            [class.text-white]="message.role === 'user'"
            [class.bg-[#161b22]]="message.role === 'assistant' && settings.settings().darkMode"
            [class.border]="message.role === 'assistant'"
            [class.border-[#30363d]]="message.role === 'assistant' && settings.settings().darkMode"
            [class.bg-gray-100]="message.role === 'assistant' && !settings.settings().darkMode"
            [class.border-gray-200]="message.role === 'assistant' && !settings.settings().darkMode"
            [class.text-gray-900]="message.role === 'assistant' && !settings.settings().darkMode"
            [class.text-[#e6edf3]]="message.role === 'assistant' && settings.settings().darkMode"
            [innerHTML]="renderedHtml()"
          ></div>
        }

        <!-- Streaming badge -->
        @if (isStreaming && message.role === 'assistant' && isLast && !editing()) {
          <div class="mt-1 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 animate-pulse">
            <span class="flex gap-0.5">
              <span class="inline-block h-1 w-1 rounded-full bg-current animate-bounce" style="animation-delay:0ms"></span>
              <span class="inline-block h-1 w-1 rounded-full bg-current animate-bounce" style="animation-delay:150ms"></span>
              <span class="inline-block h-1 w-1 rounded-full bg-current animate-bounce" style="animation-delay:300ms"></span>
            </span>
            Generating…
          </div>
        }

        <!-- Timestamp + action buttons -->
        @if (!editing()) {
          <div class="mt-1 flex items-center gap-2 text-xs text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-gray-600"
               [class.justify-end]="message.role === 'user'"
               [class.justify-start]="message.role === 'assistant'">
            <span>{{ formatTime(message.timestamp) }}</span>
            @if (message.role === 'assistant' && message.durationMs) {
              <span>· {{ (message.durationMs / 1000).toFixed(1) }}s</span>
            }
            @if (message.role === 'user') {
              <button (click)="startEdit()"
                      class="rounded px-1.5 py-0.5 transition-colors hover:bg-gray-200 hover:text-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-200">
                Edit
              </button>
            }
            <button (click)="copyMessage()"
                    class="rounded px-1.5 py-0.5 transition-colors hover:bg-gray-200 hover:text-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-200">
              {{ copied() ? 'Copied!' : 'Copy' }}
            </button>
            @if (isLast && message.role === 'assistant') {
              <button (click)="regenerate()"
                      class="rounded px-1.5 py-0.5 transition-colors hover:bg-gray-200 hover:text-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-200">
                Retry
              </button>
            }
            <button (click)="deleteMsg()"
                    class="rounded px-1.5 py-0.5 transition-colors hover:bg-gray-200 hover:text-red-600 dark:hover:bg-gray-700 dark:hover:text-red-400">
              Delete
            </button>
          </div>
        }
      </div>

      <!-- User avatar -->
      @if (message.role === 'user') {
        <div class="ml-3 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-[#1f6feb] text-xs font-bold text-white">
          U
        </div>
      }
    </div>
  `,
})
export class MessageBubbleComponent implements OnChanges, AfterViewInit {
  @Input({ required: true }) message!: ChatMessage;
  @Input() isLast = false;
  @Input() isStreaming = false;
  @Input({ required: true }) conversationId!: string;

  @ViewChild('bubbleEl') bubbleEl!: ElementRef<HTMLDivElement>;

  private chat = inject(ChatService);
  settings = inject(SettingsService);
  renderedHtml = signal<string>('');
  copied = signal<boolean>(false);
  editing = signal<boolean>(false);
  editText = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['message']) {
      this.renderContent();
      setTimeout(() => this.highlightCodeBlocks(), 0);
    }
  }

  ngAfterViewInit(): void {
    this.highlightCodeBlocks();
  }

  formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  startEdit(): void {
    this.editText = this.message.content;
    this.editing.set(true);
  }

  saveEdit(): void {
    const text = this.editText.trim();
    if (text) {
      this.chat.editUserMessage(this.conversationId, this.message.id, text);
    }
    this.editing.set(false);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  copyMessage(): void {
    navigator.clipboard.writeText(this.message.content);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  regenerate(): void {
    this.chat.regenerateLastMessage();
  }

  deleteMsg(): void {
    this.chat.deleteMessage(this.conversationId, this.message.id);
  }

  private renderContent(): void {
    if (this.message.role === 'user') {
      this.renderedHtml.set(this.escapeHtml(this.message.content));
    } else {
      const html = marked.parse(this.message.content, { async: false }) as string;
      const wrapped = this.wrapCodeBlocks(html);
      this.renderedHtml.set(wrapped);
    }
  }

  private wrapCodeBlocks(html: string): string {
    return html.replace(
      /<pre><code(?: class="([^"]*)")?>/g,
      (_match, cls) => {
        const lang = cls ? (cls.match(/language-(\w+)/) ?? [])[1] ?? '' : '';
        const clsAttr = cls ? ` class="${cls}"` : '';
        const dotAttr = lang ? ` data-lang="${lang}"` : '';
        return `<div class="code-block-wrapper">` +
          `<div class="code-header">` +
            `<div class="code-header-left"><span class="lang-dot"${dotAttr}></span><span class="lang-label">${lang || 'code'}</span></div>` +
            `<button class="copy-code-btn">⎘ Copy</button>` +
          `</div>` +
          `<div class="code-body"><pre><code${clsAttr}>`;
      }
    ).replace(/<\/code><\/pre>/g, '</code></pre></div></div>');
  }

  private highlightCodeBlocks(): void {
    if (!this.bubbleEl) return;
    const el = this.bubbleEl.nativeElement;

    el.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block as HTMLElement);
    });

    // Insert line numbers (skip if already present)
    el.querySelectorAll('.code-body').forEach((body) => {
      if (body.querySelector('.line-gutter')) return;
      const code = body.querySelector('code');
      if (!code) return;
      const lines = (code.textContent ?? '').split('\n');
      // Don't add gutter for single-line snippets
      if (lines.length <= 1) return;
      const gutter = document.createElement('div');
      gutter.className = 'line-gutter';
      gutter.innerHTML = lines.map((_, i) => `<span>${i + 1}</span>`).join('');
      body.prepend(gutter);
    });

    // Wire up copy buttons (clone to clear stale listeners)
    el.querySelectorAll('.copy-code-btn').forEach((btn) => {
      const newBtn = btn.cloneNode(true) as HTMLElement;
      btn.parentNode?.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', () => {
        const code = newBtn.closest('.code-block-wrapper')?.querySelector('code');
        if (code) navigator.clipboard.writeText(code.textContent ?? '');
        newBtn.textContent = 'Copied!';
        setTimeout(() => { newBtn.textContent = '⎘ Copy'; }, 2000);
      });
    });
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
  }
}
```

- [ ] **Step 2: Manual verification**

Run `ng serve`. Verify:
- Avatars are square (rounded corners) instead of circles
- Hovering a message reveals action buttons + timestamp
- Clicking Edit on a user message opens an inline textarea; Save re-sends; Cancel dismisses
- Assistant messages show duration (e.g., "2:34 PM · 1.2s") after streaming completes
- Streaming shows a pulsing "Generating…" badge instead of a blinking cursor
- Assistant bubbles have a subtle border in both light and dark mode

- [ ] **Step 3: Commit**

```bash
git add src/app/components/chat/message-bubble/message-bubble.component.ts
git commit -m "feat: square avatars, edit user messages, timestamps, streaming badge, assistant border"
```

---

## Task 5: Code block styles + remove streaming cursor

**Files:**
- Modify: `src/styles.scss`

- [ ] **Step 1: Update styles.scss**

Replace the `@layer components` block and `@keyframes blink` with:

```scss
@layer components {
  .code-block-wrapper {
    position: relative;
    border-radius: 6px;
    overflow: hidden;
    margin: 0.75rem 0;
    border: 1px solid #30363d;
    background-color: #0d1117;

    .code-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      background-color: #161b22;
      border-bottom: 1px solid #30363d;
      font-size: 0.75rem;
      color: #8b949e;

      .code-header-left {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .lang-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #8b949e;
        flex-shrink: 0;

        &[data-lang="python"]                         { background: #f78166; }
        &[data-lang="javascript"], &[data-lang="js"]  { background: #d2a8ff; }
        &[data-lang="typescript"], &[data-lang="ts"]  { background: #d2a8ff; }
        &[data-lang="bash"], &[data-lang="shell"], &[data-lang="sh"] { background: #3fb950; }
        &[data-lang="html"]  { background: #e06c75; }
        &[data-lang="css"]   { background: #61afef; }
        &[data-lang="json"]  { background: #d29922; }
        &[data-lang="rust"]  { background: #f0883e; }
        &[data-lang="go"]    { background: #58a6ff; }
      }

      .lang-label {
        font-family: var(--font-family-mono);
        font-size: 11px;
        color: #8b949e;
      }

      .copy-code-btn {
        background: transparent;
        border: none;
        cursor: pointer;
        color: #8b949e;
        font-size: 11px;
        padding: 0;

        &:hover { color: #e6edf3; }
      }
    }

    .code-body {
      display: flex;
      overflow-x: auto;

      .line-gutter {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        padding: 1rem 10px;
        min-width: 2.5rem;
        border-right: 1px solid #21262d;
        user-select: none;
        font-family: var(--font-family-mono);
        font-size: 0.8rem;
        line-height: 1.5;
        color: #8b949e;
        background: #0d1117;

        span {
          display: block;
        }
      }

      pre {
        flex: 1;
        overflow-x: auto;
        padding: 1rem;
        margin: 0;
        font-size: 0.875rem;
        font-family: var(--font-family-mono);
        background: transparent;

        code {
          background: transparent;
          white-space: pre;
        }
      }
    }
  }
}
```

Note: `.streaming-cursor` and `@keyframes blink` are removed entirely — the streaming badge in the component replaces them.

- [ ] **Step 2: Manual verification**

Run `ng serve`. Send a message that produces code. Verify:
- Code block has a dark `#0d1117` background with a `#30363d` border
- Header shows a colored language dot and `⎘ Copy` button
- Multi-line code shows a line number gutter
- Single-line snippets have no gutter
- Horizontal scrolling works for wide code
- The pulsing streaming badge still works (no regression from removing `.streaming-cursor`)

- [ ] **Step 3: Commit**

```bash
git add src/styles.scss
git commit -m "feat: redesign code blocks with line numbers, lang dots, and GitHub-dark style"
```

---

## Self-Review Notes

- **Spec coverage:**
  - ✅ Ollama status dot + model metadata card (Task 2)
  - ✅ System prompt pill + per-conversation system prompt (Tasks 1 + 3)
  - ✅ Slash commands (Task 3)
  - ✅ Token counter (Task 3)
  - ✅ Keyboard hint strip (Task 3)
  - ✅ Square avatars (Task 4)
  - ✅ Edit user messages (Tasks 1 + 4)
  - ✅ Timestamps + generation time (Tasks 1 + 4)
  - ✅ Streaming badge (Task 4)
  - ✅ Assistant bubble border (Task 4)
  - ✅ Code block line numbers + lang dots (Tasks 4 + 5)
  - ✅ Light/dark preserved throughout

- **Type consistency:** `OllamaModelMeta`, `editUserMessage`, `clearMessages`, `setConversationSystemPrompt` defined in Task 1 and used consistently in Tasks 2, 3, 4. `durationMs` on `ChatMessage` defined in Task 1, set in `sendMessage`, read in Task 4.

- **Known limitation:** `activeSystemPromptLabel` in Task 3 accesses `this.chat['settingsSvc']` (private). If this feels wrong, inject `SettingsService` directly in `InputBarComponent` instead. Either approach works.
