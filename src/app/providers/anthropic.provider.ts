import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, SendMessageParams } from './provider.interface';

export class AnthropicProvider implements AIProvider {
  sendMessage(params: SendMessageParams): AbortController {
    const controller = new AbortController();

    const client = new Anthropic({
      apiKey: params.apiKey,
      dangerouslyAllowBrowser: true,
    });

    const messages = params.messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    (async () => {
      try {
        const stream = client.messages.stream(
          {
            model: params.model,
            max_tokens: params.maxTokens ?? 2048,
            messages,
            system: params.systemPrompt || undefined,
            temperature: params.temperature ?? 0.7,
          },
          { signal: controller.signal }
        );

        for await (const event of stream) {
          if (controller.signal.aborted) break;
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            params.onChunk(event.delta.text);
          }
        }

        if (!controller.signal.aborted) params.onDone();
      } catch (err: any) {
        if (err?.name === 'AbortError' || controller.signal.aborted) {
          params.onDone();
        } else {
          params.onError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    })();

    return controller;
  }
}
