import {
  Component, Input, inject, signal, ChangeDetectionStrategy, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../../services/settings.service';
import { ProviderName } from '../../../providers/provider.interface';

@Component({
  selector: 'app-api-key-row',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-2">
      <div class="flex-1 relative">
        <input
          [(ngModel)]="draftKey"
          [type]="revealed() ? 'text' : 'password'"
          [placeholder]="'Enter ' + label + ' API key'"
          class="w-full rounded-lg border bg-white px-3 py-2 pr-10 text-sm text-gray-900 transition-colors
                 focus:border-blue-500 focus:outline-none
                 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-gray-500"
          [ngClass]="!saved() ? 'border-gray-300 dark:border-gray-600' : ''"
          [class.border-green-600]="saved()"
        />
        <button
          (click)="revealed.update(v => !v)"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          type="button"
        >
          {{ revealed() ? '&#128065;' : '&#128274;' }}
        </button>
      </div>

      <button
        (click)="save()"
        class="rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors"
        [ngClass]="saved() ? 'bg-green-700 hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-500'"
      >
        {{ saved() ? '&#10003; Saved' : 'Save' }}
      </button>

      <div
        class="w-2 h-2 rounded-full flex-shrink-0"
        [class.bg-green-500]="hasSavedKey()"
        [class.bg-red-500]="!hasSavedKey()"
        [title]="hasSavedKey() ? 'API key set' : 'API key missing'"
      ></div>
    </div>
  `,
})
export class ApiKeyRowComponent implements OnInit {
  @Input({ required: true }) provider!: ProviderName;
  @Input({ required: true }) label!: string;

  private settingsService = inject(SettingsService);

  draftKey = '';
  revealed = signal<boolean>(false);
  saved = signal<boolean>(false);

  hasSavedKey(): boolean {
    return !!this.settingsService.getApiKey(this.provider);
  }

  ngOnInit(): void {
    this.draftKey = this.settingsService.getApiKey(this.provider);
  }

  save(): void {
    this.settingsService.setApiKey(this.provider, this.draftKey);
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}
