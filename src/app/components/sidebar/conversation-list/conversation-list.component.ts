import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService } from '../../../services/chat.service';

@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col h-full">
      <div class="p-3">
        <button
          (click)="newChat()"
          class="w-full flex items-center gap-3 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700
                 transition-colors hover:border-gray-400 hover:bg-gray-50
                 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-700/50"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          New Chat
        </button>
      </div>

      <div class="flex-1 overflow-y-auto px-2 space-y-0.5">
        @for (conv of chat.conversations(); track conv.id) {
          <div
            (click)="selectConv(conv.id)"
            class="group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
            [class]="chat.activeConversationId() === conv.id
              ? 'bg-blue-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50'"
          >
            <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
            <span class="flex-1 truncate">{{ conv.title }}</span>
            <button
              (click)="deleteConv($event, conv.id)"
              class="rounded p-0.5 text-gray-400 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100 dark:text-gray-500 dark:hover:text-red-400"
              title="Delete"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        }
        @if (chat.conversations().length === 0) {
          <p class="px-4 py-6 text-center text-xs text-gray-500 dark:text-gray-600">No conversations yet</p>
        }
      </div>
    </div>
  `,
})
export class ConversationListComponent {
  chat = inject(ChatService);

  newChat(): void {
    this.chat.newConversation();
  }

  selectConv(id: string): void {
    this.chat.selectConversation(id);
  }

  deleteConv(event: MouseEvent, id: string): void {
    event.stopPropagation();
    this.chat.deleteConversation(id);
  }
}
