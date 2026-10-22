export type Severity = "info" | "warning" | "error";
export type Notice = {
  id: string;
  key: string;
  severity: Severity;
  source: string;
  title: string;
  explanation: string;
  nextStep: string;
  details: string;
  action?: "reload";
  read: boolean;
  count: number;
  firstAt: number;
  lastAt: number;
};
export type NoticeInput = Pick<
  Notice,
  "key" | "severity" | "source" | "title" | "explanation" | "nextStep"
> &
  Partial<Pick<Notice, "details" | "action">>;
let notices: Notice[] = [];
let sequence = 0;
const listeners = new Set<() => void>();
export const getNotices = () => notices;
export function subscribeNotices(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
function changed() {
  listeners.forEach((callback) => callback());
}
export function reportNotice(input: NoticeInput): string {
  const old = notices.find((n) => n.key === input.key);
  const now = Date.now();
  const item: Notice = {
    ...input,
    details: (input.details ?? old?.details ?? "").slice(0, 3000),
    id: old?.id || String(++sequence),
    read: false,
    count: (old?.count || 0) + 1,
    firstAt: old?.firstAt || now,
    lastAt: now,
  };
  notices = [item, ...notices.filter((n) => n.key !== input.key)].slice(0, 50);
  changed();
  return item.id;
}
export function markNoticesRead() {
  if (notices.some((n) => !n.read)) {
    notices = notices.map((n) => ({ ...n, read: true }));
    changed();
  }
}
export function clearReadNotices() {
  notices = notices.filter((n) => !n.read);
  changed();
}
export function fingerprint(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++)
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
export function explainIssue(
  message: string,
  source = "Application",
  severity: Severity = "error",
): NoticeInput {
  const base = {
    key: source + ":" + message,
    source,
    severity,
    details: message,
  };
  if (
    /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|loading .*chunk .*failed/i.test(
      message,
    )
  )
    return {
      ...base,
      title: "An interface component could not load",
      explanation:
        "The browser could not retrieve part of the interface. An older open window after an update, a local service restart or a connection problem can cause this. This message does not establish that the diagram text is invalid.",
      nextStep:
        "Check that the local service is running, then reload the app when you are ready.",
      action: "reload",
    };
  if (/\bHTTP\s+401\b|authentication was rejected/i.test(message))
    return {
      ...base,
      title: "Model-service authentication was rejected",
      explanation:
        "The provider rejected the request's authentication or access policy (HTTP 401). Common causes include an invalid or revoked API key, the wrong organization/project or an IP restriction. The status alone does not identify which one applies.",
      nextStep: /OpenAI-compatible/i.test(message)
        ? "Open Model settings, choose OpenAI-compatible, check the API base URL and provider key, then Save connection. Authorise the saved connection again and retry. No restart is needed. Do not paste the key into chat."
        : "Ask the person running the backend to check its configured provider API key and access policies, then restart the application service after any change. Retrying without fixing access will not help. Do not paste the key into chat.",
    };
  if (/\bHTTP\s+403\b/.test(message))
    return {
      ...base,
      title: "The provider denied access",
      explanation:
        "The provider rejected access to the requested resource (HTTP 403). Account permissions, model access or an applicable access policy may be involved.",
      nextStep:
        "Check provider permissions and model availability for this account before retrying.",
    };
  if (/\bHTTP\s+429\b/.test(message))
    return {
      ...base,
      title: "A provider limit was reached",
      explanation:
        "The provider reported a request-rate, credit or usage limit (HTTP 429). This status alone does not distinguish temporary throttling from exhausted credits.",
      nextStep:
        "Check provider usage, limits and billing. Wait if requests were throttled; exhausted credits or limits require an account change before retrying.",
    };
  if (/OLLAMA_REASONING_EFFORT/.test(message))
    return {
      ...base,
      title: "The Ollama reasoning preference is incompatible",
      explanation:
        "The selected model did not accept the server's reasoning preference. Different Ollama models support different thinking controls; this is a compatibility issue in how the tool applies that setting.",
      nextStep:
        "Update EthicSpark to use supported controls automatically. On an older installation, leave OLLAMA_REASONING_EFFORT empty in the backend .env and restart the application service, then retry the same model.",
    };
  if (
    /missing or oversized text|required field|is required|invalid duration|from 1 to 240/i.test(
      message,
    )
  )
    return {
      ...base,
      severity: "warning",
      title: "The input needs review",
      explanation:
        "A supplied value is missing or outside an accepted limit. This is a validation message, rather than evidence that the application has crashed.",
      nextStep:
        "Review the relevant field and the technical details. Fill any required value or shorten an oversized value, then retry.",
    };
  if (
    /ollama|openai|anthropic|claude|provider|model server/i.test(
      message + " " + source,
    )
  )
    return {
      ...base,
      title: "The model request needs attention",
      explanation:
        "The request involves the selected model service. Its availability, configuration, resource limits or response format may be involved; this message alone does not prove which component is responsible.",
      nextStep:
        "Check Model settings, the selected model and the service connection. Retry after correcting the reported issue.",
    };
  if (
    /failed to fetch|network|connection|unreachable|cannot reach/i.test(message)
  )
    return {
      ...base,
      title: "A connection could not be completed",
      explanation:
        "EthicSpark could not complete a request to a service. The service may be stopped, restarting or unreachable. The error alone does not identify the underlying cause.",
      nextStep:
        "Check that Docker and the required model service are running, then retry the action.",
    };
  if (/permission|consent|authoris|authorize|allow .*process/i.test(message))
    return {
      ...base,
      severity: "warning",
      title: "Permission or configuration is required",
      explanation:
        "This action was not completed because a required permission or configuration is missing. This is a request to review the settings, rather than evidence of a software failure.",
      nextStep:
        "Review the reported requirement and grant permission only if you intend to allow the action.",
    };
  return {
    ...base,
    title:
      severity === "info"
        ? "Workspace information"
        : "An action needs attention",
    explanation:
      severity === "info"
        ? message
        : "EthicSpark could not complete an action as requested. The cause may be the supplied input, the current project state, an integration or an application problem. More information is needed before assigning responsibility.",
    nextStep:
      severity === "info"
        ? "No action is needed unless the message requests it."
        : "Review the technical details below, check the relevant input or settings and retry. If it persists, keep the details for troubleshooting.",
  };
}
export function reportIssue(
  message: string,
  source?: string,
  severity?: Severity,
) {
  return reportNotice(explainIssue(message, source, severity));
}
