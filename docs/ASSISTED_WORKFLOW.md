# Profile material and assisted catalogue workflow

This increment extends the local English workspace to all 24 catalogue clusters and adds OpenAI, Anthropic Claude and Ollama adapters. Manual selection and adaptation remain available without any model credentials.

## Application profile

Each Known field accepts text, supporting files, or both. Purpose and features includes an illustrative support-portal example. Current SDLC phase supports multiple explicitly selected phases.

Existing safeguards offers Company Ethics as an additional mode. Upload the company's internal regulations and optionally retain known safeguards text and its supporting files. Switching back to Known retains the company-ethics attachment list. Internal regulations are context, not evidence that safeguards have been implemented.

External data sharing offers None, which records exactly: “We do not share any personal data with third parties.” Unknown and Not applicable remain distinct.

Additional Material is optional and accepts supplementary files, such as architectural diagrams and workflows. Files are uploaded immediately; Save draft or Confirm profile attaches their IDs to the profile. Removing a file from the form excludes it from subsequent profiles; stored bytes remain available for historical snapshots. Existing projects with eight profile fields remain readable and acquire the optional ninth field when saved.

## File handling

Files are stored in PostgreSQL with project/field ownership, original bytes, a safe download name, MIME classification, SHA-256, extraction status and timestamp. Downloads are attachments with an octet-stream MIME type, never executable inline previews. Profile versions and approved plans retain their file IDs; plan exports include file names and hashes. Database backups therefore include uploaded material.

Limits: 10 MiB per file, ten files per field, 50 stored files / 100 MiB per project, 200 pages per PDF and 50,000 extracted characters per document. UTF-8 text, PDF and DOCX text are extracted locally. Scanned PDFs do not receive OCR. PNG/JPEG/WebP images are sent as images and require a vision-capable model. Other formats can be stored, but only their metadata and an unreadable-content warning enter analysis. Limits and extraction warnings are visible in the form and plan gaps.

Uploaded content is not malware-scanned. The application is a local research workspace, with self-reported reviewer labels and no authenticated project memberships. Do not expose it as a shared public service. Public GitHub availability does not publish local profiles or uploaded documents.

## Configure a provider

Put secrets in the ignored local `.env`, not in source files, browser fields or GitHub:

```dotenv
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
```

Configure either or both keys, then run `./scripts/run.sh` to recreate the application with its configuration. A ChatGPT or Claude consumer subscription is not an API credential. The tool never receives the developer's GitHub credentials as an LLM credential.

For local Ollama, start Ollama on the Docker host and install the model(s) you intend to use. Compose defaults to `http://host.docker.internal:11434/v1`. On Linux, ensure the configured endpoint is reachable from the Docker network; the host-gateway entry alone does not make a service bound only to host loopback reachable. Set `OLLAMA_BASE_URL` if needed. If this endpoint forwards to a remote service, set `OLLAMA_EXTERNAL=true` so the interface discloses external processing. Supply `OLLAMA_API_KEY` for an endpoint that requires authentication.

Use **Load models** in Cluster selection. Models come from the provider API, or an operator-supplied comma-separated `OPENAI_MODELS`, `ANTHROPIC_MODELS` or `OLLAMA_MODELS` allowlist. Model availability is not a guarantee of vision support or structured-output compatibility. A provider rejection is displayed; there is no silent model fallback. Operator endpoint overrides `OPENAI_BASE_URL` and `ANTHROPIC_BASE_URL` are supported for host development and deterministic tests, not browser-supplied endpoints.

## Analyse, review and continue

1. Save and confirm the application profile, including attachment references.
2. Select a provider and model. Explicitly authorise processing of the profile and material by that endpoint; the external-provider wording identifies when content leaves the local workspace.
3. Choose Analyse catalogue. The service sends all cluster definitions, label mappings and source actions, the confirmed profile, extracted material and supported images. There is one request per click, a 180-second request timeout, a 500,000-character text-context limit, at most eight images / 20 MiB, and a 16,000-token output limit. No automatic corrective retries are made.
4. Inspect the popup. Each proposed cluster includes a relevance rationale, ethics label cards/characteristics and all six adapted source actions. Each action has a phase-suitability assessment: Suitable, Not applicable or Uncertain. Inapplicable actions remain visible with a reason and no applicable phases.
5. Choose Review or change selection to remove clusters, edit rationales and choose source label characteristics. Choose Continue to actions to retain the selection and open the adaptation workspace. Applying a proposal replaces the current draft selection/recommendations and records the before/after event; approved plan versions are unchanged.
6. Edit each adapted action, evidence, criterion, suggested owner, rationale and phase suitability. A model proposal never counts as human acceptance. Resolve an Uncertain/Not applicable assessment before accepting; otherwise reject with a reason or await information.
7. Review and approve a plan version. Only accepted actions enter the immutable approved plan. HTML and JSON retain model/run provenance, reviewed label mappings, attachment metadata and disclosed gaps. Implementation remains Not started.

Closing the popup applies nothing. A failed, malformed or stale proposal changes no selection. The validator checks source cluster/action IDs, exact allowed label mappings, all six actions per cluster, distinct IDs, field lengths, enums and suitable-action phases. It does not establish that a model's reasoning is substantively correct.

## Provenance and reproducibility

Flyway V3 adds immutable attachment and reasoning-run tables. Each successful run records the project revision, profile version, catalogue version, provider/model, prompt version, timestamp and SHA-256 of the exact provider request payload and raw generated output text. Credentials and HTTP authorization headers are not included in those payload hashes. The persisted run contains the validated structured output; raw HTTP responses are not retained. The provider-output hash describes the original response, not later human-edited mappings. An applied project and approved plan retain the reviewed proposal and its source-run identity.

Provider/model names and input hashes do not make generations deterministic. Real-provider evaluation, model comparisons and expert usability evaluation remain outstanding. Automated adapter tests use a local HTTP stub, with no paid calls and no real project documents transmitted. Live cloud inference requires credentials supplied by the operator.

The prompt treats attached material as untrusted evidence. Schema validation blocks invented identifiers, but neither prompts nor schema checks guarantee resistance to all prompt injection or unsupported factual claims. Human review is required.

## Added APIs

| Endpoint | Purpose |
| --- | --- |
| `GET /api/reasoning/providers` | Provider names and server configuration availability, without secrets |
| `GET /api/reasoning/providers/{provider}/models` | Available/configured model IDs |
| `POST /api/projects/{id}/attachments` | Multipart `field` and `file` upload |
| `GET /api/projects/{id}/attachments` | Stored attachment metadata and extracted text |
| `GET /api/projects/{id}/attachments/{file}` | Download original bytes within the project |
| `POST /api/projects/{id}/reasoning` | Generate a proposal for an explicitly authorised confirmed profile |
| `GET /api/projects/{id}/reasoning/{run}` | Read a stored run within its project |
| `POST /api/projects/{id}/reasoning/apply` | Apply reviewed cluster/mapping selection with a revision check |
| `GET /api/catalogue/versions/{version}/cluster-details` | Full catalogue cluster definitions for the workspace |

Adapters follow the official [OpenAI Chat API](https://developers.openai.com/api/reference/resources/chat), [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages) and [Ollama compatibility API](https://docs.ollama.com/api/openai-compatibility). PDF extraction uses [Apache PDFBox](https://pdfbox.apache.org/3.0/migration.html).
