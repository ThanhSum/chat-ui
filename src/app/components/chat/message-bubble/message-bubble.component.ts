import {
  Component, Input, OnChanges, SimpleChanges, inject,
  signal, ChangeDetectionStrategy, ElementRef, ViewChild, AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { ChatMessage } from '../../../services/chat.service';
import { ChatService } from '../../../services/chat.service';
import { SettingsService } from '../../../services/settings.service';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="group flex w-full py-3"
      [class.justify-end]="message.role === 'user'"
      [class.justify-start]="message.role === 'assistant'"
    >
      @if (message.role === 'assistant') {
        <div class="flex-shrink-0 w-7 h-7 rounded-full bg-green-600 flex items-center justify-center text-xs font-bold text-white mr-3 mt-1">
          AI
        </div>
      }

      <div class="flex min-w-0 max-w-[min(100%,36rem)] flex-col">
        <div
          #bubbleEl
          class="prose prose-sm max-w-none rounded-2xl px-4 py-3 text-sm leading-relaxed
                 prose-headings:scroll-mt-4
                 [&_li>p]:my-0 [&_ol]:my-2 [&_ul]:my-2"
          [class.prose-invert]="message.role === 'assistant' && settings.settings().darkMode"
          [class.prose-gray]="message.role === 'assistant' && !settings.settings().darkMode"
          [class.bg-blue-600]="message.role === 'user'"
          [class.text-white]="message.role === 'user'"
          [class.rounded-br-sm]="message.role === 'user'"
          [class.bg-gray-800]="message.role === 'assistant' && settings.settings().darkMode"
          [class.bg-gray-100]="message.role === 'assistant' && !settings.settings().darkMode"
          [class.text-gray-100]="message.role === 'assistant' && settings.settings().darkMode"
          [class.text-gray-900]="message.role === 'assistant' && !settings.settings().darkMode"
          [class.rounded-bl-sm]="message.role === 'assistant'"
          [innerHTML]="renderedHtml()"
        ></div>

        @if (isStreaming && message.role === 'assistant' && isLast) {
          <span class="streaming-cursor ml-1 mt-1"></span>
        }

        <div class="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
             [class.justify-end]="message.role === 'user'"
             [class.justify-start]="message.role === 'assistant'">
          <button
            (click)="copyMessage()"
            class="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            {{ copied() ? 'Copied!' : 'Copy' }}
          </button>
          @if (isLast && message.role === 'assistant') {
            <button
              (click)="regenerate()"
              class="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              Regenerate
            </button>
          }
          <button
            (click)="deleteMsg()"
            class="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-gray-500 transition-colors hover:bg-gray-200 hover:text-red-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-red-400"
          >
            Delete
          </button>
        </div>
      </div>

      @if (message.role === 'user') {
        <div class="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white ml-3 mt-1">
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['message']) {
      this.renderContent();
      // Re-highlight after content changes
      setTimeout(() => this.highlightCodeBlocks(), 0);
    }
  }

  ngAfterViewInit(): void {
    this.highlightCodeBlocks();
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
        return `<div class="code-block-wrapper"><div class="code-header"><span>${lang || 'code'}</span><button class="copy-code-btn hover:text-white cursor-pointer">Copy</button></div><pre><code${clsAttr}>`;
      }
    ).replace(/<\/code><\/pre>/g, '</code></pre></div>');
  }

  private highlightCodeBlocks(): void {
    if (!this.bubbleEl) return;
    const el = this.bubbleEl.nativeElement;
    el.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block as HTMLElement);
    });
    el.querySelectorAll('.copy-code-btn').forEach((btn) => {
      // Remove old listeners by cloning
      const newBtn = btn.cloneNode(true) as HTMLElement;
      btn.parentNode?.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', () => {
        const code = newBtn.closest('.code-block-wrapper')?.querySelector('code');
        if (code) navigator.clipboard.writeText(code.textContent ?? '');
        newBtn.textContent = 'Copied!';
        setTimeout(() => { newBtn.textContent = 'Copy'; }, 2000);
      });
    });
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

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
  }
}
