# Development changelog

## 22 October 2026 — OpenAI-compatible API connections

- Add a separate provider with editable API base URL and optional arbitrary-format key, supporting official OpenAI and third-party Chat Completions services.
- Keep official OpenAI request behavior and environment configuration intact; expose all compatible model IDs and allow manual entry.
- Offer token-parameter/output-limit controls and optional JSON mode for differing compatible APIs.
- Persist keys only in private backend configuration; never return them to clients or include them in workspace exports. Endpoint changes clear omitted old keys, and saved changes require fresh project-processing permission.
- Verification: 48 Java/PostgreSQL and 13 frontend tests passed using local HTTP stubs; live UI checks verified the new form without entering credentials or calling a remote provider.

## 22 October 2026 — Restore the original demo on reset

- Complete workspace reset recreates the original six-stage, 12-message offline demo in the same transaction, removing user additions to its previous copy.
- First launch on a new empty database initializes the same demo once. Existing projects are preserved on upgrade, and normal restarts do not restore a demo deliberately removed by the user.
- Fresh clients automatically open the walkthrough when it is the only project/conversation.
- Verification: 45 Java/PostgreSQL and 12 frontend tests passed. Live startup from the already empty local workspace restored one demo, one conversation and 12 messages, with no Trash entries.

## 22 October 2026 — Settings and workspace reset

- Add Model settings → Reset… with separate client-preference and permanent shared-workspace actions.
- Offer archival JSON export, data counts, exact RESET confirmation and refusal when the reviewed data changes. Include Trash and previous structured-workflow records; keep catalogue and host files intact.
- Block reset during requests and native approvals/commands; add expiring operation leases and safe folder-link cleanup. Updated native bridge requires reopening the desktop app.
- Configured server credentials and Ollama installations are kept. The later correction above restores the original demo on reset.
- Verification: 44 Java/PostgreSQL, 12 frontend and 13 native tests passed. Browser checks confirmed the confirmation guard and actual client-only reset, with real backend data counts unchanged.

## 22 October 2026 — Compatible Ollama reasoning and provider diagnostics

- Add per-model Reasoning level in Model settings: Automatic (compatible), Model default and only model-advertised controls. Manual choices override the server preference; unsupported choices use model default without switching models.
- Handle named levels, boolean-only metadata and models without thinking controls. Hardware benchmarking is not implied; Docker resources do not necessarily represent the Ollama host.
- Explain provider HTTP 401 authentication, 403 access and 429 limits separately, including historical messages in Notifications, without exposing provider response bodies or credentials.
- Verification: 41 Java/PostgreSQL tests and 10 frontend helper tests passed, with TypeScript checking and the production frontend build. Tests use local HTTP stubs.

## 19 October 2026 — Discreet notification center

- Add an upper-right bell and severity-colored unread dot. Runtime feedback is opened on demand in a side panel, with plain-language cause explanations, suggested actions and expandable technical details.
- Route workspace errors, failed responses/preparation, diagram/image previews, catalogue loading and app-update feedback to the shared center. Preserve source downloads, retry controls and explicit operation-permission explanations.
- Group repeat occurrences, rearm unread status after acknowledgement and limit the per-window, non-persistent list to 50 items. Include keyboard access with Alt+N.
- Verification: seven frontend tests, TypeScript/Vite and 19 Java unit tests passed. Isolated browser checks covered missing modules, repeat warnings, syntax-invalid Mermaid without error drawings, validation failures and a synthetic connection error with a red indicator.

## 19 October 2026 — Fresh desktop startup and connection diagnostics

- Refresh only the Electron HTTP cache before first navigation and request entry-document revalidation. Preserve browser preferences, linked folders and saved work.
- Resolve the default desktop address from the actual Compose port; log the launcher checkout, selected view and loaded entry asset. Explicit ETHICSPARK_URL remains supported.
- On a second launch, ask the running renderer to check for application updates. A secondary instance now exits without creating another native window.
- Add two native startup regression tests; the complete 11-test native suite passed.

## 19 October 2026 — Application update notice and visible demo recovery

- Detect changed entry modules on startup/focus/visibility and catch missing lazy modules. Offer an explicit Reload app action; do not mislabel module fetch failures as Mermaid syntax errors.
- Preserve unsent prompt text on explicit reload, block interruption of active responses/commands and contain lazy catalogue failures inside their dialog.
- Prevent entry-document caching and place Load demo project at the top of Create a project, opened by the + beside Projects.
- Verification: 38 Java tests and four frontend tests passed. An isolated browser fixture confirmed missing-module feedback, real entry-module change detection and draft preservation after Reload app. Live checks confirmed demo restoration from Trash.

## 19 October 2026 — Reloadable lifecycle demo and visual chat artifacts

- Add an explicit offline demo loader in Create a project, backed by a transactional, idempotent endpoint and Flyway V6. The authored six-stage conversation is bundled in the repository; no projects are seeded automatically. Restore the same demo after deletion without overwriting saved work.
- Preview and enlarge Mermaid, SVG and self-contained PNG/JPEG/GIF/WebP artifacts in chat while keeping downloads. Decode raster downloads as actual image bytes. SVG code fences also have a preview.
- Validate Mermaid before rendering, repair missing header spaces conservatively, serialize parser/render work and remove temporary DOM even on failure. Preserve original source and expose SVG/source downloads.
- Add frontend regression tests and a PostgreSQL integration test for offline creation, repeated loading, Trash restoration and preserved follow-up conversations.

Verification: 38 Java tests, three frontend regression tests and the production build passed. Live browser checks covered phase navigation, Trash restoration, visual enlargement, actual PNG download and malformed Mermaid without residual error drawings. See [validation](docs/VALIDATION.md#reloadable-lifecycle-demo-and-visual-artifacts--19-october-2026).

## 17 October 2026 — Single catalogue, complete model list and clean example

- Remove catalogue version selection and version parameters from new explorer links; retain internal import provenance and historical read APIs.
- Replace the browser-filtered model datalist with a full dropdown opened by Load available models. Preserve manual entry as an optional alternative and cancel stale model-list requests.
- Add a fictional example prompt in the welcome screen and repository. Fresh installations contain no author workspace history; existing local data remains in its Docker volume.

Verification: production build and 19 Java unit tests passed. Live checks confirmed both installed Ollama models in the same menu, no catalogue version selector, version-free copied links, and a sample prompt that sends nothing automatically. See [validation](docs/VALIDATION.md#single-catalogue-complete-model-list-and-clean-example--17-october-2026).

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
