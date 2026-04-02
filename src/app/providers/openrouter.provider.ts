import { AIProvider, Message, SendMessageParams } from './provider.interface';

/** OpenAI-compatible chat message (OpenRouter). */
function toOpenRouterMessage(m: Message): { role: string; content: string | object[] } {
  if (m.role === 'system') {
    return { role: 'system', content: m.content };
  }
  if (m.role === 'assistant') {
    return { role: 'assistant', content: m.content };
  }
  const imgs = m.images ?? [];
  if (imgs.length === 0) {
    return { role: 'user', content: m.content };
  }
  const parts: object[] = [];
  if (m.content.trim()) {
    parts.push({ type: 'text', text: m.content });
  }
  for (const img of imgs) {
    const url = `data:${img.mimeType};base64,${img.base64}`;
    parts.push({ type: 'image_url', image_url: { url } });
  }
  return { role: 'user', content: parts };
}

export class OpenRouterProvider implements AIProvider {
  sendMessage(params: SendMessageParams): AbortController {
    const controller = new AbortController();

    const mapped = params.messages.map(toOpenRouterMessage);
    const messages = params.systemPrompt
      ? [{ role: 'system', content: params.systemPrompt }, ...mapped]
      : mapped;

    (async () => {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${params.apiKey}`,
            'HTTP-Referer': window.location.href,
            'X-Title': 'Chat UI',
          },
          body: JSON.stringify({
            model: params.model,
            messages,
            stream: true,
            temperature: params.temperature ?? 0.7,
            max_tokens: params.maxTokens ?? 2048,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`OpenRouter error ${response.status}: ${text}`);
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
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              const text = json.choices?.[0]?.delta?.content ?? '';
              if (text) params.onChunk(text);
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
