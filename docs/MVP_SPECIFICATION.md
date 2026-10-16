# Ethics catalogue tool MVP specification

**Product direction update, 15 October 2026:** the owner replaced the required form/cluster-first journey with a general conversational development assistant. Prompts and optional live folders/documents are the entry point. Ethics guidance is introduced when pertinent. Host file edits and commands require per-operation developer approval. [Conversational workspace](CONVERSATIONAL_WORKSPACE.md) describes the shipped scope and supersedes earlier primary-UI requirements below. The original structured workflow remains available for historical data.

Version 0.3 — 15 October 2026

**Implemented update, 16 October 2026:** project renaming, native Open folder, reversible deletion/restore, browser-mode startup guidance and simplified contextual help. Ollama now has compact catalogue context, configurable generation limits and retry after a first-response failure. See [changelog](../CHANGELOG.md) and [validation](VALIDATION.md); the real local smoke check is not an expert usability evaluation.

Implementation update: profile attachments, Company Ethics, Additional Material, sharing None, all-cluster adaptation and three LLM providers are now implemented. See [assisted workflow](ASSISTED_WORKFLOW.md) for the actual shipped limits and review flow. Requirements below that concern authenticated shared deployment, implementation-evidence validation, generation idempotency, partial recovery and automatic retries remain release targets, not claims about this local increment.

This specification defines the first implementation of the developer-facing ethics catalogue tool. The product helps software teams turn the catalogue into a reviewed, application-specific action plan and provides an executable research artefact for evaluation with the catalogue experts.

The first implementation increment covers one complete path using C-01 Privacy & Data Protection. The expert evaluation release extends that path to all 24 clusters and adds assisted adaptation, versioned approval and change review. All product text, documentation, generated recommendations, exports, error messages and demonstration cases must be in English.

## Authoritative sources and confirmed decisions

Original research sources remain local in `MY-INPUT`. The distributed software uses `data/catalogue-public.xlsx`; see [data provenance](DATA_PROVENANCE.md). Original design inputs:

| Source | Use |
| --- | --- |
| `SEIP_ICSE_2027.pdf` | Research rationale, catalogue structure and expert feedback |
| `Consolidated-clusters-after-validation.xlsx` | Authoritative source content for catalogue import |
| `Ethics_Catalogue_Tool_Developer_Handoff.docx` | Proposed workflow, provenance, review and approval requirements |

The following decisions were confirmed by the project owner on 14 October 2026 and supersede conflicting terminology in the draft paper or handoff:

| Item | Canonical value |
| --- | --- |
| Action categories | Know, Protect, Inform, Assess, **Validate**, Respond |
| Reference registry | **184 references**, R-001 through R-184 |
| Requirements phase spelling | **Requirements** |
| Operations phase spelling | **Operations** |
| Product language | **English** |

Keep the supplied source files unchanged. Apply canonical terminology in imported data, application code and new documentation, retaining the original text and source location. Updating the paper and handoff themselves is a separate editorial task.

## Product outcome and boundaries

A developer must be able to describe an application, inspect relevant catalogue content, select concerns, adapt actions, assign responsibility, review proposals and export an approved plan. A later change to the application must create a reviewable draft while preserving previous approvals.

The tool supports planning and ethical analysis. An approved plan does not demonstrate implementation, regulatory compliance or the ethicality of the application. Do not display an aggregate ethics score. Completion indicators may describe review progress and unresolved work only.

The first expert evaluation release includes:

- All 24 clusters, their label-card mappings and 144 source actions.
- Versioned application profiles with explicit unknown values.
- Manual cluster selection and assisted suggestions with explanations.
- Manual and model-assisted adaptation, including expected evidence and validation criteria.
- Review history, responsibility assignment and immutable plan approvals.
- Change comparison and reassessment of affected recommendations.
- English human-readable HTML reports and machine-readable JSON exports.
- Two provider adapters using one structured output contract, introduced sequentially.
- Authentication and project-scoped access controls for a shared deployment.

