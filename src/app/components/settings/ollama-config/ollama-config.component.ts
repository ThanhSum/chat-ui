import {
  Component, inject, signal, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../../services/settings.service';
import { ChatService } from '../../../services/chat.service';

@Component({
  selector: 'app-ollama-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3">
      <!-- Same grid as api-key-row: input | Save | status column (spacer matches key status dot) -->
      <div class="flex items-center gap-2">
        <div class="relative min-w-0 flex-1">
          <input
            [(ngModel)]="baseUrl"
            type="url"
            placeholder="http://localhost:11434"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900
                   focus:border-blue-500 focus:outline-none
                   dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-gray-500"
          />
        </div>
        <button
          (click)="save()"
          type="button"
          class="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          Save
        </button>
        <div
          class="h-2 w-2 shrink-0 rounded-full"
          [ngClass]="
            testResult() === true ? 'bg-green-500'
            : testResult() === false ? 'bg-red-500'
            : 'bg-gray-300 dark:bg-gray-600'"
          [title]="testResult() === true ? 'Reachable' : testResult() === false ? 'Unreachable' : 'Not tested'"
        ></div>
      </div>

      <div class="flex items-center gap-3">
        <button
          (click)="testConnection()"
          [disabled]="testing()"
          class="rounded-lg bg-gray-200 px-3 py-2 text-sm text-gray-800 transition-colors
                 hover:bg-gray-300 disabled:opacity-50
                 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          {{ testing() ? 'Testing...' : 'Test Connection' }}
        </button>

        @if (testResult() !== null) {
          <span
            class="text-sm"
            [class.text-green-400]="testResult() === true"
            [class.text-red-400]="testResult() === false"
          >
            {{ testResult() ? '&#10003; Connected' : '&#10007; Unreachable' }}
          </span>
        }
      </div>

      @if (chat.ollamaModels().length > 0) {
        <div class="text-xs text-gray-600 dark:text-gray-400">
          Models: {{ chat.ollamaModels().join(', ') }}
        </div>
      }
    </div>
  `,
})
export class OllamaConfigComponent {
  private settingsService = inject(SettingsService);
  chat = inject(ChatService);

  baseUrl = this.settingsService.settings().ollamaBaseUrl;
  testing = signal<boolean>(false);
  testResult = signal<boolean | null>(null);

  save(): void {
    this.settingsService.updateSettings({ ollamaBaseUrl: this.baseUrl });
  }

  async testConnection(): Promise<void> {
    this.testing.set(true);
    this.testResult.set(null);
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(4000),
      });
      this.testResult.set(res.ok);
      if (res.ok) await this.chat.checkOllama();
    } catch {
      this.testResult.set(false);
    } finally {
      this.testing.set(false);
    }
  }
}
