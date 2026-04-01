import { AIProvider, SendMessageParams } from './provider.interface';

export class OllamaProvider implements AIProvider {
  sendMessage(params: SendMessageParams): AbortController {
    const controller = new AbortController();
    const baseUrl = params.apiKey || 'http://localhost:11434';

    const messages = params.systemPrompt
      ? [{ role: 'system', content: params.systemPrompt }, ...params.messages]
      : params.messages;

    (async () => {
      try {
        const response = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: params.model,
            messages,
            stream: true,
            options: {
              temperature: params.temperature ?? 0.7,
              num_predict: params.maxTokens ?? 2048,
            },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Ollama error ${response.status}: ${text}`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done || controller.signal.aborted) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line);
              const text = json.message?.content ?? '';
              if (text) params.onChunk(text);
              if (json.done) break;
            } catch {}
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
