import {
  Component, inject, Output, EventEmitter, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../../services/settings.service';
import { ApiKeyRowComponent } from '../api-key-row/api-key-row.component';
import { OllamaConfigComponent } from '../ollama-config/ollama-config.component';
import { ProviderName } from '../../../providers/provider.interface';

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ApiKeyRowComponent, OllamaConfigComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/50 z-40"
      (click)="close.emit()"
    ></div>

    <!-- Panel -->
    <div
      class="fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-gray-200 bg-white shadow-2xl
             dark:border-gray-700 dark:bg-gray-900"
    >
      <!-- Header -->
      <div class="flex flex-shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
        <button
          (click)="close.emit()"
          class="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-gray-500 transition-colors
                 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >&#10005;</button>
      </div>

      <div class="flex-1 overflow-y-auto px-6 py-4 space-y-8">

        <!-- API Keys -->
        <section>
          <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">API Keys</h3>
          <div class="space-y-3">
            @for (item of apiKeyProviders; track item.provider) {
              <div>
                <label class="mb-1.5 block text-sm text-gray-700 dark:text-gray-300">{{ item.label }}</label>
                <app-api-key-row [provider]="item.provider" [label]="item.label" />
              </div>
            }
          </div>
        </section>

        <!-- Ollama -->
        <section>
          <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Ollama (Local)</h3>
          <app-ollama-config />
        </section>

        <!-- Parameters -->
        <section>
          <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Parameters</h3>
          <div class="space-y-4">

            <div>
              <div class="mb-1.5 flex justify-between text-sm">
                <label class="text-gray-700 dark:text-gray-300">Temperature</label>
                <span class="font-mono text-gray-600 dark:text-gray-400">{{ settings.settings().temperature.toFixed(1) }}</span>
              </div>
              <input
                type="range" min="0" max="2" step="0.1"
                [ngModel]="settings.settings().temperature"
                (ngModelChange)="settings.updateSettings({ temperature: +$event })"
                class="w-full accent-blue-500"
              />
              <div class="mt-0.5 flex justify-between text-xs text-gray-500 dark:text-gray-600">
                <span>Precise</span><span>Creative</span>
              </div>
            </div>

            <div>
              <label class="mb-1.5 block text-sm text-gray-700 dark:text-gray-300">Max Tokens</label>
              <input
                type="number" min="1" max="32000" step="256"
                [ngModel]="settings.settings().maxTokens"
                (ngModelChange)="settings.updateSettings({ maxTokens: +$event })"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900
                       focus:border-blue-500 focus:outline-none
                       dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-gray-500"
              />
            </div>

            <div>
              <label class="mb-1.5 block text-sm text-gray-700 dark:text-gray-300">System Prompt</label>
              <textarea
                rows="4"
                [ngModel]="settings.settings().systemPrompt"
                (ngModelChange)="settings.updateSettings({ systemPrompt: $event })"
                placeholder="You are a helpful assistant..."
                class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900
                       focus:border-blue-500 focus:outline-none
                       dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-gray-500"
              ></textarea>
            </div>
          </div>
        </section>

        <!-- Appearance -->
        <section>
          <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Appearance</h3>
          <div class="space-y-4">

            <div class="flex items-center justify-between">
              <label class="text-sm text-gray-700 dark:text-gray-300">Dark Mode</label>
              <button
                (click)="toggleDark()"
                class="relative h-6 w-11 rounded-full transition-colors"
                [class.bg-blue-600]="settings.settings().darkMode"
                [ngClass]="!settings.settings().darkMode ? 'bg-gray-300 dark:bg-gray-600' : ''"
              >
                <span
                  class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                  [style.left]="settings.settings().darkMode ? '1.25rem' : '0.125rem'"
                ></span>
              </button>
            </div>

            <div>
              <label class="mb-2 block text-sm text-gray-700 dark:text-gray-300">Font Size</label>
              <div class="flex gap-2">
                @for (sz of fontSizes; track sz.value) {
                  <button
                    (click)="settings.updateSettings({ fontSize: sz.value })"
                    class="flex-1 rounded-lg border py-1.5 text-sm transition-colors"
                    [class.border-blue-600]="settings.settings().fontSize === sz.value"
                    [class.bg-blue-600]="settings.settings().fontSize === sz.value"
                    [class.text-white]="settings.settings().fontSize === sz.value"
                    [class.border-gray-300]="settings.settings().fontSize !== sz.value"
                    [class.bg-gray-100]="settings.settings().fontSize !== sz.value"
                    [class.text-gray-700]="settings.settings().fontSize !== sz.value"
                    [class.dark:border-gray-600]="settings.settings().fontSize !== sz.value"
                    [class.dark:bg-gray-800]="settings.settings().fontSize !== sz.value"
                    [class.dark:text-gray-300]="settings.settings().fontSize !== sz.value"
                  >{{ sz.label }}</button>
                }
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  `,
})
export class SettingsPanelComponent {
  @Output() close = new EventEmitter<void>();

  settings = inject(SettingsService);

  apiKeyProviders: { provider: ProviderName; label: string }[] = [
    { provider: 'openai', label: 'OpenAI' },
    { provider: 'anthropic', label: 'Anthropic' },
    { provider: 'gemini', label: 'Gemini' },
    { provider: 'groq', label: 'Groq' },
    { provider: 'openrouter', label: 'OpenRouter' },
  ];

  fontSizes: { value: 'sm' | 'md' | 'lg'; label: string }[] = [
    { value: 'sm', label: 'Small' },
    { value: 'md', label: 'Medium' },
    { value: 'lg', label: 'Large' },
  ];

  toggleDark(): void {
    this.settings.updateSettings({ darkMode: !this.settings.settings().darkMode });
  }
}
