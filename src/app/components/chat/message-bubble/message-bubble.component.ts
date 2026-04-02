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
    <div class="group flex w-full py-2"
         [class.justify-end]="message.role === 'user'"
         [class.justify-start]="message.role === 'assistant'">

      @if (message.role === 'assistant') {
        <div class="mr-3 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded border border-[#30363d] bg-[#161b22] text-[#8b949e]">
          <svg viewBox="0 0 16 16" class="h-4 w-4" fill="currentColor">
            <path d="M0 8C0 3.58 3.58 0 8 0s8 3.58 8 8-3.58 8-8 8S0 12.42 0 8Zm5.5-1.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-4.5 4a3.5 3.5 0 0 0 3.5 0 .75.75 0 1 0-.75-1.3 2 2 0 0 1-2 0A.75.75 0 1 0 6 10.5Z"/>
          </svg>
        </div>
      }

      <div class="flex min-w-0 max-w-[min(100%,36rem)] flex-col">

        @if (editing()) {
          <div class="rounded border border-[#388bfd] bg-white p-2 dark:bg-[#0d1117]">
            <textarea [(ngModel)]="editText" rows="3"
                      class="w-full resize-none bg-transparent text-sm text-gray-900 outline-none dark:text-gray-100"></textarea>
            <div class="mt-1 flex justify-end gap-2">
              <button (click)="cancelEdit()" class="rounded px-2 py-1 text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400">Cancel</button>
              <button (click)="saveEdit()" class="rounded bg-[#238636] px-2 py-1 text-xs text-white hover:bg-[#2ea043]">Save & Resend</button>
            </div>
          </div>
        } @else {
          <div #bubbleEl
               class="prose prose-sm max-w-none rounded px-4 py-3 text-sm leading-relaxed
                      prose-headings:scroll-mt-4 [&_li>p]:my-0 [&_ol]:my-2 [&_ul]:my-2"
               [class.prose-invert]="message.role === 'assistant' && settings.settings().darkMode"
               [class.prose-gray]="message.role === 'assistant' && !settings.settings().darkMode"
               [class.bg-blue-600]="message.role === 'user'"
               [class.text-white]="message.role === 'user'"
               [class.rounded-br-sm]="message.role === 'user'"
               [class.bg-[#161b22]]="message.role === 'assistant' && settings.settings().darkMode"
               [class.border]="message.role === 'assistant'"
               [class.border-[#30363d]]="message.role === 'assistant' && settings.settings().darkMode"
               [class.bg-gray-100]="message.role === 'assistant' && !settings.settings().darkMode"
               [class.border-gray-200]="message.role === 'assistant' && !settings.settings().darkMode"
               [class.text-gray-900]="message.role === 'assistant' && !settings.settings().darkMode"
               [class.text-[#e6edf3]]="message.role === 'assistant' && settings.settings().darkMode"
               [class.rounded-bl-sm]="message.role === 'assistant'"
               [innerHTML]="renderedHtml()"></div>
        }

        @if (isStreaming && message.role === 'assistant' && isLast) {
          <div class="mt-1 flex items-center gap-1.5 text-xs text-gray-400 animate-pulse">
            <span class="flex gap-0.5">
              <span class="inline-block h-1 w-1 rounded-full bg-current animate-bounce" style="animation-delay:0ms"></span>
              <span class="inline-block h-1 w-1 rounded-full bg-current animate-bounce" style="animation-delay:150ms"></span>
              <span class="inline-block h-1 w-1 rounded-full bg-current animate-bounce" style="animation-delay:300ms"></span>
            </span>
            Generating…
          </div>
        }

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
                      class="rounded px-1.5 py-0.5 hover:bg-gray-200 hover:text-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-200">
                Edit
              </button>
            }
            <button (click)="copyMessage()"
                    class="rounded px-1.5 py-0.5 hover:bg-gray-200 hover:text-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-200">
              {{ copied() ? 'Copied!' : 'Copy' }}
            </button>
            @if (isLast && message.role === 'assistant') {
              <button (click)="regenerate()"
                      class="rounded px-1.5 py-0.5 hover:bg-gray-200 hover:text-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-200">
                Retry
              </button>
            }
            <button (click)="deleteMsg()"
                    class="rounded px-1.5 py-0.5 hover:bg-gray-200 hover:text-red-600 dark:hover:bg-gray-700 dark:hover:text-red-400">
              Delete
            </button>
          </div>
        }
      </div>

      @if (message.role === 'user') {
        <div class="ml-3 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white">
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

  ngAfterViewInit(): void { this.highlightCodeBlocks(); }

  formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

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