Document ingestion, issue-tracker integration, automated evidence collection, semantic search, automatic execution of safeguards and enterprise SSO are deferred. Manual evidence links and descriptions are supported; the MVP does not fetch or execute linked content.

## Four core screens

### 1 Application profile

Purpose: capture and confirm the context that makes a recommendation relevant.

The initial form contains Purpose and features, Stakeholders, Data, Decision-making behaviour and Current SDLC phase. Follow-up fields cover domain, deployment, external services, safeguards, available roles and constraints. Every field has a stable ID, a value status and provenance. Required fields may explicitly be marked Unknown; an unanswered field cannot silently become Unknown or Not applicable.

Primary controls: Save draft, Confirm profile and Review changes. Present clarification questions in batches of at most five and explain why each matters. Users may proceed with recorded unknowns; recommendations that depend on them must identify the gap.

Confirmation produces a profile version used by generation. Editing that version produces a new draft rather than changing the input of an existing run.

### 2 Cluster selection

Purpose: let the developer inspect the catalogue and decide which clusters apply.

Show all 24 clusters with ID, title, short definition, relevance suggestion and selection state. Filters search titles, definitions and constituent concerns. A details panel exposes scope, boundaries, source concerns, ethics-label cards, characteristics and source references.

Suggested selections display a concise rationale and supporting profile field IDs. The user may select any cluster, deselect suggestions and record a reason. Distinguish Not selected from Assessed as not applicable. Preserve overrides when suggestions are regenerated.

Primary controls: Suggest relevant clusters, Save selection and Continue to adaptation. Support manual selection when model access is unavailable.

### 3 Adaptation workspace

Purpose: turn generic actions into reviewable project work.

Display the original catalogue entry beside its editable adaptation. Navigate by cluster and by Know, Protect, Inform, Assess, Validate and Respond. All six categories remain independently accessible; they are not mandatory sequential steps.

Each recommendation shows the concern scenario, adapted action, expected evidence, validation criterion, suggested phases and catalogue roles, assigned owner, rationale, assumptions and unresolved questions. Expose source entry IDs, reference metadata and supporting profile fields through a Source details panel.

Primary controls: Generate draft, Save edit, Accept, Reject and Await information. Rejection requires a reason. Editing alone does not accept an entry: Save edit preserves a proposed draft; Accept edited version records the reviewed decision. No bulk operation may hide pending assumptions or changed content.

Model work runs asynchronously with visible progress. Show saved partial results and per-cluster failures. Display the provider and model used for each run; never silently substitute a different provider.

### 4 Project plan

Purpose: inspect approved work and maintain it over time.

Provide a compact table with filters for cluster, action category, phase, owner, review state and implementation state. Show unresolved gaps and unassigned owners above the table. Source details and review history remain available for each entry.

Primary controls: Approve plan version, Export draft, Export approved plan and Compare versions. Approval includes accepted and accepted-edited entries only; rejected and awaiting-information entries remain in history. The approval summary must disclose omitted or deferred work and unresolved gaps. Approval with gaps is allowed and explicitly labelled.

A comparison shows previous and proposed content, changed profile fields and the reason an entry needs renewed review. An optional relation view can follow after the core table and review interactions work.

## Interaction and accessibility requirements

- Use Material UI with a restrained theme, clear typography and one consistent primary accent.
- Optimise the review workspace for desktop, with a usable stacked layout on smaller screens.
- Provide keyboard operation, visible focus, labelled controls and readable contrast.
- Communicate state through text as well as colour; include useful empty, loading and error states.
- Preserve saved work through model failures. Warn about unsaved edits before navigation.
- Use progressive disclosure for references and technical provenance while keeping their availability obvious.
- Use English labels consistently, including Unknown, Not applicable, Unassigned and Awaiting information.

## Persistent data model

Use immutable version records for published catalogue content, confirmed profiles and approved plans. Use optimistic concurrency for mutable drafts and reviews.

