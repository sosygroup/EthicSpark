# EthicSpark conversational workspace

## Browse the catalogue without AI

Choose **Explore catalogue** in the sidebar, the book icon in the top bar, or **Explore catalogue without a model** on the welcome screen. The viewer opens over the workspace; **Close catalogue** returns to the current conversation and preserves the unsent message.

For direct access, start the backend with `./scripts/run.sh` and open `http://localhost:8082/?catalogue=1`. This page loads only the read-only catalogue APIs. It does not require a project, model, processing permission, API key or Ollama. Docker and the local backend remain necessary.

- **Clusters & actions:** search source content; optionally filter by action category, SDLC phase or ethics label. Actions marked for all phases remain included when filtering a phase. Select a cluster to read its definition, ethics-label characteristics, scope and source actions, including evidence, roles and source locations.
- **References:** browse all 184 records or follow a cluster/action’s linked references. Search by ID, title, author or year. Web source links open only when clicked; the desktop app opens them in the system browser.
- **Import notes:** inspect source-review warnings, normalisation notes and immutable version provenance. Displayed source content is not generated or rewritten by an LLM.
- **Catalogue version:** choose an imported snapshot. **Copy catalogue link** produces a local URL identifying the version and selected cluster. Recipients need their own running backend with that snapshot; localhost is not a public hosted catalogue.



The primary interface is now a general software-development conversation. Start with a prompt, attach material, or link a local project folder. The catalogue supplies relevant ethical guidance alongside other engineering considerations. There is no required application profile, phase questionnaire or upfront cluster selection.

## Start the desktop app

Prerequisites: Docker Desktop / Docker Engine with Compose v2, curl and a graphical macOS or Linux session.

```sh
./scripts/desktop.sh
```

The launcher starts the Java/PostgreSQL backend, verifies and caches a pinned Node runtime locally, installs locked desktop dependencies, downloads the pinned official Electron binary and opens EthicSpark. Initial startup requires network access. No global Node, Maven or JDK installation is needed to run the app itself. Commands requested against a developer's own project still need that project's normal tools installed on the host.

This is a source-distributed desktop MVP, not a signed self-contained installer. Its native window is independent of Codex/ChatGPT and uses the local backend. The backend remains Dockerised; host file access is handled by the desktop process rather than a container mount or Docker socket. Close the native window to stop the desktop process; backend containers remain available until `docker compose stop`.

Browser-only use is available after `./scripts/run.sh` at http://localhost:8082. It supports conversations, attachments, catalogue context, diagrams and downloaded text artefacts. Direct live-folder access, approved file edits and command execution require the desktop app. The interface indicates this distinction.

## First conversation

1. Open Model settings, choose OpenAI, Anthropic Claude or Ollama, and load or enter an available model ID. Provider credentials are configured in the ignored local `.env`, as described in [provider setup](ASSISTED_WORKFLOW.md). Model choice is remembered.
2. Authorise processing of messages and shared material for the current project/provider. External provider wording covers shared file contents and approved command output. Do not paste credentials into a conversation.
3. Write your request. The first message can create a workspace automatically. Optionally create a named project and link a local folder using the native folder picker.
4. Attach files with the paperclip, drop files onto the composer, or choose project files in the context panel. The assistant can request other relative paths when needed. No SDLC or ethics selections are required first.
5. Review the answer and continue normally. Relevant catalogue citations open source cluster information. They are optional supporting context, not a mandatory checklist.

Examples: “Help me understand this repository”, “Investigate why these tests fail”, “Design an API for this feature”, or “Review the privacy implications of this workflow”. The assistant may ask a focused question when needed, but it should progress with the context already available.

## Folder access and freshness

The desktop app records the linked folder path locally in its Electron user-data directory. It does not copy the folder into PostgreSQL or Git. An OS watcher refreshes the file index; selected/read file contents are reread immediately before each model turn. If watching is unavailable, sending a message still rereads current context. The UI marks external changes and shows which files are included.

