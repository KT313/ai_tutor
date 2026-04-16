# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Two standalone, single-file HTML study tools ("AI Tutor") that run entirely in the browser against the Gemini API — one German (`german_og/`), one Korean (`korean/`). There is **no build system, no package manager, no tests, no server**. You open `site.html` by double-clicking it.

The two directories are near-duplicates of the same app translated into different languages. When fixing a bug in one, check whether the same fix applies to the other — but never cross-contaminate languages (see "Language discipline" below). A recent commit ("fixed switched languages") exists because a translation leaked across locales.

## Running / "developing"

- **Run:** open `german_og/site.html` or `korean/site.html` directly in a browser.
- **API key:** paste a Gemini API key into the input at the top of the page and click Save. It's stored in `localStorage` under `geminiApiKey`. The key is never bundled with the file.
- **Study data:** the study material is a JavaScript constant `CONTENT_DATA` embedded directly in `site.html` (around line 646). Users replace it manually when generating content for a new subject.
- **Model:** hardcoded as `gemini-3-flash-preview` in `site.html` (there's an active streaming copy and a commented-out non-streaming copy — update both call sites when changing the model).

## Architecture in one pass

A single `site.html` contains CSS, the `CONTENT_DATA` array, and all JS. At `DOMContentLoaded`:

1. **Rendering** — `renderCards(CONTENT_DATA)` turns each entry into a `.card` with a title and a `<ul>` of hover-tooltip items. Each content item has three fields:
   - `string` — the short visible label (1–3 words)
   - `tooltip` — short hover definition (may contain `<strong>`/`<br>`)
   - `verbose_tutor_info` — hidden extra context passed only to the LLM, never shown to the user
2. **Per-card tutor context** — while building each card, the code concatenates the title + all tooltips + all `verbose_tutor_info` into a single string on `card.dataset.tutorContext`. This is what the LLM sees when the user opens that card's tutor.
3. **Tutor modal** — clicking "Tutor fragen" / "AI 튜터" opens a modal that streams from `generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent`. The chat history is a turn-based `[{role, parts:[{text}]}]` array; same-role consecutive messages are merged by `addToChatHistory`. The first user turn bundles `systemPromptInfo` + `optional_instruction` (if toggled) + the card's `tutorContext`.
4. **Per-card persistence** — chat history, modal state, and unsent draft input are all persisted to `localStorage` under keys derived from the topic title (`tutorHistory_<topic>`, `tutorInput_<topic>`). Each card remembers its own conversation across reloads. The "remove last" and "clear history" buttons mutate these.

There is no router, no modules, no framework. Everything is DOM manipulation inside one `DOMContentLoaded` handler.

## The `CONTENT_DATA` shape

```js
const CONTENT_DATA = [
  {
    title: { string, tooltip, verbose_tutor_info, extra_class? },
    content: [
      // each inner array is one <li> row; items in the row render inline with spaces
      [ { string, tooltip, verbose_tutor_info }, { string, tooltip, verbose_tutor_info } ],
      ...
    ]
  },
  ...
]
```

Convention enforced by the generation prompts (`prompts/1a.txt`, `prompts/2a.txt`): `string` must be extremely short (a label, not a sentence). Rows that represent "label → sub-items" end the first `string` with a colon. Full authoring rules live in `prompts/1a.txt` — read it before editing content structure or writing new `CONTENT_DATA`.

## Language discipline

Every user-visible string, the `<title>`, `<html lang>`, button labels, error messages, placeholders, `systemPromptInfo`, and `optional_instruction` must stay in the directory's language. German belongs in `german_og/`, Korean in `korean/`. Do not translate one file's strings into the other's language — that's the bug the last commit fixed. When adding a feature, add parallel strings to both files in the correct language.

## The `prompts/` workflow (context, not code)

`german_og/prompts/` and `korean/prompts/` contain text files users paste into gemini.google.com to generate `CONTENT_DATA` from lecture PDFs. This is a manual, out-of-repo workflow; `setup_steps.txt` and `generation_steps.txt` in each directory explain it to end users. Claude usually shouldn't need to touch these, but if the `CONTENT_DATA` schema or card-authoring conventions change, update `1a.txt` and `2a.txt` in both language directories to match — they embed the schema spec verbatim.
