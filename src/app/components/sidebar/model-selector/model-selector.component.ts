import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../../services/chat.service';
import { ProviderName, PROVIDER_LABELS, STATIC_MODELS } from '../../../providers/provider.interface';

@Component({
  selector: 'app-model-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-2 border-t border-gray-200 p-3 dark:border-gray-700">
      <div>
        <label class="mb-1 block text-xs text-gray-500">Provider</label>
        <div class="relative">
          <select
            [ngModel]="chat.selectedProvider()"
            (ngModelChange)="onProviderChange($event)"
            class="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900
                   focus:border-blue-500 focus:outline-none
                   dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-gray-500"
          >
            @for (p of providers; track p.value) {
              <option [value]="p.value">{{ p.label }}</option>
            }
          </select>
          <svg
            class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clip-rule="evenodd" />
          </svg>
        </div>
      </div>

      <div>
        <label class="mb-1 block text-xs text-gray-500">Model</label>
        <div class="relative">
          <select
            [ngModel]="chat.selectedModel()"
            (ngModelChange)="onModelChange($event)"
            class="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900
                   focus:border-blue-500 focus:outline-none
                   dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-gray-500"
          >
            @for (m of availableModels(); track m) {
              <option [value]="m">{{ m }}</option>
            }
            @if (availableModels().length === 0) {
              <option value="" disabled>No models available</option>
            }
          </select>
          <svg
            class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clip-rule="evenodd" />
          </svg>
        </div>
      </div>
    </div>
  `,
})
export class ModelSelectorComponent {
  chat = inject(ChatService);

  providers: { value: ProviderName; label: string }[] = (
    Object.keys(PROVIDER_LABELS) as ProviderName[]
  ).map(k => ({ value: k, label: PROVIDER_LABELS[k] }));

  availableModels = computed<string[]>(() => {
    const p = this.chat.selectedProvider();
    if (p === 'ollama') return this.chat.ollamaModels();
    if (p === 'openrouter') return this.chat.openRouterModels();
    return STATIC_MODELS[p as keyof typeof STATIC_MODELS] ?? [];
  });

  onProviderChange(provider: ProviderName): void {
    this.chat.selectedProvider.set(provider);
    const models = this.availableModels();
    this.chat.selectedModel.set(models[0] ?? '');
    this.chat.applySelectionToActiveConversation();
  }

  onModelChange(model: string): void {
    this.chat.selectedModel.set(model);
    this.chat.applySelectionToActiveConversation();
  }
}