The initial model context contains a limited relative file index, not every file's contents. The assistant can request specific files, and the app may perform up to two automatic read/continuation rounds after the initial call. Linking a folder grants read context; it does not authorise edits or commands. The project/provider permission also governs sharing readable file contents with the selected model.

Context limits: 2,000 indexed files, traversal depth 12, at most 20 UTF-8 files / 200,000 bytes per file in a turn, and 500,000 characters of assembled model text context. Larger or binary files can be attached separately; attachment extraction and limitations remain visible. Text, PDF, DOCX, XLS/XLSX and PPTX text can be extracted; spreadsheet formulas are exposed as formula text and are not recalculated. Images require a vision model. Secret files, hidden configuration directories, dependency/build caches and symlinks are excluded from native reads/writes. The app does not infer that every nonexcluded file is safe for an external provider; the developer controls what project and material they share.

## Permission-controlled actions

The model returns proposals. The Java backend validates relative paths, source citations and operation structure; it has no host file-access or command-execution API.

For a file change:

1. Choose Review change. The native agent reads the actual file and checks the base SHA-256 supplied from prior context.
2. Inspect complete Before/After content in the app.
3. Request permission. A native OS dialog identifies the exact file and before/after hashes. Deny is the default.
4. After approval, the agent checks the file again and applies the change, preserving an existing file's mode. If it changed since preview, the edit is rejected. New files cannot overwrite files that appeared after preview.

For a command, the preview and native dialog show the executable, argument array, reason and working directory. Execution uses no implicit shell. Commands run with the developer's user permissions, can affect resources outside the folder and may use the network; this MVP is **not an OS command sandbox**. Review project scripts and arguments. Provider keys are not passed from the backend into the native child environment. Commands have a 120-second deadline, bounded output and a stop control; results report actual stdout/stderr and exit code. Nonzero exits are failures, not successful tests.

Each approval is one-use and applies to one exact operation. There is no automatic approval mode. Declined actions do not run. Applying one proposal does not grant permission for later actions. After a receipt, use Continue task to let the assistant consider actual results and propose the next step.

The native process uses scoped IPC, checks the sender/main-frame origin, disables Node integration in the renderer and enables context isolation and renderer sandboxing. The local backend serves a restrictive Content Security Policy. These measures and path/hash checks do not establish that arbitrary approved commands are safe or eliminate all filesystem race conditions. Authentication and multi-user authorisation remain outside this local deployment.

## Outputs and persistence

Conversations support Markdown, code blocks, tables, Mermaid diagrams and downloadable text artefacts such as Markdown reports, JSON, CSV and source files. Artefacts remain in the conversation and context panel. Downloads do not automatically write into a project. File changes use the separate approval flow.

The current app does not provide built-in live web search, audio transcription, image generation or arbitrary binary-document conversion. Unsupported input formats are retained as attachments with an extraction limitation, not claimed as understood. Images require a vision-capable provider/model.

PostgreSQL stores projects, threads, messages, generated proposals/documents, attachment snapshots and operation receipts. Native folder files stay on disk. File-context manifests record relative names and SHA-256; complete read contents enter the model request but are not separately stored in these manifests. Responses and approved command output may of course contain project content. Treat database backups and exports as project data.

Request keys prevent duplicate calls for identical submissions and reject reuse with different input. Only one response per conversation runs at a time. Stop marks a pending response cancelled; a later provider result cannot overwrite it. An already sent provider request may still finish and be billed. OpenAI/Anthropic requests use a 180-second provider timeout and a 16,000-token output limit. Ollama defaults to a 600-second timeout, 8,192 output tokens and low reasoning effort (where supported), configurable with `OLLAMA_TIMEOUT_SECONDS`, `OLLAMA_MAX_OUTPUT_TOKENS` and `OLLAMA_REASONING_EFFORT`. An empty effort value uses the model default. There is no silent model fallback. Timeout errors distinguish slow processing from connection failures. The last 40 completed conversation messages enter context, with an explicit omitted-history count.

## Catalogue and previous work

