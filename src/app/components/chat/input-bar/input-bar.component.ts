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
    <div class="border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
      <div class="mx-auto w-full min-w-0 max-w-2xl">

        @if (chat.error()) {
          <div class="mb-3 flex min-w-0 max-w-full items-start gap-2 overflow-hidden rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/50 dark:text-red-200">
            <span class="mt-0.5 shrink-0 text-red-500">&#9888;</span>
            <span class="max-h-48 min-w-0 flex-1 overflow-y-auto break-all whitespace-pre-wrap leading-relaxed">{{ chat.error() }}</span>
            <button type="button" (click)="chat.error.set(null)" class="ml-1 shrink-0 text-red-500 hover:text-red-700 dark:text-red-400">&#10005;</button>
          </div>
        }

        @if (chat.selectedProvider() === 'ollama' && !chat.ollamaOnline()) {
          <div class="mb-3 rounded border border-yellow-600 bg-yellow-50 px-4 py-2 text-sm text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-200">
            &#9888; Ollama not detected — local models unavailable
          </div>
        }

        <!-- System prompt pill -->
        <div class="mb-2 flex items-center gap-2">
          <button (click)="toggleSystemPrompt()"
                  class="flex items-center gap-1.5 rounded border border-[#d1d9e0] bg-[#f6f8fa] px-2 py-1 text-[11px] text-gray-500
                         hover:border-gray-400 hover:text-gray-800
                         dark:border-[#30363d] dark:bg-[#161b22] dark:text-[#8b949e] dark:hover:border-[#8b949e] dark:hover:text-[#e6edf3]">
            <svg class="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm4.879-2.773 4.264 2.559a.25.25 0 0 1 0 .428l-4.264 2.559A.25.25 0 0 1 6 10.559V5.442a.25.25 0 0 1 .379-.215Z"/>
            </svg>
            System prompt
            <span class="rounded bg-gray-200 px-1 py-0.5 text-[10px] text-gray-600 dark:bg-[#21262d] dark:text-[#8b949e]">
              {{ systemPromptLabel() }}
            </span>
          </button>
          <span class="flex-1"></span>
          <span class="text-[11px] text-gray-400 dark:text-[#8b949e]">⌘K to search</span>
        </div>

        @if (systemPromptOpen()) {
          <div class="mb-2 rounded border border-[#d1d9e0] bg-[#f6f8fa] p-2 dark:border-[#30363d] dark:bg-[#161b22]">
            <textarea [(ngModel)]="systemPromptText" rows="3" placeholder="You are a helpful assistant..."
                      class="w-full resize-none bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-[#e6edf3]"></textarea>
            <div class="mt-1.5 flex justify-end gap-2">
              <button (click)="cancelSystemPrompt()" class="rounded px-2 py-1 text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400">Cancel</button>
              <button (click)="saveSystemPrompt()" class="rounded bg-[#238636] px-2 py-1 text-xs text-white hover:bg-[#2ea043]">Save</button>
            </div>
          </div>
        }

        <div class="relative">
          @if (slashMenuVisible() && filteredCommands().length > 0) {
            <div class="absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded border border-[#d1d9e0] bg-[#f6f8fa] shadow-lg dark:border-[#30363d] dark:bg-[#161b22]">
              @for (c of filteredCommands(); track c.cmd; let i = $index) {
                <div (click)="applySlashCommand(c)"
                     class="cursor-pointer px-3 py-2 hover:bg-[#eaeef2] dark:hover:bg-[#21262d]"
                     [class.bg-[#eaeef2]]="i === 0" [class.dark:bg-[#21262d]]="i === 0">
                  <span class="text-sm font-semibold text-[#388bfd]">{{ c.cmd }}</span>
                  <span class="ml-2 text-xs text-gray-500 dark:text-[#8b949e]">{{ c.description }}</span>
                </div>
              }
            </div>
          }

          <div class="flex flex-col rounded border border-[#d1d9e0] bg-white transition-colors
                      focus-within:border-[#388bfd] dark:border-[#30363d] dark:bg-[#0d1117] dark:focus-within:border-[#388bfd]">
            <textarea #textarea [(ngModel)]="inputText" (input)="autoResize()" (keydown.enter)="onEnter($any($event))"
                      [disabled]="chat.isStreaming()" placeholder="Message... (type / for commands)" rows="1"
                      class="max-h-48 min-h-10 flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-normal
                             text-gray-900 outline-none placeholder:text-gray-400 disabled:opacity-50 dark:text-gray-100 dark:placeholder:text-gray-500"></textarea>

            <div class="flex items-center gap-2 border-t border-gray-100 px-3 py-1.5 dark:border-[#21262d]">
              <span class="text-xs text-gray-400 dark:text-[#8b949e]">↵ Send · ⇧↵ Newline</span>
              <span class="flex-1"></span>
              <span class="text-xs" [class.text-gray-400]="!tokenWarning()" [class.text-amber-500]="tokenWarning()">
                ~{{ tokenCount() }} tokens
              </span>
              @if (chat.isStreaming()) {
                <button (click)="stop()" title="Stop"
                        class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-red-600 hover:bg-red-500">
                  <span class="block h-2.5 w-2.5 rounded-sm bg-white"></span>
                </button>
              } @else {
                <button (click)="send()" [disabled]="!inputText.trim() || !chat.activeConversation()" title="Send"
                        class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-[#238636]
                               hover:bg-[#2ea043] disabled:cursor-not-allowed disabled:opacity-30">
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

  slashMenuVisible = computed(() => this.inputText.startsWith('/'));
  filteredCommands = computed(() => SLASH_COMMANDS.filter(c => c.cmd.startsWith(this.inputText.toLowerCase())));
  tokenCount = computed(() => Math.round(this.inputText.length / 4));
  tokenWarning = computed(() => this.tokenCount() > 2000);
  systemPromptLabel = computed(() => {
    const p = this.chat.activeConversation()?.systemPrompt;
    return p !== undefined && p.length > 0 ? 'custom' : 'default';
  });

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
    el.style.height = Math.min(el.scrollHeight, 192) + 'px';
  }

  private resetHeight(): void {
    const el = this.textareaRef?.nativeElement;
    if (el) el.style.height = 'auto';
  }
}