| Entity | Essential contents and relationships |
| --- | --- |
| Project | ID, name, description, memberships and timestamps |
| ProjectMembership | Project ID, user ID and permission role |
| CatalogueVersion | ID, version, source file digest, import report, publication state and timestamp |
| Cluster | Version ID, source cluster ID, title, definition, constituent concerns, boundary notes and source locator |
| LabelMapping | Version ID, cluster ID, label card, characteristic and source locator |
| CatalogueAction | Version ID, source action ID, cluster ID, canonical category, original action, covered concerns, evidence suggestions, phases, roles and reference links |
| Reference | Version ID, reference ID, supplied bibliographic metadata and source locator |
| ApplicationProfileVersion | ID, project ID, version, fields, creation and confirmation actors and timestamps |
| ProfileField | Field ID, value, value status, source type, source locator and separate inference confirmation |
| ClusterSelectionVersion | ID, project and profile version IDs, cluster decisions, suggestions, rationales and user overrides |
| GenerationRun | ID, input versions, selection version, provider, exact model ID, prompt and schema versions, parameters, input digest, timestamps, usage and validation outcomes |
| Recommendation | ID, project and run IDs where applicable, origin, source links, profile dependencies, scenario, adapted action, evidence plan, validation criterion, phases, roles, owner, gaps and lifecycle states |
| ReviewEvent | Actor, timestamp, recommendation revision, decision, reason and before/after content |
| PlanVersion | ID, project ID, version, immutable recommendation snapshots, source/input/run provenance, unresolved gaps and approval actor/time |
| EvidenceRecord | Recommendation ID, description, supplied location, relevant artefact/system version, submitted actor/time and human validation decision |

Membership permissions are Developer, Reviewer and Project owner; one person may hold multiple roles. Catalogue maintainer is a separate permission. Software-development roles from the catalogue are content and must not grant application permissions.

Origin values are `catalogue_adaptation` and `additional_suggestion`. Manual recommendations record their human author; generation provenance is required for model proposals only. Additional suggestions require explicit acceptance and cannot masquerade as source catalogue actions.

### State definitions

| Field | Values |
| --- | --- |
| Action category | `KNOW`, `PROTECT`, `INFORM`, `ASSESS`, `VALIDATE`, `RESPOND` |
| Profile value status | `known`, `unknown`, `not_applicable` |
| Profile source type | `user`, `confirmed_document`, `model_inference` |
| Recommendation review status | `proposed`, `accepted`, `edited`, `rejected`, `awaiting_information` |
| Implementation status | `not_started`, `in_progress`, `evidence_submitted`, `validated` |
| Run status | `queued`, `running`, `completed`, `partial_failure`, `failed` |

The `edited` review status means an edited version has been explicitly accepted. Implementation state `validated` requires evidence and a recorded human reviewer decision. The Validate action category describes catalogue guidance; it is independent of implementation state. The implementation term `validated` replaces the handoff's `verified` to keep new product terminology consistent.

## Catalogue import and normalisation contract

1. Treat the workbook as input to a controlled import, not as the runtime database. Store its digest and retain the original file separately.
2. Expect C-01 through C-24 and 144 unique source action IDs, six per cluster. Preserve IDs such as `C01-A1` exactly. Do not derive source IDs from display titles.
3. Expect exactly R-001 through R-184. Require unique IDs and reject unresolved references. Report incomplete bibliographic fields without inventing replacements.
4. Preserve cluster-to-label and label-to-characteristic relationships, source actions and their covered concerns, evidence, phase, role and reference associations.
5. Canonicalise action-category aliases `Verify` and `Validate` to `VALIDATE`. This rule applies to the category field, not to arbitrary prose or bibliographic titles. Display Validate.
6. Canonicalise phase aliases `Requirement` and `Requirements` to Requirements; `Operation` and `Operations` to Operations, ignoring surrounding whitespace and case.
7. Trim incidental whitespace for matching while retaining raw cell values and locators. Parse comma/semicolon lists using field-specific rules; report ambiguous delimiters rather than splitting every text field indiscriminately. Slashes and ampersands may be part of a role or characteristic name.
8. Treat All SDLC phases as an explicit applicability scope, not as a new phase. Preserve other phase terms; mappings such as Design versus Architecture or Evolution versus Maintenance require documented decisions before merging them.
9. Preserve suggested catalogue roles and artefact descriptions. Project-specific phases, team roles and owners belong in adaptations and must remain traceable to the source suggestions.
10. Produce an import report with accepted aliases, counts, source locations, warnings and blocking errors. Publication requires zero blocking errors and an acknowledged disposition for each warning. Never silently repair source meaning.

