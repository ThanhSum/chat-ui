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
    <div #scrollContainer class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-2xl px-4">

        @if (!chat.activeConversation() || chat.activeConversation()!.messages.length === 0) {
          <div class="flex min-h-[60vh] flex-col items-center justify-center select-none">
            <h1 class="text-2xl font-semibold text-gray-800 dark:text-gray-200">How can I help you today?</h1>
          </div>
        } @else {
          <div class="py-6 space-y-1">
            @for (msg of messages(); track msg.id; let last = $last) {
              <app-message-bubble
                [message]="msg"
                [isLast]="last"
                [isStreaming]="chat.isStreaming()"
                [conversationId]="chat.activeConversation()!.id"
              />
            }
          </div>
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
