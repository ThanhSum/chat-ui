# Chat UI

A full-featured AI chat interface built with Angular 18, supporting multiple AI providers with streaming responses.

## Prerequisites

- Node 18+
- Angular CLI (`npm install -g @angular/cli@latest`)
- Ollama (optional — for local models)

## Setup

```bash
mkdir chat-ui && cd chat-ui
npm install -g @angular/cli@latest
ng new chat-ui --routing=false --style=scss --standalone=true --skip-git=true
cd chat-ui
npm install tailwindcss @tailwindcss/typography postcss autoprefixer
npm install @types/node
npm install marked highlight.js
npm install openai @anthropic-ai/sdk @google/generative-ai groq-sdk
npm install @angular/cdk @angular/animations
npm install @tailwindcss/postcss
npx tailwindcss init -p
```

## Run

```bash
ng serve
```

Open [http://localhost:4200](http://localhost:4200).

## API Keys

Click the gear icon (⚙) in the bottom-left of the sidebar to open Settings. Enter your API keys for the providers you want to use. Keys are stored in `localStorage` and never sent anywhere except the respective AI provider's API.

Supported providers:
- **OpenAI** — gpt-4o, gpt-4o-mini, gpt-4-turbo, o3, o4-mini
- **Anthropic** — claude-opus-4-5, claude-sonnet-4-5, claude-haiku-3-5
- **Gemini** — gemini-2.0-flash, gemini-2.5-pro, gemini-1.5-pro
- **Groq** — llama-3.3-70b-versatile, mixtral-8x7b-32768, gemma2-9b-it
- **OpenRouter** — dynamically fetched model list

## Ollama models

Install Ollama from [ollama.com](https://ollama.com), then pull a model:

```bash
ollama pull llama3.2
ollama pull mistral
ollama pull codellama
```

The app auto-detects Ollama at `http://localhost:11434`. Configure a different URL in Settings → Ollama.
