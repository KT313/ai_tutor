# AI Tutor

Turn lecture notes into an interactive, AI-powered exam-prep site.

Study material renders as a grid of topic cards with hover definitions. Each topic has a built-in AI tutor that asks exam-style questions, grades your answers with structured feedback, and keeps a per-topic chat that survives reloads.

<!-- ![AI Tutor screenshot](docs/screenshot.png) -->

## Features

- **Three-layer content:** each card item has a short visible label, a hover definition, and hidden extra context passed only to the LLM — a scannable cheat sheet on the surface, full lecture context underneath.
- **Tutor loop:** question → your answer → structured correction → next question, with free-form follow-ups. Responses stream in live.
- **Bring your own subject:** upload your lecture PDFs in the app and it generates the study content for you. Switch between generated content sets with the built-in picker.
- **Multi-language UI** (German, English, Japanese, Korean) and **two LLM providers** (Gemini or OpenRouter).

## Repo layout

- `ai_tutor_react/` — the main app: React 18 + TypeScript + Vite + Tailwind, with a small Hono (Node) API for file-based persistence and server-side content generation.
- `german_og/`, `korean/` — the original versions: one self-contained `site.html` each (German / Korean), zero dependencies, no build step, with a manual prompt-based content workflow.

## Quick start

You need a free [Gemini API key](https://aistudio.google.com/apikey) (or an OpenRouter key).

```bash
cd ai_tutor_react
npm install
npm run dev   # client on :5173, persistence server on :5174
```

Open http://localhost:5173 and paste your API key. Or, for the single-file version, just open `german_og/site.html` or `korean/site.html` in a browser.

The key is stored only in your browser's `localStorage`; requests go directly to the LLM provider.

## Implementation notes

- Hand-rolled streaming parser for Gemini's chunked JSON output (escape-aware brace counting, no SDK) — `ai_tutor_react/src/lib/gemini.ts`.
- Content generation runs server-side: uploaded PDFs are sent through a multi-step prompt pipeline (`ai_tutor_react/prompts/`) and parsed into validated content JSON.
- Sanitized markdown rendering via `react-markdown` + DOMPurify; atomic write-and-rename persistence on the server.
