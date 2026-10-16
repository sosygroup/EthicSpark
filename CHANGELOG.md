# Development changelog

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
