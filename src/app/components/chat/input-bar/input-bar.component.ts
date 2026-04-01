import {
  Component, inject, ElementRef, ViewChild,
  ChangeDetectionStrategy, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../../services/chat.service';

@Component({
  selector: 'app-input-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
      <div class="mx-auto w-full max-w-2xl">

      @if (chat.error()) {
        <div class="mb-3 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/50 dark:text-red-200">
          <span class="mt-0.5 text-red-500 dark:text-red-400">&#9888;</span>
          <span class="flex-1">{{ chat.error() }}</span>
          <button (click)="chat.error.set(null)" class="ml-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200">&#10005;</button>
        </div>
      }

      @if (chat.selectedProvider() === 'ollama' && !chat.ollamaOnline()) {
        <div class="mb-3 rounded-lg border border-yellow-600 bg-yellow-50 px-4 py-2 text-sm text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-200">
          &#9888; Ollama not detected — local models unavailable
        </div>
      }

      <div class="flex items-center gap-3 rounded-2xl border border-gray-300 bg-white px-4 py-2.5 transition-colors focus-within:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:focus-within:border-gray-500">
        <textarea
          #textarea
          [(ngModel)]="inputText"
          (input)="autoResize()"
          (keydown.enter)="onEnter($any($event))"
          [disabled]="chat.isStreaming()"
          placeholder="Message..."
          rows="1"
          class="max-h-48 min-h-10 flex-1 resize-none overflow-y-auto bg-transparent py-2 text-sm leading-normal text-gray-900 outline-none placeholder:text-gray-400 disabled:opacity-50 dark:text-gray-100 dark:placeholder:text-gray-500"
        ></textarea>

        @if (chat.isStreaming()) {
          <button
            (click)="stop()"
            class="flex-shrink-0 w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors"
            title="Stop"
          >
            <span class="block w-3 h-3 bg-white rounded-sm"></span>
          </button>
        } @else {
          <button
            (click)="send()"
            [disabled]="!inputText.trim() || !chat.activeConversation()"
            class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            title="Send"
          >
            <svg class="w-4 h-4 text-white rotate-90" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        }
      </div>

      <p class="mt-2 text-center text-xs text-gray-500 dark:text-gray-600">
        AI can make mistakes. Verify important info.
      </p>
      </div>
    </div>
  `,
})
export class InputBarComponent {
  @ViewChild('textarea') textareaRef!: ElementRef<HTMLTextAreaElement>;

  chat = inject(ChatService);
  inputText = '';

  onEnter(event: KeyboardEvent): void {
    if (!event.shiftKey) {
      event.preventDefault();
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
