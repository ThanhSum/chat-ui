import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, SendMessageParams, Message } from './provider.interface';

export class GeminiProvider implements AIProvider {
  sendMessage(params: SendMessageParams): AbortController {
    const controller = new AbortController();

    const genAI = new GoogleGenerativeAI(params.apiKey);
    const model = genAI.getGenerativeModel({
      model: params.model,
      systemInstruction: params.systemPrompt || undefined,
    });

    // Convert to Gemini history format (all messages except the last)
    const history = params.messages.slice(0, -1).map((m: Message) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const lastMsg = params.messages[params.messages.length - 1];

    (async () => {
      try {
        const chat = model.startChat({
          history,
          generationConfig: {
            temperature: params.temperature ?? 0.7,
            maxOutputTokens: params.maxTokens ?? 2048,
          },
        });

        const result = await chat.sendMessageStream(lastMsg?.content ?? '', { signal: controller.signal });

        for await (const chunk of result.stream) {
          if (controller.signal.aborted) break;
          const text = chunk.text();
          if (text) params.onChunk(text);
        }

        if (!controller.signal.aborted) params.onDone();
      } catch (err: any) {
        if (controller.signal.aborted) {
          params.onDone();
        } else {
          params.onError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    })();

    return controller;
  }
}
