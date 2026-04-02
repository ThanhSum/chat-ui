import OpenAI from 'openai';
import { AIProvider, SendMessageParams } from './provider.interface';

export class OpenAIProvider implements AIProvider {
  sendMessage(params: SendMessageParams): AbortController {
    const controller = new AbortController();

    const client = new OpenAI({
      apiKey: params.apiKey,
      dangerouslyAllowBrowser: true,
    });

    const slim = params.messages.map(m => ({ role: m.role, content: m.content }));
    const messages = params.systemPrompt
      ? [{ role: 'system' as const, content: params.systemPrompt }, ...slim]
      : slim;

    (async () => {
      try {
        const stream = await client.chat.completions.create(
          {
            model: params.model,
            messages,
            stream: true,
            temperature: params.temperature ?? 0.7,
            max_tokens: params.maxTokens ?? 2048,
          },
          { signal: controller.signal }
        );

        for await (const chunk of stream) {
          if (controller.signal.aborted) break;
          const text = chunk.choices[0]?.delta?.content ?? '';
          if (text) params.onChunk(text);
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
