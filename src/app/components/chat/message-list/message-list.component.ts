import {
  Component, inject, computed, AfterViewChecked,
  ElementRef, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService } from '../../../services/chat.service';
import { MessageBubbleComponent } from '../message-bubble/message-bubble.component';

const NEAR_BOTTOM_PX = 80;

@Component({
  selector: 'app-message-list',
  standalone: true,
  imports: [CommonModule, MessageBubbleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        #scrollContainer
        class="flex-1 overflow-y-auto"
        (scroll)="onScroll()"
      >
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

      @if (showScrollToBottom) {
        <button
          type="button"
          (click)="scrollToBottomAndFollow()"
          class="absolute bottom-3 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center
                 rounded-full border border-gray-200 bg-white text-gray-600 shadow-md
                 transition-colors hover:bg-gray-50 hover:text-gray-900
                 dark:border-white/10 dark:bg-[#2a2a2a] dark:text-gray-300 dark:hover:bg-[#333] dark:hover:text-white"
          title="Scroll to latest"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
      }
    </div>
  `,
})
export class MessageListComponent implements AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef<HTMLDivElement>;

  chat = inject(ChatService);
  private cdr = inject(ChangeDetectorRef);

  messages = computed(() => this.chat.activeConversation()?.messages ?? []);

  /** User is within NEAR_BOTTOM_PX of the bottom — new content should keep them pinned. */
  private allowAutoScroll = true;
  private lastConvId: string | null = null;
  /** Previous `isStreaming` — detect start of a new send so we scroll to latest again. */
  private wasStreaming = false;
  showScrollToBottom = false;

  ngAfterViewChecked(): void {
    const conv = this.chat.activeConversation();
    const el = this.scrollContainer?.nativeElement;
    if (!el) return;

    const streaming = this.chat.isStreaming();
    if (streaming && !this.wasStreaming) {
      // User just submitted (Enter) — always jump to latest for the new reply
      this.allowAutoScroll = true;
    }
    this.wasStreaming = streaming;

    const convId = conv?.id ?? '';
    if (convId !== this.lastConvId) {
      this.lastConvId = convId;
      this.allowAutoScroll = true;
      this.wasStreaming = streaming;
      el.scrollTop = el.scrollHeight;
      this.refreshScrollUi();
      return;
    }

    if (streaming && this.allowAutoScroll) {
      el.scrollTop = el.scrollHeight;
    }

    this.refreshScrollUi();
  }

  onScroll(): void {
    const el = this.scrollContainer?.nativeElement;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    this.allowAutoScroll = dist < NEAR_BOTTOM_PX;
    this.refreshScrollUi();
  }

  scrollToBottomAndFollow(): void {
    const el = this.scrollContainer?.nativeElement;
    if (!el) return;
    this.allowAutoScroll = true;
    el.scrollTop = el.scrollHeight;
    this.refreshScrollUi();
  }

  private refreshScrollUi(): void {
    const el = this.scrollContainer?.nativeElement;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const hasMessages = (this.chat.activeConversation()?.messages.length ?? 0) > 0;
    const next = dist > NEAR_BOTTOM_PX && hasMessages;
    if (next !== this.showScrollToBottom) {
      this.showScrollToBottom = next;
      this.cdr.markForCheck();
    }
  }
}
