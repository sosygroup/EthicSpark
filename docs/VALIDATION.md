# Data foundation validation

Validation date: 14 October 2026.

The full authoritative workbook imported successfully with **24 clusters, 144 source actions and 184 references**. There were **zero blocking errors**. The complete machine-readable report is saved in [catalogue import report](validation/catalogue-import-report.json).

Source SHA-256: `ab5ea1ed529383de14e5456a7a42304274b0cb4b6718bbb0a3c3c1914ec30422`.

Importer version: `1`. Import state: `IMPORTED`. Warnings have been detected and retained, not automatically approved for publication.

## Source review findings

| Warning | Occurrences | Treatment |
| --- | --- | --- |
| Incomplete reference metadata | 96 | Missing author, year, authority or link fields remain missing |
| Possibly truncated reference title or link | 58 | Ellipsis-containing source text retained for review |
| Ambiguous comma within role list | 25 | Retained inside semicolon-delimited role items |
| Phase outside the initial recognised vocabulary | 24 | Original term retained; no unapproved semantic mapping |
| Missing cluster boundary notes | 1 | C03!F5 remains empty |
| **Total** | **204** | All warnings include source locations |

The report also records 23 informational normalisations: 17 phase delimiter decisions and six approved phase alias corrections. No source action-category alias was needed in the supplied rows: all 24 fifth actions already say Validate. Verify remains in the source's navigation text and some action prose; the importer does not replace arbitrary source sentences.

These counts are occurrences, not counts of distinct records or source defects. An ellipsis flag does not establish that a citation is invalid. Bibliographic correctness and substantive source support remain human review tasks.

## Automated and live checks

The Docker build runs Java 25 and Maven 3.9.11. The isolated integration stack uses PostgreSQL 17.6 with Flyway migration V1.

- Twelve importer tests passed, covering the complete workbook, C-01 source IDs and mappings, exact source text, approved aliases, missing/duplicate IDs, unknown references and categories, missing required data, changed headers, formulas, all-phase scope and ambiguous role/phase handling.
- One integration test passed against real PostgreSQL, exercising persistence and JSON round trips, original workbook retention, version-scoped APIs, expected error responses, idempotent imports, immutable records and foreign-key rejection. It also imports a second source revision with a repeated reference link, checks that provenance retains the repetition and confirms that the first snapshot remains unchanged.
- The normal Docker Compose stack started successfully and reached readiness.
- After restarting the application, the original single version remained present with counts 24/144/184.
- Live HTTP queries returned C-01 with six actions and eight label mappings, and the Validate category filter returned 24 actions.

Run `./scripts/test.sh` to repeat the isolated automated checks. The test database is separate from the normal application database. Intentional negative SQL checks produce database error log messages while their assertions pass.

## Manual workflow increment

The second increment adds React, TypeScript, Material UI and a Maven-integrated Vite build. Flyway V2 preserves projects, confirmed profiles, review events and approved plans in PostgreSQL. The automated suite now includes twelve importer tests and four integration tests, covering the catalogue foundation and three manual-workflow cases.

The workflow checks cover confirmation requirements, explicit unknown fields, stale revisions, C-01 scope, rejection reasons, save-versus-accept behaviour, immutable approval, retry idempotency, profile-change reassessment, matching JSON/HTML exports, HTML escaping and project-scoped plan lookup. The approval preview is checked against the actual approved content and gaps.

Browser QA exercises the support-ticket example through profile confirmation, C-01 selection, saving and accepting an edited Know action, deferring Protect and approving a plan with the remaining work disclosed. The approved view contains only the accepted action; pending actions remain in draft/history. Native downloads of both JSON and HTML were completed in the in-app browser and inspected: both contain approved version 1 with one included action, five exclusions and nine disclosed gaps. Desktop (1280 px) and narrow (500 px) layouts are inspected; the narrow document has no page-level horizontal overflow. The demonstration project is explicitly labelled Demo.

![Approved manual plan](screenshots/manual-plan-desktop.jpg)

## Public dataset distribution

On 15 October 2026, a separate public workbook was prepared with participant observations omitted. See [data provenance](DATA_PROVENANCE.md). The historical source hash above identifies the original input used for the earlier checks. The bundled import report identifies the public input. The full 16-test Docker/PostgreSQL suite passed again with the public workbook, including assertions that expert-observation fields are empty.

## Scope

This validation covers the catalogue foundation and the local manual C-01 workflow, including the four screens. It does not establish empirical usability, model quality, regulatory compliance or ethical adequacy. The checks above describe the earlier manual baseline. The assisted increment is recorded below; shared-deployment access controls and implementation-evidence validation remain later increments. Reviewer names are self-reported, not authenticated identities.