Published versions are immutable. Corrections create a new catalogue version and do not rewrite existing approved plans. Reference membership establishes a valid identifier, not semantic support for a generated claim. Do not describe metadata-only retrieval as access to the full referenced publication.

## Assisted adaptation contract

The backend controls retrieval, validation and persistence. Supply compact summaries of all clusters for selection, followed by complete selected catalogue entries for adaptation. Structured ID retrieval is sufficient for this catalogue size.

Provider adapters receive the same confirmed profile, selected source entries, permitted reference metadata, prompt version and output schema. Every proposal must include source and input dependencies, a concise rationale, expected evidence and a validation criterion or explicit unresolved criterion.

Do not infer a known fact from an Unknown field, invent named owners, assert unsupported legal obligations or approve recommendations. Assign missing owners as Unassigned. Additional suggestions must be separately labelled. Reference IDs must belong to the supplied catalogue version; source action IDs must belong to the selected source bundle.

Reject malformed output, unknown IDs and unsupported enums through deterministic validation. Use a configurable timeout and at most two corrective retries. Keep validated partial results. Limit each run by configured call and usage budgets.

Keep credentials on the backend, enforce project isolation and exclude secrets and sensitive profile content from operational logs. Record the actual provider/model and never silently fall back. A generation or approval request uses an idempotency key; an existing key with different input is rejected.

## Versioning and change review

Generation binds to explicit profile, catalogue and selection versions. An in-flight result remains tied to those inputs even if a new draft is saved, and the UI marks an older-input result clearly.

A profile or catalogue change flags recommendations through recorded dependencies. When dependencies are uncertain, request broader review. A model or prompt change creates a new run; previous accepted work is not overwritten. Changed recommendations return to proposed status and require renewed acceptance. Implementation validation and evidence are not automatically carried across materially changed actions.

Approval creates an immutable snapshot in one transaction. Concurrent changes detected since the approval preview require a refreshed preview. Export serialises the selected snapshot, rather than the latest mutable recommendation records.

## Technical baseline

Use Java 25 LTS, Maven Wrapper, Spring Boot 4.1.x, PostgreSQL and Flyway. Use React, TypeScript, Vite and Material UI for the frontend. Pin exact supported dependency and image versions during bootstrap.

Start with a Maven parent and three modules: `catalogue-core`, `catalogue-service` and `catalogue-web`. The core owns domain types and rules; the service owns API, persistence, import, orchestration and provider adapters. The web module has its own JavaScript package manifest and lockfile, with its build integrated into Maven. Keep provider integration behind an application-owned interface.

For the MVP deployment, serve the built frontend from Spring Boot and use Docker Compose with application and database services. Include persistent database storage, health checks, external secret configuration and a documented backup/restore procedure. A shared expert deployment requires HTTPS, authentication and project access enforcement before inviting participants.

The repository should include architecture notes, a demonstration guide, sample application profiles, acceptance checks and an evaluation protocol. Use GitHub Actions for tests, frontend build and container build. Prepare publication separately from local implementation; repository creation and publication are not performed by this specification.

## Delivery increments

| Increment | Deliverable | Completion gate |
| --- | --- | --- |
| 1 Data foundation | Import validator, canonical mappings and audited C-01 fixture | All six C-01 actions retain their IDs, content, relationships and provenance; agreed aliases are reported |
| 2 Manual vertical slice | Four screens, profile, C-01 selection, manual adaptation, review, approval and exports | A user completes the acceptance walkthrough below without an LLM |
| 3 Full catalogue and first adapter | All 24 clusters, assisted selection/adaptation and structured validation | 144 actions and 184 references import; invalid proposals fail safely; saved work survives provider failure |
| 4 Expert evaluation release | Second adapter, comparison, reassessment, shared access and study materials | All release acceptance criteria pass and representative cases complete |

