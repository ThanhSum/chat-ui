import {
  Component, inject, computed, ChangeDetectionStrategy,
  signal, HostListener, ElementRef
} from '@angular/core';
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
        <label class="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">Provider</label>
        <div class="relative">
          <select
            [ngModel]="chat.selectedProvider()"
            (ngModelChange)="onProviderChange($event)"
            class="w-full appearance-none rounded border border-[#d1d9e0] bg-[#f6f8fa] py-2 pr-8 text-sm text-[#1f2328]
                   focus:border-[#388bfd] focus:outline-none
                   dark:border-[#30363d] dark:bg-[#161b22] dark:text-[#e6edf3]"
            [class.pl-7]="chat.selectedProvider() === 'ollama'"
            [class.pl-3]="chat.selectedProvider() !== 'ollama'"
          >
            @for (p of providers; track p.value) {
              <option [value]="p.value">{{ p.label }}</option>
            }
          </select>
          @if (chat.selectedProvider() === 'ollama') {
            <span class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full"
                  [class.bg-green-500]="chat.ollamaOnline()"
                  [class.bg-red-500]="!chat.ollamaOnline()"></span>
          }
          <svg class="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
               viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clip-rule="evenodd" />
          </svg>
        </div>
        @if (chat.selectedProvider() === 'ollama') {
          <p class="mt-1 text-[10px]"
             [class.text-green-500]="chat.ollamaOnline()"
             [class.text-red-500]="!chat.ollamaOnline()">
            {{ chat.ollamaOnline() ? '● Connected · ' + chat.ollamaModels().length + ' models' : '● Offline' }}
          </p>
        }
      </div>

      <div>
        <label class="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">Model</label>

        @if (chat.selectedProvider() === 'ollama') {
          <div class="relative">
            <div (click)="modelDropdownOpen.set(!modelDropdownOpen())"
                 class="w-full cursor-pointer rounded border border-[#d1d9e0] bg-[#f6f8fa] px-3 py-2 text-sm
                        hover:border-gray-400 dark:border-[#30363d] dark:bg-[#161b22] dark:hover:border-[#8b949e]">
              <div class="flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="truncate font-semibold text-[#1f2328] dark:text-[#e6edf3]">
                    {{ chat.selectedModel() || 'No model selected' }}
                  </div>
                  @if (currentMeta(); as meta) {
                    <div class="text-[10px] text-gray-500 dark:text-[#8b949e]">
                      {{ meta.parameterSize }}{{ meta.parameterSize && meta.sizeGb ? ' · ' : '' }}{{ meta.sizeGb }}
                    </div>
                  }
                </div>
                <svg class="h-4 w-4 flex-shrink-0 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clip-rule="evenodd" />
                </svg>
              </div>
            </div>
            @if (modelDropdownOpen()) {
              <ul class="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-48 overflow-y-auto rounded border border-[#d1d9e0] bg-[#f6f8fa] shadow-lg dark:border-[#30363d] dark:bg-[#161b22]">
                @if (availableModels().length === 0) {
                  <li class="px-3 py-2 text-sm text-gray-500">No models available</li>
                }
                @for (m of availableModels(); track m) {
                  <li (click)="selectOllamaModel(m)"
                      class="cursor-pointer px-3 py-2 text-sm hover:bg-[#eaeef2] dark:hover:bg-[#21262d]">
                    <div class="font-medium text-[#1f2328] dark:text-[#e6edf3]">{{ m }}</div>
                    @if (getMeta(m); as meta) {
                      <div class="text-[10px] text-gray-500 dark:text-[#8b949e]">
                        {{ meta.parameterSize }}{{ meta.parameterSize && meta.sizeGb ? ' · ' : '' }}{{ meta.sizeGb }}
                      </div>
                    }
                  </li>
                }
              </ul>
            }
          </div>
        } @else {
          <div class="relative">
            <select
              [ngModel]="chat.selectedModel()"
              (ngModelChange)="onModelChange($event)"
              class="w-full appearance-none rounded border border-[#d1d9e0] bg-[#f6f8fa] px-3 py-2 pr-8 text-sm text-[#1f2328]
                     focus:border-[#388bfd] focus:outline-none
                     dark:border-[#30363d] dark:bg-[#161b22] dark:text-[#e6edf3]"
            >
              @for (m of availableModels(); track m) {
                <option [value]="m">{{ m }}</option>
              }
              @if (availableModels().length === 0) {
                <option value="" disabled>No models available</option>
              }
            </select>
            <svg class="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
                 viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clip-rule="evenodd" />
            </svg>
          </div>
        }
      </div>
    </div>
  `,
})
export class ModelSelectorComponent {
  chat = inject(ChatService);
  private el = inject(ElementRef);
  modelDropdownOpen = signal(false);

  providers: { value: ProviderName; label: string }[] = (
    Object.keys(PROVIDER_LABELS) as ProviderName[]
  ).map(k => ({ value: k, label: PROVIDER_LABELS[k] }));

  availableModels = computed<string[]>(() => {
    const p = this.chat.selectedProvider();
    if (p === 'ollama') return this.chat.ollamaModels();
    if (p === 'openrouter') return this.chat.openRouterModels();
    return STATIC_MODELS[p as keyof typeof STATIC_MODELS] ?? [];
  });

  currentMeta = computed(() => this.chat.ollamaModelMeta()[this.chat.selectedModel()] ?? null);
  getMeta(m: string) { return this.chat.ollamaModelMeta()[m] ?? null; }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (!this.el.nativeElement.contains(e.target as Node)) this.modelDropdownOpen.set(false);
  }

  onProviderChange(provider: ProviderName): void {
    this.modelDropdownOpen.set(false);
    this.chat.selectedProvider.set(provider);
    this.chat.selectedModel.set(this.availableModels()[0] ?? '');
    this.chat.applySelectionToActiveConversation();
  }

  onModelChange(model: string): void {
    this.chat.selectedModel.set(model);
    this.chat.applySelectionToActiveConversation();
  }

  selectOllamaModel(model: string): void {
    this.modelDropdownOpen.set(false);
    this.onModelChange(model);
  }
}
