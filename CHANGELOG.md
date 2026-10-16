# Development changelog

## 16 October 2026 — Model preparation gauge

- Show an animated circular gauge and elapsed-time clock in Model settings during Ollama preparation. No estimated percentage is displayed because the native API does not provide one.
- Preserve the clock across closing/reopening settings and replace the gauge with the actual completion or error result.
- Include an accessible progress indicator and timer, with reduced-motion support and interval cleanup.

Verification: production TypeScript build and 19 Java unit tests passed. Browser checks used actual Ollama loading, completion and error states, including reopening Model settings during preparation. See [validation evidence](docs/VALIDATION.md#model-preparation-gauge--16-october-2026).

## 16 October 2026 — Per-model memory preferences

- Add 5/30/60-minute presets and Custom (1–240 minutes), remembered per model in the browser/desktop app. Apply the chosen duration to preload and every assistant message; API clients omitting it keep the server fallback.
- Add Unload model now, without deleting installed models or conversations. Pause automatic preload after manual unloading until explicit preparation, message submission or reopening the app.
- Disable unloading during preparation/response in the window; reject pending assistant requests and active gateway model use on the server. Other Ollama clients may reload a shared model.

Verification: 37 Java/PostgreSQL tests passed, including duration overrides and rejection of unloading during active generation. Real checks confirmed 15-minute retention, removal from memory without deleting the installed model, and per-model preference persistence. See [validation evidence](docs/VALIDATION.md#per-model-retention-and-manual-unloading--16-october-2026).

## 16 October 2026 — Ollama preparation and response timing

- Preload the selected installed Ollama model without project content, with a remembered opt-out and Prepare model now action. Coalesce simultaneous preparation for the same model and duration.
- Ask Ollama to retain the model for a configurable period after preparation and responses: `OLLAMA_KEEP_ALIVE_MINUTES`, default 30, range 1–240.
- Use native Ollama chat with equivalent source catalogue, image input, JSON output and token limits. Check advertised thinking support before applying a reasoning level.
- Persist response timing and expose loading, context processing, generation, token counts and throughput where reported. Missing values remain unknown; cloud transports are unchanged.
- Explain memory use and distinguish preparation from the combined context/generation waiting state. Preloading does not guarantee faster generation.

Verification: 35 Java/PostgreSQL tests passed. Real `qwen3.8:27b` checks confirmed preparation, retained memory, native response metrics and their persistence in the UI. A full-catalogue synthetic turn took 202.2 seconds, with 184.0 seconds spent processing the prompt; a different follow-up took 42.3 seconds. These are diagnostic observations, not a controlled speedup benchmark. See [validation](docs/VALIDATION.md#ollama-preparation-and-response-timing--16-october-2026).

## 16 October 2026 — Independent catalogue explorer

- Add Explore catalogue to the desktop/browser sidebar, top bar and welcome screen; preserve the conversation and unsent prompt when closing it.
- Add a standalone `/?catalogue=1` entry using only read-only catalogue APIs, independent of model configuration and project creation.
- Search and filter clusters/actions by category, SDLC phase and ethics label; inspect original evidence, roles, scope, reference records and import notes.
- Select immutable imported versions and copy version/cluster links. Source reference links open on explicit clicks; desktop URLs are restricted to HTTP/HTTPS.

Verification: production build and TypeScript checks passed with 15 Java unit tests; all nine native tests passed. Browser checks cover filters, linked references, version switching, responsive layout and preservation of the unsent message. See [validation evidence](docs/VALIDATION.md#independent-catalogue-explorer--16-october-2026).

## 16 October 2026 — Project management and local-model reliability

### User-facing changes

- Add a project menu with icons for Rename project, Open folder and Delete project.
- Add confirmation before moving projects to Trash and a Restore action. Saved material and operation history are retained; local files are untouched. Permanent purge is not implemented.
- Explain browser/desktop capabilities immediately on entry and provide a copyable desktop launch command.
- Keep contextual help for functions needing guidance and remove redundant information icons from familiar controls.
- Explain that local model loading and catalogue processing can take several minutes.
- Allow Retry with saved context when the first model response fails.

### Model context and operations

- Keep every source action's text, evidence, phases and roles in the conversational context; omit repeated import metadata and full bibliographic records. All 184 reference IDs remain available to the model; full records remain in the catalogue APIs.
- Place the invariant catalogue before changing conversation data to permit prompt-cache reuse where supported.
- Separate configurable Ollama timeout/output/reasoning settings from cloud defaults. Ollama defaults: 600 seconds, 8,192 output tokens, low reasoning effort where supported.
- Distinguish timeout and unreadable-JSON errors from connection errors.
- Add Flyway V5 for reversible project deletion. Native folder opening resolves an already-linked directory; renderer-supplied paths are not accepted. Unlink invalidates pending operation approvals.

### Verification

- 33 Java/PostgreSQL tests and 8 native-agent tests passed locally. Automated model tests use local HTTP stubs.
- One real local `qwen3.8:27b` check on Apple M4 Pro / 48 GiB completed in 233.6 seconds with 19,720 prompt tokens and five validated catalogue citations, using a fictional support-portal prompt. This establishes compatibility for that example, not general reasoning quality or guaranteed latency. Cache speedup has not been benchmarked.
- Catalogue unchanged: 24 clusters, 144 actions, 184 references; importer v2, 179 source-review warnings and no blocking import errors.

For usage and reproducibility, see [README](README.md), [conversational workspace](docs/CONVERSATIONAL_WORKSPACE.md), [validation](docs/VALIDATION.md) and [replication package preparation](docs/REPLICATION_PACKAGE.md).
