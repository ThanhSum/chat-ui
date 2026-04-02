import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService } from '../../../services/chat.service';

@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
      @if (chat.conversations().length === 0) {
        <p class="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-600">No conversations yet</p>
      }
      @for (conv of chat.conversations(); track conv.id) {
        <div (click)="selectConv(conv.id)"
             class="group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
             [class]="chat.activeConversationId() === conv.id
               ? 'bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white'
               : 'text-gray-500 hover:bg-gray-50 dark:text-gray-500 dark:hover:bg-white/5'">
          <svg class="h-3.5 w-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          <span class="flex-1 truncate text-xs">{{ conv.title }}</span>
          <button (click)="deleteConv($event, conv.id)"
                  class="rounded p-0.5 text-gray-300 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100 dark:text-gray-600">
            <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      }
    </div>
  `,
})
export class ConversationListComponent {
  chat = inject(ChatService);

  selectConv(id: string): void { this.chat.selectConversation(id); }
  deleteConv(event: MouseEvent, id: string): void {
    event.stopPropagation();
    this.chat.deleteConversation(id);
  }
}