New projects bind to the latest imported catalogue. The model receives cluster definitions, label characteristics, all source action texts, evidence, phases and roles, plus a registry of reference IDs and its count. Repeated import coordinates, action concern lists and full bibliographic records are not sent with every conversation turn. Full references and provenance remain available in the source catalogue APIs. Catalogue citations are checked against that version. Other engineering advice is permitted and should be distinguished from catalogue-supported recommendations.

The updated author workbook is distributed through a separately versioned public dataset; see [data provenance](DATA_PROVENANCE.md). Importer v2 supports its comma-separated lists and preserves raw workbook evidence. Existing imported versions and approved structured-workflow plans are unchanged.

The earlier form-based interface remains at `/?legacy=1`, accessible from Model settings for historical projects. It is not the primary user journey.

## Verification

```sh
./scripts/test.sh
runtime_node=$(./scripts/node-runtime.sh)
PATH="$(dirname "$runtime_node"):$PATH" "$runtime_node" --test desktop/test/*.test.cjs
```

The Java suite uses real PostgreSQL and local HTTP provider stubs. Native-agent tests use disposable folders and simulated permission decisions; they exercise actual file writes and child processes. They do not automate the OS permission dialog or establish real-provider reasoning quality. No real project content is sent to a cloud provider by these tests. A live-provider and expert usability evaluation remain necessary.

Implementation references: [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security), [native folder/dialog APIs](https://www.electronjs.org/docs/latest/api/dialog), and [Mermaid rendering/security](https://mermaid.js.org/config/usage.html).

## In-app explanations

Click the circled **i** beside a section, field or action that needs guidance to open its explanation. Familiar commands such as Close, Copy, Download and New conversation do not have additional information icons. Each explanation describes the purpose, expected next step and any relevant prerequisite or effect on shared context, files or model requests. These controls remain available beside disabled actions and do not perform the action they describe. Close explanation, Escape or clicking outside returns to the underlying view; keyboard focus returns to the information control.

The information icon in the top bar opens **How to use EthicSpark**, a short first-use guide available even in an existing conversation or on a narrow screen. Model connection, processing consent, live-folder access, generated downloads and operation approvals have separate explanations. The earlier structured workflow also includes page guides and explanations beside its actions and editable fields. All help text is in English.

## Manage projects

Open the **⋯** menu beside a project in the sidebar:

- **Rename project** changes its display name while retaining conversations, catalogue version and the linked folder. The earlier structured-workflow view uses the same new name.
- **Open folder** opens the project's linked local directory in Finder or the system file manager. It does not open a different folder picker or share additional context. It requires the desktop app and an existing folder link; the browser menu explains this limitation.
- **Delete project** asks for confirmation, then moves the project and its conversations to **Trash**. Saved material and immutable operation history are retained; this is not permanent data erasure. No local project file is deleted. The desktop folder link is cleared and future processing consent must be granted again.

Open **Trash** at the bottom of the sidebar to restore a project. Its saved messages, attachments, artifacts and receipts return. Link its local folder again if needed. Stop running responses or commands before deleting a project. This release does not provide permanent purge.

The opening mode banner states which environment is in use. Browser mode explains that live folders, file changes and commands need the desktop app, displays `./scripts/desktop.sh` and offers Copy command. Run it from the EthicSpark repository with Docker running. Desktop mode confirms native functionality and reminds the user that edits and commands need approval.

## Ollama troubleshooting

If model listing works but a response fails after several minutes, the connection may be healthy while the model is still evaluating the catalogue. The first response includes all 144 source actions and can take several minutes on a local model. The activity text explains this. Check Ollama's processing log and current model rather than reinstalling it. A timeout does not establish that the endpoint is unreachable.

The compact catalogue projection preserves the source text of every action and its evidence, phases and roles. It avoids sending full bibliography and repeated import metadata in every chat turn. Large attachments and long conversations can still exceed a model's practical context or performance limits; start a focused conversation when needed. Model reasoning controls follow [Ollama's compatibility documentation](https://docs.ollama.com/api/openai-compatibility).

After a provider failure, **Retry with saved context** submits a new request using the saved conversation, including when the first response failed. Each retry is a new inference request. Earlier error messages remain in history.
