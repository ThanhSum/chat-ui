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
        <select
          [ngModel]="chat.selectedProvider()"
          (ngModelChange)="onProviderChange($event)"
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900
                 focus:border-blue-500 focus:outline-none
                 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-gray-500"
        >
          @for (p of providers; track p.value) {
            <option [value]="p.value">{{ p.label }}</option>
          }
        </select>
      </div>

      <div>
        <label class="mb-1 block text-xs text-gray-500">Model</label>
        <select
          [ngModel]="chat.selectedModel()"
          (ngModelChange)="onModelChange($event)"
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900
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
