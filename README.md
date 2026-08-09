# AI Tutor

Turn lecture notes into an interactive, AI-powered exam-prep site.

Study material renders as a grid of topic cards with hover definitions. Each topic has a built-in AI tutor that asks exam-style questions, grades your answers with structured feedback, and keeps a per-topic chat that survives reloads.

![Topic cards generated from lecture PDFs](docs/card-grid.png)

## Features

- **Three-layer content:** each card item has a short visible label, a hover definition, and hidden extra context passed only to the LLM — a scannable cheat sheet on the surface, full lecture context underneath.
- **Tutor loop:** question → your answer → structured correction → next question, with free-form follow-ups. Responses stream in live.
- **Bring your own subject:** upload your lecture PDFs in the app and it generates the study content for you. Switch between content sets with the built-in picker.
- **Multi-language UI** (German, English, Japanese, Korean) and **two LLM providers** (Gemini or OpenRouter) with selectable tutor model.

| Tutor session | Generate content from PDFs | Settings |
|---|---|---|
| ![Tutor modal with question, answer and evaluation](docs/tutor-modal.png) | ![Content selection with PDF generation form](docs/content-selection.png) | ![Provider, API key and model settings](docs/settings.png) |

## Stack

React 18 + TypeScript + Vite + Tailwind on the client; a small Hono (Node) API for file-based persistence and server-side content generation.

## Quick start

You need a free [Gemini API key](https://aistudio.google.com/apikey) (or an OpenRouter key).

```bash
cd ai_tutor_react
npm install
npm run dev   # client on :5173, persistence server on :5174
```

Open http://localhost:5173 and paste your API key in the settings.

The key is stored only in your browser's `localStorage`; requests go directly to the LLM provider.

## Implementation notes

- Hand-rolled streaming parser for Gemini's chunked JSON output (escape-aware brace counting, no SDK) — `ai_tutor_react/src/lib/gemini.ts`.
- Content generation runs server-side: uploaded PDFs are sent through a multi-step prompt pipeline (`ai_tutor_react/prompts/`) and parsed into validated content JSON.
- Sanitized markdown rendering via `react-markdown` + DOMPurify; atomic write-and-rename persistence on the server.
