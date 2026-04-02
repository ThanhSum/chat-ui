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
    <div class="group py-3"
         [class.flex]="message.role === 'user'"
         [class.justify-end]="message.role === 'user'">

      @if (message.role === 'assistant') {
        <!-- Assistant: full width, no bubble -->
        <div class="flex items-start gap-3">
          <div class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-black dark:bg-white">
            <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 text-white dark:text-black" fill="currentColor">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            @if (editing()) {
              <div class="rounded-2xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-[#222]">
                <textarea [(ngModel)]="editText" rows="3"
                          class="w-full resize-none bg-transparent text-sm outline-none dark:text-gray-100"></textarea>
                <div class="mt-2 flex justify-end gap-2">
                  <button (click)="cancelEdit()" class="rounded px-2 py-1 text-xs text-gray-500">Cancel</button>
                  <button (click)="saveEdit()" class="rounded bg-gray-900 px-2 py-1 text-xs text-white dark:bg-white dark:text-black">Save</button>
                </div>
              </div>
            } @else {
              <div #bubbleEl
                   class="prose prose-sm max-w-none text-gray-800 dark:prose-invert dark:text-gray-200
                          prose-headings:scroll-mt-4 [&_li>p]:my-0 [&_ol]:my-2 [&_ul]:my-2"
                   [innerHTML]="renderedHtml()"></div>
            }

            @if (isStreaming && isLast) {
              <div class="mt-2 flex items-center gap-1 text-xs text-gray-400">
                <span class="flex gap-0.5">
                  <span class="inline-block h-1 w-1 rounded-full bg-gray-400 animate-bounce" style="animation-delay:0ms"></span>
                  <span class="inline-block h-1 w-1 rounded-full bg-gray-400 animate-bounce" style="animation-delay:150ms"></span>
                  <span class="inline-block h-1 w-1 rounded-full bg-gray-400 animate-bounce" style="animation-delay:300ms"></span>
                </span>
              </div>
            }

            <!-- Actions -->
            @if (!editing() && !isStreaming) {
              <div class="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button (click)="copyMessage()"
                        class="rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5 dark:hover:text-gray-300">
                  {{ copied() ? 'Copied' : 'Copy' }}
                </button>
                <button (click)="regenerate()"
                        class="rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5 dark:hover:text-gray-300">
                  Retry
                </button>
                @if (message.durationMs) {
                  <span class="text-xs text-gray-300 dark:text-gray-600">{{ (message.durationMs / 1000).toFixed(1) }}s</span>
                }
              </div>
            }
          </div>
        </div>

      } @else {
        <!-- User: bubble on right -->
        <div class="max-w-[75%]">
          @if (editing()) {
            <div class="rounded-2xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-[#222]">
              <textarea [(ngModel)]="editText" rows="3"
                        class="w-full resize-none bg-transparent text-sm outline-none dark:text-gray-100"></textarea>
              <div class="mt-2 flex justify-end gap-2">
                <button (click)="cancelEdit()" class="rounded px-2 py-1 text-xs text-gray-500">Cancel</button>
                <button (click)="saveEdit()" class="rounded bg-gray-900 px-2 py-1 text-xs text-white dark:bg-white dark:text-black">Save & Resend</button>
              </div>
            </div>
          } @else {
            <div class="rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-900 dark:bg-white/10 dark:text-gray-100">
              @if (message.attachments?.length) {
                <div class="mb-2 flex flex-wrap gap-2">
                  @for (a of message.attachments; track $index) {
                    <img
                      [src]="'data:' + a.mimeType + ';base64,' + a.base64"
                      class="max-h-48 max-w-full rounded-lg object-contain"
                      alt=""
                    />
                  }
                </div>
              }
              @if (message.content) {
                <div class="whitespace-pre-wrap break-words">{{ message.content }}</div>
              }
            </div>
            <div class="mt-1 flex justify-end items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button (click)="startEdit()"
                      class="rounded-lg px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5">
                Edit
              </button>
              <button (click)="copyMessage()"
                      class="rounded-lg px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5">
                {{ copied() ? 'Copied' : 'Copy' }}
              </button>
              <button (click)="deleteMsg()"
                      class="rounded-lg px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-white/5">
                Delete
              </button>
            </div>
          }
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

  ngAfterViewInit(): void { this.highlightCodeBlocks(); }

  startEdit(): void { this.editText = this.message.content; this.editing.set(true); }
  saveEdit(): void {
    const text = this.editText.trim();
    if (text) this.chat.editUserMessage(this.conversationId, this.message.id, text);
    this.editing.set(false);
  }
  cancelEdit(): void { this.editing.set(false); }

  copyMessage(): void {
    navigator.clipboard.writeText(this.message.content);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  regenerate(): void { this.chat.regenerateLastMessage(); }
  deleteMsg(): void { this.chat.deleteMessage(this.conversationId, this.message.id); }

  private renderContent(): void {
    if (this.message.role === 'user') {
      this.renderedHtml.set(this.escapeHtml(this.message.content));
    } else {
      const html = marked.parse(this.message.content, { async: false }) as string;
      this.renderedHtml.set(this.wrapCodeBlocks(html));
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
    el.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block as HTMLElement));
    el.querySelectorAll('.code-body').forEach(body => {
      if (body.querySelector('.line-gutter')) return;
      const code = body.querySelector('code');
      if (!code) return;
      const lines = (code.textContent ?? '').split('\n');
      if (lines.length <= 1) return;
      const gutter = document.createElement('div');
      gutter.className = 'line-gutter';
      gutter.innerHTML = lines.map((_, i) => `<span>${i + 1}</span>`).join('');
      body.prepend(gutter);
    });
    el.querySelectorAll('.copy-code-btn').forEach(btn => {
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
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/\n/g, '<br>');
  }
}