## Acceptance walkthrough for C-01

Use an English demonstration profile for a support-ticket application. Customers submit a name, email address and free-text request. Support agents read and answer tickets. Retention duration and any external data sharing are explicitly Unknown. The current phase is Requirements.

1. Save and confirm the profile; inspect both unknown fields and their provenance.
2. Select C-01 manually and inspect its definition, label mappings and references.
3. Open C01-A1 through C01-A6 under the six canonical action categories, including Validate.
4. Adapt C01-A1 to inventory ticket data, purposes, access, retention and sharing decisions. Keep unresolved facts visible and the owner Unassigned until the user assigns one.
5. Save an edit and confirm that it remains proposed. Accept the edited version explicitly; reject another proposal with a reason and mark another Awaiting information.
6. Approve a version containing only accepted and accepted-edited entries. The approval summary discloses the deferred work, unknowns and any unassigned owner.
7. Export English HTML and JSON. Both represent the same approved version, source links and gaps. Implementation remains Not started.
8. Change the profile to confirm use of an external ticket-processing provider. Create a new draft and flag affected recommendations without modifying the approved snapshot.
9. Submit an evidence link for an implemented action. Confirm that only a recorded human review can move its implementation status to Validated.

This example is a product acceptance scenario, not an assertion that a particular safeguard or retention period is legally required.

## Release acceptance criteria

- Import retains all 24 clusters, 144 action IDs, label mappings and 184 reference IDs; duplicate IDs, unknown categories and missing reference targets block publication.
- Import reports the agreed aliases and preserves source text and locations. Unresolved phase mappings remain explicit.
- All four screens, generated content, reports and error messages use English and canonical terminology.
- Unknown and Not applicable remain distinct. Unknown facts never silently become confirmed facts in accepted model output.
- All clusters are inspectable, and suggestions and overrides retain their reasons and supporting input IDs.
- Every catalogue adaptation has valid source links. Additional suggestions are visibly distinct and require explicit acceptance.
- Both adapters satisfy the same schema and validation checks. Invalid output, timeouts and partial failures preserve saved work and disclose the actual model used.
- Reviews retain actor, time and before/after content. Approval cannot automatically change implementation status.
- Approved snapshots remain unchanged after edits, model runs and catalogue updates. JSON and HTML exports agree with the selected version and disclose gaps.
- Changed recommendations require renewed review; uncertain dependencies trigger broader review instead of a false unaffected result.
- Concurrent edits and reused idempotency keys cannot silently overwrite work or create duplicate approvals/runs.
- Another project's profiles, runs, evidence and exports are inaccessible without membership. Credentials are absent from client bundles and exports.
- Keyboard navigation, focus visibility, readable layouts and loading/error recovery are checked in the four screens.
- Docker Compose starts the application with persistent data; a restart retains profiles, reviews and approved versions.

## Expert evaluation preparation

Prepare contrasting English cases: the support-ticket application, a recruitment-ranking application and a third case with substantial unknowns or environmental concerns. Include software without AI.

Compare manual catalogue use with assisted tool use using matched tasks and counterbalanced order where feasible. Record relevance, coverage, feasibility, source support, clarity of validation criteria, completion time, review effort and accepted/edited/rejected proportions. Combine observation with a short usability questionnaire and an interview.

Separate catalogue quality, model output quality and interface usability in the analysis. Record participants' prior involvement in catalogue validation. Do not treat model self-evaluation or acceptance counts alone as evidence of effectiveness.

The assisted increment supports OpenAI, Anthropic Claude and Ollama, with models selected by the operator/user rather than a fixed default. Before the shared study, record hosting, retention/deletion settings, participant permissions and the evaluation protocol. These choices do not block the data foundation or manual vertical slice.
