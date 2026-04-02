# UI Elements Design — GitHub-style Polish

**Date:** 2026-04-02  
**Status:** Approved  
**Approach:** Targeted component upgrades (Option 1 — no layout shell changes)  
**Design direction:** GitHub Dark aesthetic — sharp edges, `#0d1117` backgrounds, `#30363d` borders, muted greens/blues

---

## Scope

Three component areas receive targeted upgrades:

- **A** — Model & provider selector (sidebar)
- **C** — Input bar
- **D** — Message bubbles & code blocks

Light/dark mode toggle is preserved throughout. All changes apply GitHub-style tokens to both themes.

---

## A. Model & Provider Selector

**File:** `src/app/components/sidebar/model-selector/model-selector.component.ts`

### Changes

#### Provider dropdown — Ollama status dot
- A colored dot is injected to the left of the provider `<select>` via absolute positioning.
- **Green** (`#3fb950`, with a subtle glow) when `chat.ollamaOnline()` is true.
- **Red** (`#f85149`) when Ollama is offline.
- A one-line status caption below the dropdown reads: `● Connected · N models available` (green) or `● Offline` (red).
- The dot and caption are only shown when the selected provider is `ollama`.

#### Model selector — rich card
- Replace the bare `<select>` with a styled card `<div>` that opens a custom dropdown on click.
- The card displays:
  - Model name (e.g. `llama3.2`) — bold
  - Metadata row: param count, context length, disk size — sourced from Ollama's `/api/tags` response (`details.parameter_size`, `details.context_length`, `size`)
- The dropdown list replicates the existing `availableModels()` computed signal, styled as a `<ul>` overlay.
- For non-Ollama providers, fall back to a standard styled `<select>` (no metadata available).

#### Label style
- Section labels (`Provider`, `Model`) switch to `text-[10px] uppercase tracking-wider text-gray-500` — tighter, GitHub-native.

### Colors (dark / light)
| Token | Dark | Light |
|---|---|---|
| Surface | `#161b22` | `#f6f8fa` |
| Border | `#30363d` | `#d1d9e0` |
| Text | `#e6edf3` | `#1f2328` |
| Muted | `#8b949e` | `#656d76` |

---

## C. Input Bar

**File:** `src/app/components/chat/input-bar/input-bar.component.ts`

### Changes

#### System prompt pill
- A small pill button sits above the main input box: `⚙ System prompt [preset-name]`.
- Clicking it expands an inline `<textarea>` for editing the system prompt for the current conversation.
- The active preset name (or `default`) is shown as a badge inside the pill.
- The system prompt value is stored per-conversation in `ChatService` and prepended to the messages array as a `system` role message on send.

#### Main input box restyling
- Border changes from `rounded-2xl` to `rounded-lg` (8px) — sharper, more GitHub-native.
- Border color: `#30363d` (dark) / `#d1d9e0` (light). Focus ring: `#388bfd` (both modes).

#### Slash commands
- Typing `/` at the start of the input triggers a popup above the textarea listing available commands.
- The popup is filtered as the user types (e.g. `/exp` narrows to `/explain`).
- Initial command set:
  | Command | Action |
  |---|---|
  | `/explain` | Prepends "Explain this: " to the message |
  | `/fix` | Prepends "Fix the bugs in: " |
  | `/clear` | Clears conversation history (with confirmation) |
  | `/system` | Opens the system prompt editor |
- Commands are defined as a static array in the component; easily extensible.
- Popup dismisses on Escape or when the `/` prefix is removed.

#### Bottom toolbar
- Replaces the `"AI can make mistakes"` disclaimer with a thin toolbar inside the input box border:
  - Left: `↵ Send · ⇧↵ Newline` keyboard hint
  - Right: live token count estimate + send button
- Token count is a rough estimate: `Math.round(inputText.length / 4)`. For Ollama models (where context length is known from `/api/tags`), the count turns amber (`#d29922`) when within 10% of the limit. For other providers the count is shown but no amber warning is applied (context limit unknown).

#### ⌘K hint
- A passive `⌘K to search` label appears to the right of the system prompt pill. No-op for now — placeholder for a future command palette.

---

## D. Message Bubbles & Code Blocks

**File:** `src/app/components/chat/message-bubble/message-bubble.component.ts`

### Changes

#### Avatar shape
- Both user and assistant avatars change from `rounded-full` (circle) to `rounded` (4px square).
- Assistant avatar: replace the `"AI"` text with a small SVG chip/robot icon (not an emoji — emoji renders inconsistently across OS).

#### User bubble — Edit
- On hover, a row of action buttons appears below the user bubble (already exists for copy/delete).
- Add an **✏ Edit** button. Clicking it:
  1. Replaces the bubble content with an inline `<textarea>` pre-filled with `message.content`.
  2. Shows **Save** and **Cancel** buttons.
  3. On Save: updates the message in `ChatService`, truncates all messages after it, and re-sends.

#### Timestamps & generation time
- Each message shows a timestamp (`h:mm a`) below the bubble, in muted text, always visible (not hover-only).
- Assistant messages additionally show generation duration: `2:34 PM · 1.2s`. Duration is calculated from when streaming starts to when it ends, stored on the `ChatMessage` object as `durationMs`.

#### Streaming indicator
- Replace the blinking cursor (`streaming-cursor` span) with a `"Generating…"` badge below the last assistant bubble.
- Badge style: `bg-gray-800 border border-gray-700 text-xs text-gray-400 px-2 py-0.5 rounded animate-pulse`.
- Disappears when streaming ends.

#### Assistant bubble border
- Add `border border-gray-700 dark:border-[#30363d]` to assistant message bubbles for better separation on dark backgrounds.
- User bubbles keep their solid blue background (no border needed).

#### Code blocks — line numbers & improved header
- The `wrapCodeBlocks()` method in `MessageBubbleComponent` is updated to produce:
  ```html
  <div class="code-block-wrapper">
    <div class="code-header">
      <span class="lang-dot" data-lang="python"></span>  <!-- colored dot -->
      <span class="lang-label">python</span>
      <button class="copy-code-btn">⎘ Copy</button>
    </div>
    <div class="code-body">
      <div class="line-numbers">1\n2\n3</div>
      <pre><code class="language-python">...</code></pre>
    </div>
  </div>
  ```
- Line numbers are generated from the code content's line count and rendered in a fixed-width gutter.
- Language dot colors (defined in `styles.scss`): Python → `#f78166`, JS/TS → `#d2a8ff`, Shell → `#3fb950`, default → `#8b949e`.
- The gutter and `<pre>` scroll horizontally together.

---

## Data model additions

`ChatMessage` (in `chat.service.ts`) gains two optional fields:

```ts
durationMs?: number;   // ms from first token to stream end
editedAt?: number;     // timestamp of last user edit (unix ms)
```

---

## Out of scope

- Command palette (⌘K) — noted as a future feature, no implementation now
- Conversation search / date grouping in sidebar
- File attachments or voice input
- Any changes to the settings panel or providers

---

## Testing notes

- Ollama status dot: test with Ollama running, stopped, and with provider switched to non-Ollama.
- Slash command popup: test keyboard nav (↑↓ to select, Enter to apply, Escape to dismiss).
- Edit user message: verify truncation of subsequent messages and re-send flow.
- Token counter: verify it updates on every keystroke without lag.
- Code block line numbers: test with single-line, multi-line, and very long lines (horizontal scroll).
- Light/dark mode: verify all new elements respect the `darkMode` setting.
