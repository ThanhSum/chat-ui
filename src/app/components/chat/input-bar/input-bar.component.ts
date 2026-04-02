import {
  Component, inject, ElementRef, ViewChild,
  ChangeDetectionStrategy, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../../services/chat.service';

interface SlashCommand { cmd: string; description: string; prefix: string; }

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
    <div class="px-4 pb-5 pt-2 bg-[#f5f5f5] dark:bg-[#1a1a1a]">
      <div class="mx-auto w-full max-w-2xl">

        @if (chat.error()) {
          <div class="mb-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
            <span class="shrink-0">⚠</span>
            <span class="flex-1 break-all">{{ chat.error() }}</span>
            <button (click)="chat.error.set(null)" class="shrink-0 opacity-60 hover:opacity-100">✕</button>
          </div>
        }

        @if (chat.selectedProvider() === 'ollama' && !chat.ollamaOnline()) {
          <div class="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            ⚠ Ollama not detected — local models unavailable
          </div>
        }

        <!-- System prompt editor (inline, above input) -->
        @if (systemPromptOpen()) {
          <div class="mb-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#222]">
            <p class="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">System prompt</p>
            <textarea [(ngModel)]="systemPromptText" rows="3" placeholder="You are a helpful assistant..."
                      class="w-full resize-none bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"></textarea>
            <div class="mt-2 flex justify-end gap-2">
              <button (click)="cancelSystemPrompt()" class="rounded-lg px-3 py-1 text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400">Cancel</button>
              <button (click)="saveSystemPrompt()" class="rounded-lg bg-gray-900 px-3 py-1 text-xs text-white hover:bg-gray-700 dark:bg-white dark:text-black dark:hover:bg-gray-200">Save</button>
            </div>
          </div>
        }

        <!-- Slash command popup -->
        <div class="relative">
          @if (slashMenuVisible() && filteredCommands().length > 0) {
            <div class="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#222]">
              @for (c of filteredCommands(); track c.cmd; let i = $index) {
                <div (click)="applySlashCommand(c)"
                     class="cursor-pointer px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5"
                     [class.bg-gray-50]="i === 0" [class.dark:bg-white/5]="i === 0">
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ c.cmd }}</span>
                  <span class="ml-2 text-xs text-gray-400">{{ c.description }}</span>
                </div>
              }
            </div>
          }

          <!-- Main input box -->
          <div class="rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow
                      focus-within:shadow-md focus-within:border-gray-300
                      dark:border-white/10 dark:bg-[#222] dark:focus-within:border-white/20">
            <textarea #textarea [(ngModel)]="inputText" (input)="autoResize()" (keydown.enter)="onEnter($any($event))"
                      [disabled]="chat.isStreaming()"
                      placeholder="Ask me anything..."
                      rows="1"
                      class="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-sm leading-relaxed
                             text-gray-900 outline-none placeholder:text-gray-400
                             disabled:opacity-50 dark:text-gray-100 dark:placeholder:text-gray-500"
                      style="max-height: 200px; overflow-y: auto;"></textarea>

            <!-- Bottom toolbar -->
            <div class="flex items-center gap-2 px-3 pb-3">
              <!-- Left actions -->
              <button (click)="toggleSystemPrompt()" title="System prompt"
                      class="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
              </button>
              <button title="Voice input"
                      class="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                </svg>
              </button>

              <span class="flex-1"></span>

              <!-- Token hint -->
              @if (inputText.length > 0) {
                <span class="text-[11px]" [class.text-gray-400]="!tokenWarning()" [class.text-amber-500]="tokenWarning()">
                  ~{{ tokenCount() }}
                </span>
              }

              <!-- Send / Stop -->
              @if (chat.isStreaming()) {
                <button (click)="stop()"
                        class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-white hover:bg-gray-600 dark:bg-gray-200 dark:text-black dark:hover:bg-gray-400">
                  <span class="block h-3 w-3 rounded-sm bg-current"></span>
                </button>
              } @else {
                <button (click)="send()" [disabled]="!inputText.trim() || !chat.activeConversation()"
                        class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-white
                               hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed
                               dark:bg-gray-200 dark:text-black dark:hover:bg-gray-400">
                  <svg class="h-4 w-4 rotate-90" fill="currentColor" viewBox="0 0 24 24">
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

  slashMenuVisible = computed(() => this.inputText.startsWith('/'));
  filteredCommands = computed(() => SLASH_COMMANDS.filter(c => c.cmd.startsWith(this.inputText.toLowerCase())));
  tokenCount = computed(() => Math.round(this.inputText.length / 4));
  tokenWarning = computed(() => this.tokenCount() > 2000);

  toggleSystemPrompt(): void {
    if (this.systemPromptOpen()) { this.systemPromptOpen.set(false); return; }
    this.systemPromptText = this.chat.activeConversation()?.systemPrompt ?? '';
    this.systemPromptOpen.set(true);
  }

  saveSystemPrompt(): void {
    const id = this.chat.activeConversation()?.id;
    if (id) this.chat.setConversationSystemPrompt(id, this.systemPromptText);
    this.systemPromptOpen.set(false);
  }

  cancelSystemPrompt(): void { this.systemPromptOpen.set(false); }

  applySlashCommand(c: SlashCommand): void {
    if (c.cmd === '/clear') {
      if (confirm('Clear all messages?')) this.chat.clearMessages();
      this.inputText = ''; this.resetHeight(); return;
    }
    if (c.cmd === '/system') {
      this.inputText = ''; this.resetHeight();
      this.systemPromptText = this.chat.activeConversation()?.systemPrompt ?? '';
      this.systemPromptOpen.set(true); return;
    }
    this.inputText = c.prefix;
    setTimeout(() => this.textareaRef?.nativeElement.focus(), 0);
  }

  onEnter(event: KeyboardEvent): void {
    if (!event.shiftKey) {
      event.preventDefault();
      if (this.slashMenuVisible() && this.filteredCommands().length > 0) {
        this.applySlashCommand(this.filteredCommands()[0]); return;
      }
      this.send();
    }
  }

  send(): void {
    const text = this.inputText.trim();
    if (!text || this.chat.isStreaming()) return;
    if (!this.chat.activeConversation()) this.chat.newConversation();
    this.inputText = '';
    this.chat.sendMessage(text);
    setTimeout(() => this.resetHeight(), 0);
  }

  stop(): void { this.chat.stopStreaming(); }

  autoResize(): void {
    const el = this.textareaRef?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }

  private resetHeight(): void {
    const el = this.textareaRef?.nativeElement;
    if (el) el.style.height = 'auto';
  }
}
