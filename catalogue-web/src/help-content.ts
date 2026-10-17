export type HelpEntry = { title: string; text: string };
export const help: Record<string, HelpEntry> = {
  modelPerformance: {
    title: "Local model preparation and response timing",
    text: "Preloading asks Ollama to load the selected installed model without sending project content. It runs after selecting an Ollama model when enabled; Prepare model now retries or refreshes it. During preparation, an animated circular gauge shows elapsed time. It is indeterminate because Ollama exposes no live loading percentage. Closing and reopening settings preserves elapsed time for the same preparation. Completion or failure replaces the gauge with the actual result. Ollama is asked to retain the model after preparation and after every response, by default for 30 minutes. Choose Keep model in memory after use: 5, 30 or 60 minutes, or Custom (a whole number from 1–240). This preference is remembered separately for each model in this browser or desktop app and applies to preparation and each subsequent message. API callers that omit it use the server OLLAMA_KEEP_ALIVE_MINUTES default. Unload model now asks the shared Ollama server to release that model, without deleting its installed files or conversations. It is blocked during preparation or active tool requests. After manual unloading, automatic preparation pauses for that model until you prepare it or send a message; reopening the app restores automatic preparation if enabled. Other clients can load the model again. Keeping a model loaded consumes memory; other clients, model switches or memory pressure can affect availability. Disabling preload stops automatic preparation but does not immediately unload an already loaded model.\nResponse timing separates backend context preparation, the model request’s wall time and Ollama-reported loading, prompt processing and generation. The wall time includes transport and scheduling and does not equal the sum of the other fields. A preload happens before the response and is reported separately. Missing metrics say Not reported; earlier conversations are not backfilled. These measurements do not establish response quality. Live subphase progress is not available; the waiting message covers context processing and generation.",
  },
  explorer: {
    title: "Explore the source catalogue",
    text: "Browse the imported catalogue without configuring a model or creating a project. Search clusters and actions, filter by action category, SDLC phase or ethics label, then inspect original action text, expected evidence, roles and linked references. References opens all bibliographic records. Import notes retains source-review warnings and provenance. The app presents one catalogue without a version selector. Copy catalogue link shares a local URL for the selected cluster; import identifiers remain available only as provenance. In the workspace, Close catalogue returns to your unsent message. The local backend must be running; no AI requests are made. Source links open only when clicked.",
  },
  diagram: {
    title: "Diagram source",
    text: "Expand to inspect the Mermaid text used to draw this diagram. The diagram is generated content, not a verified representation of your system. Opening the source does not execute project code or modify files.",
  },
  start: {
    title: "How to use EthicSpark",
    text: "To browse without AI, choose Explore catalogue. No project, API key or Ollama is needed.\nFor an AI conversation:\n1. Open Model settings. Choose OpenAI, Anthropic Claude or Ollama, select a model and authorise processing for this project.\n2. Describe what you want in the message box. For example: ‘Review this API design and suggest tests.’\n3. Optionally attach documents or link a local project folder.\n4. Send your message, read the answer and ask follow-up questions. Review any proposed file change or command separately.\nNo application profile or catalogue selection is required. Relevant ethical considerations appear alongside general development advice.\nThe desktop app supports live folders, file edits and commands. The browser supports chat, attachments and downloads. Docker must remain running. A configured model is required; a ChatGPT or Claude chat subscription alone does not supply API access.",
  },
  conversation: {
    title: "New conversation",
    text: "Start a separate chat in the selected project. Existing conversations remain in the sidebar. The current unsent message and pending attachment choices are cleared. Starting a conversation does not create or change files.",
  },
  projects: {
    title: "Projects",
    text: "A project groups conversations, attachments, model-processing permission and a catalogue version. Create a named project to keep work organised, or simply send a message to create a workspace automatically. A project can optionally link to a local folder in the desktop app.",
  },
  project: {
    title: "Open project",
    text: "Switch to this project's saved conversations and its linked folder, if any. Model-processing permission is recorded separately for each project and provider. Switching projects does not alter files.",
  },
  thread: {
    title: "Open conversation",
    text: "Reopen this saved chat and continue from its history. Only the most recent 40 completed messages are sent as conversation history to the model. Selected live files are reread when you send the next message.",
  },
  settings: {
    title: "Model connection",
    text: "Choose the provider and model that answer your requests. Configure provider credentials on the local backend first, then load or enter a model ID. Authorise processing of this project's shared material. These choices are remembered; you can change them later. The catalogue is supplied automatically.",
  },
  provider: {
    title: "Provider",
    text: "Select the service that will process your conversation. OpenAI and Anthropic Claude require API credentials in the backend's local .env file. Ollama requires a running, configured local model server. Shared messages, attachments, file contents and command output may be sent to the selected service after you authorise processing.",
  },
  model: {
    title: "Model ID",
    text: "Click Load available models to open the complete model list, then choose a model. The list is not filtered by the currently selected name. Enter model ID manually remains available for an exact custom ID. The model must be available to your configured account or Ollama server. Use a vision-capable model for images. Changing this value affects future responses; it does not rewrite earlier messages.",
  },
  loadModels: {
    title: "Load available models",
    text: "Ask the configured provider for its available model IDs. This does not send your conversation or run catalogue analysis. If disabled, configure the selected provider on the backend first. If the request fails, check the connection, credentials and provider error.",
  },
  consent: {
    title: "Permission to process project material",
    text: "Allow the selected model service to process this project's messages and shared context. This includes attached files, selected/read project files and command output used in a later model turn. This is separate from permission to change files or run commands. Unchecking prevents new model requests for this project/provider; it does not recall data already sent.",
  },
  projectName: {
    title: "Project name",
    text: "Enter a short name that you will recognise in the sidebar, such as ‘Customer portal’. This is an organisational label, not a filesystem path. Creating a project does not create a folder on disk.",
  },
  create: {
    title: "Create project",
    text: "Create a named workspace for conversations and attachments. You can start chatting after configuring a model, and link an existing local folder later. No files are created in your software project.",
  },
  createLink: {
    title: "Create and link folder",
    text: "Create the named workspace and open the desktop folder picker. Select an existing local project folder. The app indexes permitted files; it does not upload the whole folder automatically. File contents enter model context when selected or requested. Edits and commands still need separate approval.",
  },
  folder: {
    title: "Link a local folder",
    text: "In the desktop app, choose a local project folder using the native picker. Its file list is watched for changes and shared files are reread before each message. Hidden secrets, dependency folders and symlinks are excluded from direct reads. This does not send the whole repository automatically or authorise edits or commands.\nIn a browser, use attachments instead, or launch ./scripts/desktop.sh for live-folder access.",
  },
  context: {
    title: "Project context",
    text: "Open or hide the side panel. Files shows the linked folder and lets you select files for model context. Artifacts lists downloadable generated documents. Activity lists recorded results of proposed operations. Opening the panel does not send a message.",
  },
  files: {
    title: "Files",
    text: "Browse permitted files in the linked local folder. Click a file to read it, preview it and include its current text in the next model request. A check mark means it is included. Remove from context in the preview to stop including it. Live-folder access requires the desktop app.",
  },
  file: {
    title: "Read and share a project file",
    text: "Read this file and open a preview. Its latest contents will be included when you next send a message to the selected model. This does not edit the file. Use Remove from context in the preview if you do not want to share it in subsequent requests.",
  },
  filePreview: {
    title: "File preview",
    text: "This is a snapshot of the file just read from your linked folder. The file is now selected for model context and will be reread before the next message. Closing the preview keeps it selected. Remove from context stops future inclusion without deleting or changing the file.",
  },
  removeContext: {
    title: "Remove from context",
    text: "Stop including this file in future model requests and close the preview. The original file stays on disk. Earlier messages or provider requests may already contain its contents.",
  },
  unlink: {
    title: "Unlink folder",
    text: "Disconnect the local folder from this project and clear the selected live-file context. No files are deleted. Existing conversation history and attachments remain. You can link a folder again later.",
  },
  artifacts: {
    title: "Artifacts",
    text: "Find documents and source files generated in this conversation. Click an item to download it. A download is separate from an approved edit to your linked project: it does not automatically change project files. You can also export the conversation as Markdown.",
  },
  download: {
    title: "Download generated artifact",
    text: "Save a copy of this generated document or source file through your browser or desktop download handling. Review its contents before using it. Downloading does not apply the content to your linked project or execute it.",
  },
  activity: {
    title: "Activity",
    text: "Inspect recorded file-change and command results, including declined, failed and cancelled operations. Expand an entry to see captured output. A proposal alone is not evidence that an operation ran. Command exit codes describe the actual execution result.",
  },
  attach: {
    title: "Attach files",
    text: "Choose one or more files or drop them onto the message box. Uploaded material is stored with the project and the selected attachments are supplied with your next message. Each file may be at most 10 MiB. Text, source files, PDF, DOCX, spreadsheets and presentations support text extraction; images need a vision model. Check extraction notices for unsupported or unreadable content.",
  },
  removeAttachment: {
    title: "Remove pending attachment",
    text: "Remove this file from the next message's attachment selection. This does not delete the original local file, and is not a request to erase already uploaded data or earlier messages.",
  },
  prompt: {
    title: "Write a message",
    text: "Describe your goal in ordinary language. For example: ‘Explain this repository’, ‘Help diagnose this error’, or ‘Review the privacy implications of this feature’. Add files only when useful; there is no required form. Press Enter to send, or Shift+Enter for a new line. Requests and relevant shared context go to the selected model.",
  },
  send: {
    title: "Send message",
    text: "Send your message, selected attachments and current shared-file context to the selected model. The app includes the project's catalogue automatically and saves the conversation. Configure a model and authorise processing first. Sending does not approve proposed file edits or commands. The response appears when processing completes.",
  },
  stop: {
    title: "Stop response",
    text: "Stop waiting for this response and mark it cancelled. A request already sent to the model provider may still finish and be billed. This does not stop a separately running project command; use Stop command in its review window.",
  },
  continue: {
    title: "Continue task",
    text: "Ask the model to continue using the saved conversation, current shared files and recorded operation results. Use this after applying or declining proposals so it can assess the outcome and suggest the next step. This sends a new model request and may incur provider cost; it grants no permission to execute anything.",
  },
  retry: {
    title: "Retry with saved context",
    text: "Send a new model request using the saved conversation and current shared context after an error. Check model settings or the reported error first. Retrying may incur provider cost and does not authorise file changes or commands.",
  },
  starter: {
    title: "Example prompt",
    text: "Insert an example request into the message box. Edit it to describe your own goal, add relevant material if needed, then press Send. Clicking this example does not send a request or change project files.",
  },
  citations: {
    title: "Catalogue context",
    text: "These links identify source clusters and actions used to support this response. Open one to inspect its definition and the model's explanation of relevance. The assistant can also give general engineering advice. Catalogue citations support reasoning; they do not certify ethical correctness or legal compliance.",
  },
  review: {
    title: "Review proposed operation",
    text: "Open the exact proposed change or command for inspection. For a file, compare Before and After. For a command, check the executable, arguments and working directory. Nothing runs merely by opening the review. The desktop app asks for separate, one-use native confirmation before applying it. This control requires the desktop app.",
  },
  decline: {
    title: "Decline proposal",
    text: "Record that this proposal was declined. The file change or command is not performed. You can explain your preference in a follow-up message and ask for a different proposal.",
  },
  permission: {
    title: "Request permission and apply or run",
    text: "Open the native confirmation for this exact operation. Deny is the default. Confirming grants permission once, for the displayed file change or command only. File changes are checked against the reviewed version. Commands run with your user permissions, may access outside the project and use the network; they are not contained in an OS sandbox. Results are recorded for review and may enter later model context.",
  },
  stopCommand: {
    title: "Stop command",
    text: "Request termination of this running command and its process group. Captured output remains available. Stopping does not undo changes the command has already made. Commands also have a 120-second deadline.",
  },
  copy: {
    title: "Copy response",
    text: "Copy the response's Markdown text to your clipboard. This does not copy downloaded artifacts separately or change project files. Clipboard access must be allowed by your browser or desktop environment.",
  },
  export: {
    title: "Export conversation",
    text: "Download this saved conversation as a Markdown document. It may contain shared project information and command output. Exporting does not change the conversation or create an approved plan.",
  },
  sidebar: {
    title: "Show or hide sidebar",
    text: "Show or hide projects, saved conversations and Model settings on smaller screens. This changes only the layout, not your project or conversation.",
  },
  close: {
    title: "Close window or panel",
    text: "Dismiss this window or panel and return to the workspace. Closing does not run a pending proposal or remove saved data. Changes made immediately in controls, such as model settings or file-context selection, are retained; this is not an undo button.",
  },
  cancel: {
    title: "Cancel",
    text: "Close this form without carrying out its create or approval action. Existing saved projects, conversations and files remain unchanged.",
  },
  legacy: {
    title: "Earlier structured workflow",
    text: "Open the preserved form-based interface for historical projects. It follows four stages: application profile, cluster selection, action adaptation and a reviewed project plan. It is optional; you do not need it for the conversational assistant. Return to the main workspace at /.",
  },
  profile: {
    title: "Application profile",
    text: "Describe known application context or mark information Unknown or Not applicable. Add supporting files when useful. Save draft keeps work in progress; Confirm profile makes this version available for structured catalogue reasoning. Confirming new information can require reviewing dependent draft recommendations again; approved plan versions remain preserved.",
  },
  clusters: {
    title: "Cluster selection",
    text: "Explore catalogue concerns and choose relevant clusters and ethics-label characteristics. You can select manually or request a model proposal after confirming the profile. Review its reasoning before saving the selection. Selecting a cluster does not accept its actions or approve a plan.",
  },
  adaptation: {
    title: "Adaptation workspace",
    text: "Review each source action against your application, lifecycle phases and evidence. Edit its wording, responsibility, priority and questions. Save edit preserves a draft; Accept records a reviewed action, Await information records a gap, and Reject excludes the action. Only suitable actions can be accepted.",
  },
  plan: {
    title: "Project plan",
    text: "Review action decisions and remaining gaps together. Export a report or JSON, inspect decision history, or approve an immutable plan version with recorded gaps. Approval records a human decision; it does not implement actions, run tests or establish compliance.",
  },
  saveDraft: {
    title: "Save draft",
    text: "Save the current profile information without confirming it for structured reasoning. Enter a reviewer name for the local decision history. You can reopen and complete the draft later.",
  },
  confirm: {
    title: "Confirm profile",
    text: "Record this profile version as confirmed by the named reviewer so it can be used for cluster selection and model reasoning. Review the text and attached evidence first. A later profile change may require dependent draft recommendations to be reviewed again.",
  },
  selection: {
    title: "Save cluster selection",
    text: "Save the selected clusters and characteristics and prepare their source actions for adaptation. A confirmed profile and reviewer name are required. This does not accept recommendations or approve a plan.",
  },
  details: {
    title: "View catalogue details",
    text: "Inspect the source cluster definition, label mappings, lifecycle phases, roles, actions and references. This is source material to support your selection; opening it does not select or accept anything.",
  },
  saveEdit: {
    title: "Save action edit",
    text: "Save the current action wording and fields as a draft. This does not accept the recommendation. Record your reviewer name and assess evidence and phase suitability before accepting it.",
  },
  accept: {
    title: "Accept action",
    text: "Record this suitable action as reviewed and accepted, including your edits where present. It can then contribute to a plan. Acceptance is a review decision and does not execute or implement the action.",
  },
  await: {
    title: "Await information",
    text: "Record that this action needs more information before a decision can be made. Capture the missing evidence or question in the action fields. It remains a visible gap in the plan.",
  },
  reject: {
    title: "Reject action",
    text: "Record that this action is not accepted for the current context. Explain the reason so other reviewers can understand the decision. The source catalogue action remains available.",
  },
  history: {
    title: "Decision history",
    text: "Read recorded profile, selection, recommendation and plan decisions, including the reviewer and timestamp. This is local audit history, not a record of deployed software changes.",
  },
  exportPlan: {
    title: "Export plan",
    text: "Download the selected draft or approved plan as JSON or a readable HTML report. Check which version is selected before sharing it. The export records decisions and gaps; it does not execute actions.",
  },
  approvePlan: {
    title: "Approve plan version",
    text: "Review the approval preview and explicitly record a version, including its remaining gaps. A confirmed profile, selected clusters, reviewer name and accepted action are required. The approved snapshot is immutable; later draft edits do not rewrite it. Approval is not certification or implementation.",
  },
  example: {
    title: "Start with an example",
    text: "Create a project with illustrative application-profile content to explore the structured workflow. Replace the sample information before making decisions about your own software. The example is not evidence about your project.",
  },
  reload: {
    title: "Reload workspace",
    text: "Reload the page and fetch saved server data again. Unsaved input can be lost. Use this after checking the displayed connection or service error.",
  },
  analyse: {
    title: "Analyse catalogue",
    text: "Send the confirmed profile and readable attached material to the selected model, with your processing permission. It proposes clusters, ethics-label characteristics and adapted actions. Nothing is selected or accepted automatically; review the proposal before applying it.",
  },
  reviewSelection: {
    title: "Review or apply model selection",
    text: "Review proposed clusters, characteristics and rationale, then apply only those you choose. Applying replaces the current draft selection and actions, which must be reviewed again. Approved plan versions remain unchanged. Continuing does not accept actions.",
  },
};
