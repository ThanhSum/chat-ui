import {
  Component, inject, ElementRef, ViewChild,
  ChangeDetectionStrategy, signal, computed, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../../services/chat.service';
import { ImageAttachment } from '../../../providers/provider.interface';

const MAX_PENDING_IMAGES = 4;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

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
                      (paste)="onPaste($event)"
                      [disabled]="chat.isStreaming()"
                      placeholder="Ask me anything..."
                      rows="1"
                      class="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-sm leading-relaxed
                             text-gray-900 outline-none placeholder:text-gray-400
                             disabled:opacity-50 dark:text-gray-100 dark:placeholder:text-gray-500"
                      style="max-height: 200px; overflow-y: auto;"></textarea>

            <!-- Bottom toolbar -->
            <div class="flex items-center gap-2 px-3 pb-3">
              <!-- Hidden file input: must NOT use display:none — browsers often block programmatic .click() -->
              <input
                #fileInput
                type="file"
                accept="image/*"
                multiple
                tabindex="-1"
                class="sr-only"
                (change)="onFilePick($event)"
              />
              <!-- + = chỉ chọn ảnh (OpenRouter). System prompt = nút bánh răng bên cạnh -->
              <button type="button" (click)="onPlusClick()"
                      title="Thêm ảnh (cần OpenRouter)"
                      class="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
              </button>
              <button type="button" (click)="toggleSystemPrompt()" title="System prompt"
                      class="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </button>
              <button type="button" title="Voice input"
                      class="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                </svg>
              </button>

              @if (chat.selectedProvider() === 'openrouter' && pendingImages().length > 0) {
                <span class="text-[11px] text-gray-500 dark:text-gray-400">{{ pendingImages().length }} img</span>
                <button type="button" (click)="clearPendingImages()" class="text-[11px] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Clear</button>
              }

              <span class="flex-1"></span>

              <!-- Token hint -->
              @if (inputText.length > 0 || pendingImages().length > 0) {
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
                <button (click)="send()" [disabled]="(!inputText.trim() && pendingImages().length === 0) || !chat.activeConversation()"
                        class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-white
                               hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed
                               dark:bg-gray-200 dark:text-black dark:hover:bg-gray-400"
                        title="Send">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.25"
                       viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round"
                          d="M12 19V5M5 12l7-7 7 7"/>
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
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;
  chat = inject(ChatService);
  inputText = '';
  systemPromptText = '';
  systemPromptOpen = signal(false);
  pendingImages = signal<ImageAttachment[]>([]);

  constructor() {
    effect(() => {
      if (this.chat.selectedProvider() !== 'openrouter') {
        this.pendingImages.set([]);
      }
    });
  }

  slashMenuVisible = computed(() => this.inputText.startsWith('/'));
  filteredCommands = computed(() => SLASH_COMMANDS.filter(c => c.cmd.startsWith(this.inputText.toLowerCase())));
  // NOTE: `inputText` is a normal field (not a signal), so `computed()` here would not reliably
  // re-evaluate on typing when using OnPush change detection. Use methods instead.
  tokenCount(): number {
    const textLen = this.inputText.length;
    const imgExtra = this.pendingImages().reduce((s, a) => s + a.base64.length * 0.75, 0);
    return Math.round((textLen + imgExtra) / 4);
  }
  tokenWarning(): boolean {
    return this.tokenCount() > 2000;
  }

  clearPendingImages(): void {
    this.pendingImages.set([]);
  }

  onPlusClick(): void {
    if (this.chat.selectedProvider() === 'openrouter') {
      setTimeout(() => this.fileInputRef?.nativeElement?.click(), 0);
      return;
    }
    this.chat.error.set(
      'Để đính kèm ảnh, chọn provider OpenRouter ở thanh dưới cùng bên trái (cạnh chọn model).'
    );
  }

  onPaste(e: ClipboardEvent): void {
    if (this.chat.selectedProvider() !== 'openrouter') return;
    const items = e.clipboardData?.items;
    if (!items?.length) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length === 0) return;
    e.preventDefault();
    void this.addImagesFromFiles(files);
  }

  onFilePick(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (files?.length) void this.addImagesFromFiles(files);
    input.value = '';
  }

  private async addImagesFromFiles(files: FileList | File[]): Promise<void> {
    if (this.chat.selectedProvider() !== 'openrouter') return;
    const list = Array.from(files);
    let next = [...this.pendingImages()];
    for (const file of list) {
      if (next.length >= MAX_PENDING_IMAGES) break;
      const att = await this.readImageFile(file);
      if (att) next.push(att);
    }
    this.pendingImages.set(next);
  }

  private readImageFile(file: File): Promise<ImageAttachment | null> {
    if (!file.type.startsWith('image/')) return Promise.resolve(null);
    if (file.size > MAX_IMAGE_BYTES) {
      this.chat.error.set(`Image too large (max ${MAX_IMAGE_BYTES / 1024 / 1024} MB per file).`);
      return Promise.resolve(null);
    }
    return new Promise(resolve => {
      const r = new FileReader();
      r.onload = () => {
        const dataUrl = r.result as string;
        const comma = dataUrl.indexOf(',');
        if (comma === -1) {
          resolve(null);
          return;
        }
        const header = dataUrl.slice(0, comma);
        const mimeMatch = header.match(/^data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
        const base64 = dataUrl.slice(comma + 1);
        resolve({ mimeType, base64 });
      };
      r.onerror = () => resolve(null);
      r.readAsDataURL(file);
    });
  }

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
      this.inputText = ''; this.pendingImages.set([]); this.resetHeight(); return;
    }
    if (c.cmd === '/system') {
      this.inputText = ''; this.pendingImages.set([]); this.resetHeight();
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
    const imgs = this.pendingImages();
    if ((!text && imgs.length === 0) || this.chat.isStreaming()) return;
    if (!this.chat.activeConversation()) this.chat.newConversation();
    this.inputText = '';
    this.pendingImages.set([]);
    this.chat.sendMessage(text, imgs.length ? imgs : undefined);
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