## Profile material and assisted workflow increment

Implemented on 15 October 2026: optional attachments for every Known field; Company Ethics documents alongside known safeguards; optional Additional Material; explicit sharing None; multi-phase profile selection; all-cluster manual adaptation; OpenAI, Anthropic Claude and Ollama adapters; reviewed cluster/label proposals; six adapted actions per cluster with phase suitability; immutable reasoning/attachment provenance in PostgreSQL and plan exports. See [assisted workflow](ASSISTED_WORKFLOW.md).

The suite contains 12 importer tests, four original integration cases and five assisted integration cases. The added tests exercise real PostgreSQL and a local HTTP provider stub: all three wire formats, text/file-only profiles, additive company ethics, None, multipart uploads, cross-project attachment/run lookup, PDF/DOCX extraction, image payloads, unsupported/truncated material, immutable attachment records, all-six-action coverage, source label validation, phase validation, explicit human acceptance, multi-cluster plan export, missing authorisation, stale runs and provider errors without selection changes. No real cloud credentials or paid model calls are used in automated tests.

Live-provider output quality, prompt-injection robustness and expert usability remain unvalidated. Schema checks establish source membership and structural consistency, not ethical correctness or regulatory compliance. Existing catalogue-validation results must not be presented as tool validation.

The final local Docker/PostgreSQL run passed **21 tests** (12 importer and nine integration), with zero failures or errors. The production stack applied Flyway V3 and reached readiness while retaining existing projects and approved plans. Browser QA used a separate fictional Demo project: a company policy text file uploaded successfully; known safeguards text survived Company Ethics selection; None displayed the exact no-third-party-sharing statement; profile confirmation persisted the attachment; manual C-01/C-02 selection opened twelve correctly identified source actions. Provider selection showed all three adapters. Desktop (1280 px) and the default narrow viewport were inspected; the desktop document had no horizontal overflow. No real provider inference was attempted because cloud keys are not configured and Ollama is not running.

![Assisted selection and provider configuration](screenshots/assisted-selection-desktop.png)


## Conversational desktop and refreshed catalogue

On 15 October 2026 the primary UI was replaced with a conversation-first workspace. No application-profile questionnaire, prior SDLC selection or cluster-selection gate is required. The earlier interface and immutable approved plans remain accessible separately.

The owner supplied an updated consolidated workbook. Its public derivative is `e51a3127bf1e667f5a9257b91cd5130adeaa0b2ea9915f677b685b22988a396f`; importer version 2 parses its comma lists and retains canonical phase/category terms. The fresh import has 24 clusters, 144 actions, 184 references, zero blocking errors and 179 warnings. Earlier sections describe historical input versions and checks.

The Java/PostgreSQL suite has 28 cases: 13 importer tests and 15 integration cases. Six new conversational cases cover prompt-only creation without profile confirmation, rich responses/documents, source citations, requested file context, pending operations without execution, immutable receipts, duplicate-request prevention, stale/different request keys, cancellation against a late provider, and rejected unsafe paths or invented citations. Seven native-agent tests use disposable folders and actual processes to verify current-file reads, excluded paths/symlinks, deny-before-write behaviour, single-use tickets, file hash/mode checks, new files, folder relinking, exact argv, nonzero exit codes and timeouts.

Browser QA used a clearly labelled local UI fixture (not a model-generated answer) to inspect Markdown, a rendered Mermaid graph, catalogue source inspection, a downloadable document and a proposed file change that remained unexecuted. The main entry screen was inspected without fields or prerequisite choices. A desktop-width document had no page-level horizontal overflow. The native Electron app was launched against the local Docker backend. Native-agent tests simulate permission choices; the actual OS confirmation dialog and a real cloud model inference were not automated.

![Conversation-first entry screen](screenshots/conversational-workspace-desktop.png)

![Explicitly labelled UI fixture showing response formats and a pending operation](screenshots/conversational-workspace-response.png)

This checks implementation behaviour, not expert usability, live-provider quality, complete prompt-injection robustness or equivalence to Codex's security model. Approved native commands run with user permissions; the MVP does not provide an OS command sandbox.

The final verification passed **28 Java/PostgreSQL tests and seven native-agent tests (35 total)**. Added Office attachment checks cover XLS/XLSX formula text without evaluation and PPTX slide text. Native checks also cover UTF-8 BOM round trips and force termination when a child ignores a graceful stop. Browser inspection at 1440 px and 500 px showed no page-level horizontal overflow; the generated Mermaid fixture rendered without browser errors, the artefact appeared in the context panel and C-01 opened the current source definition.
