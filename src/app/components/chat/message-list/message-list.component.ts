import {
  Component, inject, computed, AfterViewChecked,
  ElementRef, ViewChild, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService } from '../../../services/chat.service';
import { MessageBubbleComponent } from '../message-bubble/message-bubble.component';

@Component({
  selector: 'app-message-list',
  standalone: true,
  imports: [CommonModule, MessageBubbleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #scrollContainer
      class="flex-1 overflow-y-auto py-4"
    >
      <div class="mx-auto w-full max-w-2xl px-4">
      @if (!chat.activeConversation() || chat.activeConversation()!.messages.length === 0) {
        <div class="flex min-h-64 flex-col items-center justify-center px-4 text-center select-none">
          <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-200 text-3xl dark:bg-gray-700">
            &#128172;
          </div>
          <h2 class="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-300">Chat UI</h2>
          <p class="text-sm text-gray-500 dark:text-gray-500">Select a model and start chatting</p>
        </div>
      } @else {
        @for (msg of messages(); track msg.id; let last = $last) {
          <app-message-bubble
            [message]="msg"
            [isLast]="last"
            [isStreaming]="chat.isStreaming()"
            [conversationId]="chat.activeConversation()!.id"
          />
        }
      }
      </div>
    </div>
  `,
})
export class MessageListComponent implements AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef<HTMLDivElement>;

  chat = inject(ChatService);
  messages = computed(() => this.chat.activeConversation()?.messages ?? []);

  private lastScrollKey = '';

  ngAfterViewChecked(): void {
    const conv = this.chat.activeConversation();
    const key = `${conv?.id ?? ''}-${conv?.messages.length ?? 0}-${this.chat.isStreaming()}`;
    if (key !== this.lastScrollKey) {
      this.lastScrollKey = key;
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    if (this.scrollContainer) {
      const el = this.scrollContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }
}
