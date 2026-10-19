export type Project = { id: string; name: string; catalogueVersion: string };
export type Summary = {
  id: string;
  projectId: string;
  title: string;
  revision: number;
  updatedAt: string;
};
export type Operation = {
  id: string;
  kind: "write" | "command";
  path: string;
  content: string;
  baseSha256: string;
  program: string;
  args: string[];
  reason: string;
};
export type Artifact = { name: string; mediaType: string; content: string };
export type Citation = {
  clusterId: string;
  actionIds: string[];
  rationale: string;
};
export type FileContext = {
  path: string;
  sha256: string;
  text: string;
  notice: string;
};
export type Output = {
  message: string;
  citations: Citation[];
  readFiles: string[];
  operations: Operation[];
  artifacts: Artifact[];
};
export type ModelMetrics = {
  requestSeconds: number;
  loadSeconds: number | null;
  promptSeconds: number | null;
  generationSeconds: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  tokensPerSecond: number | null;
  contextPreparationSeconds: number | null;
};
export type ModelPreparation = {
  model: string;
  keepAliveMinutes: number;
  requestSeconds: number;
  loadSeconds: number | null;
};
export type Message = {
  id: string;
  role: string;
  text: string;
  status: string;
  provider: string;
  model: string;
  at: string;
  attachmentIds: string[];
  contextManifest: FileContext[];
  output: Output | null;
  inputSha256: string;
  metrics?: ModelMetrics | null;
};
export type Receipt = {
  id?: string;
  messageId?: string;
  operationId?: string;
  status: string;
  summary: string;
  output: string;
  exitCode: number | null;
};
export type Thread = {
  id: string;
  projectId: string;
  title: string;
  revision: number;
  messages: Message[];
  receipts: Receipt[];
};
export type Provider = {
  id: string;
  name: string;
  configured: boolean;
  external: boolean;
  setup: string;
};
export type Attachment = {
  id: string;
  name: string;
  extraction: string;
  mediaType: string;
  sha256: string;
};
export type Workspace = {
  projectId: string;
  name: string;
  path: string;
  tree: string[];
  truncated: boolean;
};
export type Preview = {
  ticket: string;
  kind: "write" | "command";
  path?: string;
  before?: string;
  after?: string;
  beforeSha256?: string;
  afterSha256?: string;
  program?: string;
  args?: string[];
  cwd?: string;
  reason: string;
};
export interface Desktop {
  onApplicationUpdateCheck?: (callback: () => void) => () => void;
  linkFolder: (project: string) => Promise<Workspace | null>;
  openExternalLink?: (url: string) => Promise<void>;
  openFolder: (project: string) => Promise<null>;
  workspace: (project: string) => Promise<Workspace | null>;
  unlinkFolder: (project: string) => Promise<null>;
  readFile: (project: string, path: string) => Promise<FileContext>;
  prepareOperation: (project: string, operation: Operation) => Promise<Preview>;
  approveOperation: (ticket: string) => Promise<Receipt>;
  stopCommand: (ticket: string) => Promise<void>;
  onWorkspaceChanged: (
    callback: (event: { projectId: string }) => void,
  ) => () => void;
  onCommandOutput: (
    callback: (event: { ticket: string; text: string }) => void,
  ) => () => void;
}
declare global {
  interface Window {
    ethicsparkDesktop?: Desktop;
  }
}
