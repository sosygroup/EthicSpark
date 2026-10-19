# Catalogue data foundation architecture

The current implementation is one Spring Boot application with a PostgreSQL database. The Maven reactor separates the core catalogue/import rules, service infrastructure and web resources. The service packages web resources into the executable jar.

On startup, Flyway creates the schema, the importer reads the source XLSX bundled in the image, deterministic checks produce a report, and a transaction stores the complete immutable snapshot with the original workbook. Reference, cluster and action key tables enforce source membership and version-scoped relationships. The report is written before persistence, so rejected imports are inspectable. The application becomes ready only after startup import succeeds.

Version IDs combine the complete workbook SHA-256 and importer version. A unique constraint makes repeat imports idempotent. A new importer contract must increment `Catalogue.IMPORTER_VERSION`; this permits re-importing identical source bytes under changed rules without replacing previous interpretations. Changing application code alone does not rewrite a stored snapshot.

The JSONB document is the canonical imported representation, with cell-level provenance and all source associations. Relational tables index identities and relationships; they are written in the same transaction. There is no automatic publication: versions remain IMPORTED while warnings await human disposition. Database triggers reject update/delete operations on snapshots and key tables. Database administrators retain normal administrative powers.

Read APIs require an explicit version ID. Cluster summaries support search; cluster/action details expose relationships, while references and source-cell APIs allow provenance inspection. Version metadata and import reports are accessible separately. The service does not fetch external reference URLs.

The development Compose stack exposes only the application on host loopback. PostgreSQL has persistent storage and no default host port. An optional override exposes database port 5433 for host-JDK development. The isolated test stack has a different project name and ephemeral database storage.

The web module now contains a React/TypeScript/Material UI application bundled by Vite during Maven generate-resources. Maven installs its own pinned Node runtime, performs npm ci using the tracked lockfile, checks TypeScript and packages the resulting assets in the executable service jar. The browser uses same-origin APIs and resolves catalogue version IDs automatically.

Migration V2 adds a mutable project draft with optimistic revision control, immutable confirmed profile versions, immutable review events and immutable approved plans. Write operations lock the project row, compare the submitted revision and update within one transaction. Approval keys prevent duplicate snapshots when the same approval request is retried. Plans bind to their exact catalogue, profile, recommendation content and gaps. Exports serialise that snapshot and escape user text in HTML.

Profile changes conservatively reopen all recommendation reviews because the manual increment does not claim field-level dependency precision. They never update approved versions. Manual recommendation edits cannot change the source ID or implementation state. Review categories remain independent of implementation validation.

The workspace supports manual and LLM-assisted selection/adaptation across all 24 clusters. Migration V3 adds immutable project-owned attachments and reasoning runs. Files are read locally for text extraction; supported images are included only in explicitly requested model analysis. OpenAI, Anthropic Claude and Ollama share deterministic output validation. Network requests run outside project write transactions; applying a proposal checks its saved revision under a row lock. Reviewed mappings and provenance survive plan approval. See [assisted workflow](ASSISTED_WORKFLOW.md). Reviewer names remain self-reported local labels. Authentication, project memberships, shared deployment and human implementation-evidence validation remain subsequent increments.


## Conversational desktop increment

The primary React entry point is a project/conversation workspace. The previous four-screen interface is retained behind the `legacy` query parameter. Flyway V4 adds assistant projects, threads, request-keyed messages and immutable operation receipts. Assistant project IDs reuse the existing project identity for attachment ownership. Conversation generation does not require profile confirmation or selected clusters.

`AssistantService` binds each new project to a catalogue version, supplies a compact catalogue projection (all source action texts/evidence/phases/roles and reference IDs/count) plus conversation/material context, and validates model output. HTTP calls occur outside short thread-lock transactions; idempotency keys and pending states prevent duplicate generation and concurrent writes. Cancellation wins over late provider responses. The Java server proposes operations but cannot access host paths or run processes.

The Electron main process owns native folder selection, file indexing/watching, bounded UTF-8 reads, change previews, one-use native approval tickets and process execution. Files stay in the linked host folder. Read contexts are refreshed per turn. Every write and command receives a native confirmation; no generic Node or IPC access is exposed to the renderer. Commands use explicit argv and a filtered environment, with output/exit-code capture and cancellation. They run with user permissions and are not OS-sandboxed.

A strict JSON response envelope separates Markdown answers, validated catalogue citations, read requests, proposed operations and downloadable text artefacts. Mermaid uses strict security and displays SVG through an image element. The backend sets CSP/nosniff/frame protections. Browser-only use cannot invoke the native bridge. See [conversational workspace](CONVERSATIONAL_WORKSPACE.md) for supported formats, context limits and remaining validation boundaries.

Project lifecycle uses migration V5 (`assistant_project.deleted_at`). Trashed projects are excluded from active project/conversation queries and the preserved structured-workflow list. Restore retains immutable receipts and original message IDs. Rename updates both project representations atomically, incrementing the structured-workflow revision. Native `workspace:open` accepts only a project identifier and resolves its already-linked folder before invoking the system file manager; renderer-supplied paths are not accepted. Unlink invalidates pending approval tickets.

Prompt version `workspace-assistant-2` introduced compact context that removes repeated import metadata and full bibliography from per-turn conversational context. Source catalogue snapshots are unchanged. Local Ollama has separate configurable timeout/output/reasoning settings; cloud provider settings retain their existing defaults.

Conversational model input begins with the invariant catalogue projection before project and conversation data, so local prompt caching can reuse the large shared prefix. This ordering does not guarantee a cache hit or latency across model-server implementations.

Prompt version `workspace-assistant-3` retains the compact catalogue and specifies self-contained visual artifacts and valid Mermaid headers. Visual previews are a frontend concern: SVG remains in image context, remote images are not fetched automatically and no new native execution permission is introduced. Flyway V6 stores only the identity of the explicitly loaded, offline demo; the authored conversation is bundled in resources and is never seeded on startup.
