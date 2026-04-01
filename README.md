# Chat UI

A full-featured AI chat interface built with Angular 18, supporting multiple AI providers with streaming responses.

## Prerequisites

- Node 18+
- Angular CLI (`npm install -g @angular/cli@latest`)
- Ollama (optional — for local models)

## Setup

```bash
git clone <REPO_URL> chat-ui
cd chat-ui

npm install
```

## Notes

- **Standalone Angular app**: Standalone application structure is new and not yet supported by many existing `ng add` and `ng update` integrations with community libraries.
- **Tailwind CLI**: If you see `npm error could not determine executable to run` for `npm exec tailwindcss init -p`, that’s expected with Tailwind v4+ (the `tailwindcss` package no longer exposes a `tailwindcss` binary). This repo is already configured; you don’t need to run `tailwindcss init`.

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
