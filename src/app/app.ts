import {
  Component, inject, signal, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService } from './services/chat.service';
import { ConversationListComponent } from './components/sidebar/conversation-list/conversation-list.component';
import { ModelSelectorComponent } from './components/sidebar/model-selector/model-selector.component';
import { MessageListComponent } from './components/chat/message-list/message-list.component';
import { InputBarComponent } from './components/chat/input-bar/input-bar.component';
import { SettingsPanelComponent } from './components/settings/settings-panel/settings-panel.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ConversationListComponent,
    ModelSelectorComponent,
    MessageListComponent,
    InputBarComponent,
    SettingsPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class AppComponent {
  chat = inject(ChatService);
  settingsOpen = signal<boolean>(false);
}
