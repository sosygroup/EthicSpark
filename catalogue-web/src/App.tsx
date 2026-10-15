import { useEffect, useRef, useState, isValidElement } from "react";
import type { ReactElement } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Snackbar,
  TextField,
} from "@mui/material";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  Artifact,
  Attachment,
  Citation,
  FileContext,
  Message,
  Operation,
  Preview,
  Project,
  Provider,
  Receipt,
  Summary,
  Thread,
  Workspace,
} from "./assistant-types";
import "./assistant.css";
import Diagram from "./Diagram";

const native = window.ethicsparkDesktop;
async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.detail || "The request failed.");
  return data;
}
function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    plus: "M12 5v14M5 12h14",
    folder: "M3 7V5h6l2 2h10v12H3Z",
    chat: "M4 4h16v12H9l-5 4Z",
    attach: "m8 13 7-7a3 3 0 0 1 4 4L9 20a5 5 0 0 1-7-7L13 2",
    send: "M12 19V5m-6 6 6-6 6 6",
    gear: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 12H2m20 0h-2M12 4V2m0 20v-2M6 6 4 4m16 16-2-2M6 18l-2 2M20 4l-2 2",
    files: "M6 3h8l4 4v14H6Zm8 0v5h4",
    close: "m6 6 12 12M6 18 18 6",
    check: "m5 12 4 4L19 6",
    download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
    menu: "M4 6h16M4 12h16M4 18h16",
    refresh:
      "M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 7M4 12l2 7a7 7 0 0 0 12-2",
    code: "m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18",
    stop: "M6 6h12v12H6Z",
    shield: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7Z",
    arrow: "m9 5 7 7-7 7",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.chat} />
    </svg>
  );
}
function download(artifact: Artifact) {
  const url = URL.createObjectURL(
    new Blob([artifact.content], { type: artifact.mediaType || "text/plain" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = artifact.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function RichText({ text }: { text: string }) {
  return (
    <div className="chat-markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          pre: ({ children }) =>
            isValidElement(children) &&
            (children as ReactElement<{ className?: string }>).props
              .className === "language-mermaid" ? (
              <Diagram
                code={String(
                  (children as ReactElement<{ children?: unknown }>).props
                    .children || "",
                )}
              />
            ) : (
              <div className="code-block">
                <pre>{children}</pre>
              </div>
            ),
          code: ({ children, className }) => (
            <code className={className}>{children}</code>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
export default function App() {
  const [projects, setProjects] = useState<Project[]>([]),
    [threads, setThreads] = useState<Summary[]>([]),
    [thread, setThread] = useState<Thread | null>(null),
    [projectId, setProjectId] = useState(
      localStorage.getItem("ethicspark-project") || "",
    );
  const [prompt, setPrompt] = useState(""),
    [busy, setBusy] = useState(false),
    [activity, setActivity] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [paths, setPaths] = useState<string[]>([]),
    [fileView, setFileView] = useState<FileContext | null>(null),
    [folderChanged, setFolderChanged] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]),
    [provider, setProvider] = useState(
      localStorage.getItem("ethicspark-provider") || "openai",
    ),
    [model, setModel] = useState(
      localStorage.getItem("ethicspark-model") || "",
    ),
    [models, setModels] = useState<string[]>([]);
  const [consents, setConsents] = useState<Record<string, boolean>>(() =>
      JSON.parse(localStorage.getItem("ethicspark-consents") || "{}"),
    ),
    [settings, setSettings] = useState(false),
    [newProject, setNewProject] = useState(false),
    [projectName, setProjectName] = useState("");
  const [attached, setAttached] = useState<Attachment[]>([]),
    [uploading, setUploading] = useState(false),
    [panel, setPanel] = useState<"files" | "artifacts" | "activity" | null>(
      null,
    ),
    [sidebar, setSidebar] = useState(false),
    [citation, setCitation] = useState<Citation | null>(null),
    [citationSource, setCitationSource] = useState<{
      title: string;
      definition: string;
    } | null>(null);
  const [preview, setPreview] = useState<{
      message: Message;
      operation: Operation;
      value: Preview;
    } | null>(null),
    [executing, setExecuting] = useState(false),
    [liveOutput, setLiveOutput] = useState("");
  const abort = useRef<AbortController | null>(null),
    end = useRef<HTMLDivElement | null>(null),
    fileInput = useRef<HTMLInputElement | null>(null),
    composer = useRef<HTMLTextAreaElement | null>(null);
  const project = projects.find((p) => p.id === projectId),
    currentProvider = providers.find((p) => p.id === provider);
  const consentKey = projectId + ":" + provider,
    consent = !!consents[consentKey];
  const artifacts =
    thread?.messages.flatMap((m) => m.output?.artifacts || []) || [];
  async function refresh() {
    const [ps, ts] = await Promise.all([
      api<Project[]>("/api/assistant/projects"),
      api<Summary[]>("/api/assistant/threads"),
    ]);
    setProjects(ps);
    setThreads(ts);
    return { ps, ts };
  }
  useEffect(() => {
    let active = true;
    Promise.all([refresh(), api<Provider[]>("/api/reasoning/providers")])
      .then(async ([data, ps]) => {
        if (!active) return;
        setProviders(ps);
        const last = localStorage.getItem("ethicspark-thread");
        if (last && data.ts.some((t) => t.id === last)) {
          const t = await api<Thread>("/api/assistant/threads/" + last);
          if (active) {
            setThread(t);
            setProjectId(t.projectId);
          }
        } else if (!data.ps.some((p) => p.id === projectId)) setProjectId("");
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    localStorage.setItem("ethicspark-provider", provider);
    localStorage.setItem("ethicspark-model", model);
  }, [provider, model]);
  useEffect(() => {
    localStorage.setItem("ethicspark-consents", JSON.stringify(consents));
  }, [consents]);
  useEffect(() => {
    localStorage.setItem("ethicspark-project", projectId);
    if (!projectId || !native) {
      setWorkspace(null);
      setPaths([]);
      return;
    }
    let active = true;
    native
      .workspace(projectId)
      .then((w) => {
        if (active) setWorkspace(w);
      })
      .catch((e) => setError(e.message));
    try {
      setPaths(
        JSON.parse(
          localStorage.getItem("ethicspark-files-" + projectId) || "[]",
        ),
      );
    } catch {
      setPaths([]);
    }
    return () => {
      active = false;
    };
  }, [projectId]);
  useEffect(() => {
    if (projectId)
      localStorage.setItem(
        "ethicspark-files-" + projectId,
        JSON.stringify(paths),
      );
  }, [paths, projectId]);
  useEffect(() => {
    if (thread) localStorage.setItem("ethicspark-thread", thread.id);
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length, thread?.messages.at(-1)?.status]);
  useEffect(
    () =>
      native?.onWorkspaceChanged((event) => {
        if (event.projectId === projectId) {
          setFolderChanged(true);
          native
            .workspace(projectId)
            .then(setWorkspace)
            .catch((e) => setError(e.message));
        }
      }),
    [projectId],
  );
  useEffect(
    () =>
      native?.onCommandOutput((event) => {
        if (event.ticket === preview?.value.ticket)
          setLiveOutput((v) => (v + event.text).slice(-100000));
      }),
    [preview?.value.ticket],
  );
  async function ensureProject() {
    if (projectId) return projectId;
    const p = await api<Project>("/api/assistant/projects", {
      name: "My workspace",
    });
    setProjectId(p.id);
    await refresh();
    return p.id;
  }
  async function createProject(link = false) {
    setError("");
    try {
      const p = await api<Project>("/api/assistant/projects", {
        name: projectName.trim() || "New project",
      });
      setProjectId(p.id);
      setThread(null);
      setAttached([]);
      setPrompt("");
      setNewProject(false);
      setProjectName("");
      await refresh();
      if (link && native) setWorkspace(await native.linkFolder(p.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function linkFolder() {
    if (!native) {
      setNotice(
        "Open the EthicSpark desktop app to link a live folder. Run ./scripts/desktop.sh. You can still chat and upload files here.",
      );
      return;
    }
    try {
      const id = await ensureProject();
      const w = await native.linkFolder(id);
      if (w) {
        setWorkspace(w);
        setPaths([]);
        setPanel("files");
        setNotice(
          "Folder linked for reading. Every edit and command will require your permission.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function chooseProject(id: string) {
    if (busy || executing) return;
    setProjectId(id);
    setAttached([]);
    setPrompt("");
    setFileView(null);
    setSidebar(false);
    const last = threads.find((t) => t.projectId === id);
    setThread(
      last ? await api<Thread>("/api/assistant/threads/" + last.id) : null,
    );
  }
  async function chooseThread(id: string) {
    if (busy || executing) return;
    try {
      const t = await api<Thread>("/api/assistant/threads/" + id);
      setProjectId(t.projectId);
      setThread(t);
      setAttached([]);
      setPrompt("");
      setSidebar(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      if (attached.length + files.length > 10)
        throw Error("Attach at most ten files per message.");
      const id = await ensureProject();
      for (const file of Array.from(files)) {
        if (attached.length >= 10)
          throw Error("Attach at most ten files per message.");
        const data = new FormData();
        data.append("field", "additional");
        data.append("file", file);
        const response = await fetch("/api/projects/" + id + "/attachments", {
          method: "POST",
          body: data,
        });
        const body = await response.json();
        if (!response.ok) throw Error(body.detail || "Upload failed.");
        setAttached((v) => [...v, body]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  async function readContext(id: string, include: string[]) {
    if (!native) return { name: "", tree: [], files: [] as FileContext[] };
    const w = await native.workspace(id);
    setWorkspace(w);
    if (!w) return { name: "", tree: [], files: [] as FileContext[] };
    const files: FileContext[] = [];
    for (const path of include.slice(0, 20)) {
      try {
        files.push(await native.readFile(id, path));
      } catch (e) {
        setNotice(path + ": " + (e as Error).message);
      }
    }
    setFolderChanged(false);
    return { name: w.name, tree: w.tree, files };
  }
  const sending = useRef(false);
  async function send(continuation = false, existing?: Thread) {
    if (sending.current) return;
    sending.current = true;
    try {
      await performSend(continuation, existing);
    } finally {
      sending.current = false;
    }
  }
  async function performSend(continuation = false, existing?: Thread) {
    if (busy || uploading || executing) return;
    let id = projectId;
    try {
      if (!id) id = await ensureProject();
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    if (!model.trim() || !currentProvider?.configured) {
      setSettings(true);
      return;
    }
    if (!consents[id + ":" + provider]) {
      setSettings(true);
      return;
    }
    const text = continuation
      ? "Continue the task using the current workspace and actual operation results."
      : prompt.trim();
    if (!continuation && !text && !attached.length) return;
    setBusy(true);
    setError("");
    setActivity("Reading the current project context…");
    abort.current = new AbortController();
    let current = existing || thread,
      include = [...paths];
    try {
      if (!current) {
        current = await api<Thread>("/api/assistant/threads", {
          projectId: id,
        });
        setThread(current);
      }
      const initialFiles = continuation ? [] : attached.map((a) => a.id);
      if (!continuation) {
        setPrompt("");
        setAttached([]);
      }
      for (let round = 0; round < 3; round++) {
        const context = await readContext(id, include);
        setActivity(
          round
            ? "Reading requested files and continuing…"
            : "Thinking through your request…",
        );
        const body = {
          revision: current!.revision,
          requestKey: crypto.randomUUID(),
          text: round ? "Continue using the requested file contents." : text,
          provider,
          model,
          consent: true,
          attachmentIds: round ? [] : initialFiles,
          workspace: context,
          continuation: continuation || round > 0,
        };
        // Start the request before polling, so a saved user message appears while the model works.
        const response: Promise<Thread> = api<Thread>(
          "/api/assistant/threads/" + current!.id + "/messages",
          body,
          abort.current!.signal,
        );
        const timer = setInterval(() => {
          if (current)
            void api<Thread>("/api/assistant/threads/" + current.id)
              .then((latest) =>
                setThread((previous) =>
                  previous?.id === latest.id &&
                  previous.revision > latest.revision
                    ? previous
                    : latest,
                ),
              )
              .catch(() => {});
        }, 1500);
        try {
          current = await response;
        } finally {
          clearInterval(timer);
        }
        setThread(current);
        const last = current!.messages.at(-1);
        if (last?.status === "error" || last?.status === "cancelled") break;
        const requested = last?.output?.readFiles || [];
        if (
          !native ||
          (!workspace && !(await native.workspace(id))) ||
          !requested.length
        )
          break;
        const fresh = requested.filter((p) => !include.includes(p));
        if (!fresh.length) break;
        include = [...new Set([...include, ...fresh])].slice(-20);
        setPaths(include);
      }
      await refresh();
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
        if (!continuation) {
          setPrompt((v) => v || text);
          setAttached((v) => (v.length ? v : attached));
        }
        if (current)
          setThread(await api<Thread>("/api/assistant/threads/" + current.id));
      }
    } finally {
      setBusy(false);
      setActivity("");
      abort.current = null;
      composer.current?.focus();
    }
  }
  async function stop() {
    abort.current?.abort();
    if (thread) {
      setThread(
        await api<Thread>("/api/assistant/threads/" + thread.id + "/stop", {}),
      );
    }
    setBusy(false);
    setActivity("");
  }
  async function loadModels() {
    setError("");
    try {
      const ids = await api<string[]>(
        "/api/reasoning/providers/" + provider + "/models",
      );
      setModels(ids);
      if (!model && ids.length) setModel(ids[0]);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function openFile(path: string) {
    if (!native || !projectId) return;
    try {
      const f = await native.readFile(projectId, path);
      setFileView(f);
      setPaths((v) => [...new Set([...v, path])].slice(-20));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function inspectCitation(c: Citation) {
    setCitation(c);
    setCitationSource(null);
    if (project)
      try {
        setCitationSource(
          await api(
            "/api/catalogue/versions/" +
              project.catalogueVersion +
              "/clusters/" +
              c.clusterId,
          ),
        );
      } catch (e) {
        setError((e as Error).message);
      }
  }
  async function prepare(message: Message, operation: Operation) {
    if (!native || !thread) return;
    setError("");
    try {
      const value = await native.prepareOperation(thread.projectId, operation);
      setPreview({ message, operation, value });
      setLiveOutput("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function record(
    message: Message,
    operation: Operation,
    result: Receipt,
  ) {
    if (!thread) return null;
    const t = await api<Thread>(
      "/api/assistant/threads/" +
        thread.id +
        "/messages/" +
        message.id +
        "/receipts",
      { operationId: operation.id, ...result },
    );
    setThread(t);
    return t;
  }
  async function deny(message: Message, operation: Operation) {
    try {
      await record(message, operation, {
        status: "rejected",
        summary: "Developer declined the proposed operation.",
        output: "",
        exitCode: null,
      });
      setPreview(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function approve() {
    if (!preview || !native) return;
    setExecuting(true);
    setLiveOutput("");
    try {
      const result = await native.approveOperation(preview.value.ticket);
      await record(preview.message, preview.operation, result);
      setNotice(result.summary);
      setPreview(null);
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      await record(preview.message, preview.operation, {
        status: "failed",
        summary: message,
        output: "",
        exitCode: null,
      });
      setPreview(null);
    } finally {
      setExecuting(false);
    }
  }
  const pending = thread?.messages.some((m) => m.status === "pending");
  const visibleMessages =
    thread?.messages.filter((m) => m.role !== "tool") || [];
  return (
    <div className={"assistant-root" + (sidebar ? " sidebar-open" : "")}>
      <aside className="assistant-sidebar">
        <div className="assistant-brand">
          <span className="brand-mark">
            <Icon name="shield" size={21} />
          </span>
          <strong>EthicSpark</strong>
          <span className="desktop-badge">
            {native ? "Desktop" : "Workspace"}
          </span>
        </div>
        <button
          className="side-new"
          onClick={() => {
            if (!busy && !executing) {
              setThread(null);
              setPrompt("");
              setAttached([]);
              setSidebar(false);
              composer.current?.focus();
            }
          }}
        >
          <Icon name="plus" />
          New conversation
        </button>
        <div className="side-heading">
          Projects
          <button
            title="New project"
            aria-label="New project"
            onClick={() => setNewProject(true)}
          >
            <Icon name="plus" size={16} />
          </button>
        </div>
        <div className="project-list">
          {projects.map((p) => (
            <div key={p.id}>
              <button
                className={
                  "project-row " + (p.id === projectId ? "selected" : "")
                }
                onClick={() => void chooseProject(p.id)}
              >
                <Icon name="folder" />
                <span>{p.name}</span>
              </button>
              {p.id === projectId && (
                <div className="thread-list">
                  {threads
                    .filter((t) => t.projectId === p.id)
                    .map((t) => (
                      <button
                        key={t.id}
                        className={thread?.id === t.id ? "active" : ""}
                        onClick={() => void chooseThread(t.id)}
                      >
                        {t.title}
                      </button>
                    ))}
                </div>
              )}
            </div>
          ))}
          {!projects.length && !loading && (
            <p className="side-empty">
              Start a conversation, or create a project and link its folder.
            </p>
          )}
        </div>
        <div className="side-bottom">
          <button onClick={() => setSettings(true)}>
            <Icon name="gear" />
            Model settings
          </button>
          <span>
            Ethics-aware software development
            <br />
            Your workflow, with the catalogue in context.
          </span>
        </div>
      </aside>
      <section className="assistant-main">
        <header className="assistant-topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle sidebar"
              onClick={() => setSidebar((v) => !v)}
            >
              <Icon name="menu" />
            </button>
            <span className="project-breadcrumb">
              {project?.name || "Your workspace"}
            </span>
            <span className="header-divider">/</span>
            <span className="conversation-title">
              {thread?.title || "New conversation"}
            </span>
          </div>
          <div className="topbar-actions">
            <button className="model-pill" onClick={() => setSettings(true)}>
              {model || "Connect a model"}
              <span>⌄</span>
            </button>
            <button
              className="icon-button"
              title="Project context"
              aria-label="Project context"
              onClick={() => setPanel(panel ? null : "files")}
            >
              <Icon name="files" />
            </button>
          </div>
        </header>
        {error && (
          <div className="workspace-error">
            <Alert severity="error" onClose={() => setError("")}>
              {error}
            </Alert>
          </div>
        )}
        <div className="conversation-scroll">
          {!visibleMessages.length ? (
            <div className="welcome">
              <div className="welcome-symbol">
                <Icon name="shield" size={30} />
              </div>
              <span className="welcome-eyebrow">
                A workspace for thoughtful engineering
              </span>
              <h1>What are you building?</h1>
              <p>
                Ask a question, share a document, or work with your project.
                <br />
                Start where you are. We’ll work through the details together.
              </p>
              <div className="starter-grid">
                {[
                  [
                    "Review my project",
                    "Help me understand this project and identify practical improvements.",
                  ],
                  [
                    "Think through a design",
                    "Help me think through the architecture of a system I’m building.",
                  ],
                  [
                    "Investigate a problem",
                    "Help me investigate a bug and plan targeted tests.",
                  ],
                  [
                    "Explore an ethical concern",
                    "Help me assess the ethical implications of a software feature.",
                  ],
                ].map(([title, text]) => (
                  <button
                    key={title}
                    onClick={() => {
                      setPrompt(text);
                      composer.current?.focus();
                    }}
                  >
                    <Icon
                      name={title.includes("ethical") ? "shield" : "code"}
                    />
                    <span>{title}</span>
                    <Icon name="arrow" size={14} />
                  </button>
                ))}
              </div>
              {!projectId && (
                <button className="welcome-link" onClick={linkFolder}>
                  <Icon name="folder" />
                  Link a project folder <span>optional</span>
                </button>
              )}
            </div>
          ) : (
            <div className="messages">
              {visibleMessages.map((m) => (
                <article key={m.id} className={"message message-" + m.role}>
                  {m.role === "user" ? (
                    <>
                      <div className="user-bubble">{m.text}</div>
                      {m.attachmentIds.length > 0 && (
                        <span className="message-material">
                          <Icon name="attach" size={14} />
                          {m.attachmentIds.length} attached file(s)
                        </span>
                      )}
                      {m.contextManifest.length > 0 && (
                        <span className="message-material">
                          Context from {m.contextManifest.length} project
                          file(s)
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="assistant-avatar">
                        <Icon name="shield" size={18} />
                      </div>
                      <div className="assistant-response">
                        {m.status === "pending" ? (
                          <div className="thinking">
                            <span className="thinking-dot" />
                            {activity || "Working on your request…"}
                          </div>
                        ) : m.status === "error" ? (
                          <div className="response-error">
                            <strong>Response unavailable</strong>
                            <p>{m.text}</p>
                            <button onClick={() => void send(true)}>
                              Retry with saved context
                            </button>
                          </div>
                        ) : (
                          <RichText text={m.text} />
                        )}
                        {m.output?.citations.length ? (
                          <div className="catalogue-citations">
                            <span>
                              <Icon name="shield" size={13} />
                              Catalogue context
                            </span>
                            {m.output.citations.map((c, i) => (
                              <button
                                key={i}
                                onClick={() => void inspectCitation(c)}
                              >
                                {c.clusterId}
                                {c.actionIds.length
                                  ? " · " + c.actionIds.join(", ")
                                  : ""}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {m.output?.readFiles.length ? (
                          <div className="read-request">
                            <Icon name="files" size={15} />
                            Requested context: {m.output.readFiles.join(", ")}
                            {!native && (
                              <span>
                                {" "}
                                — link the folder in the desktop app to read
                                these files.
                              </span>
                            )}
                          </div>
                        ) : null}
                        {m.output?.operations.map((op) => {
                          const result = thread?.receipts.find(
                            (r) =>
                              r.messageId === m.id && r.operationId === op.id,
                          );
                          return (
                            <div className="operation-card" key={op.id}>
                              <div className="operation-heading">
                                <Icon
                                  name={op.kind === "write" ? "files" : "code"}
                                />
                                <strong>
                                  {op.kind === "write"
                                    ? op.path
                                    : [op.program, ...op.args].join(" ")}
                                </strong>
                                <span
                                  className={
                                    "operation-state " + (result?.status || "")
                                  }
                                >
                                  {result?.status || "Permission required"}
                                </span>
                              </div>
                              <p>{op.reason}</p>
                              {result ? (
                                <details>
                                  <summary>{result.summary}</summary>
                                  <pre>{result.output}</pre>
                                </details>
                              ) : (
                                <div className="operation-buttons">
                                  <button
                                    disabled={!native || busy || executing}
                                    onClick={() => void prepare(m, op)}
                                  >
                                    Review{" "}
                                    {op.kind === "write" ? "change" : "command"}
                                  </button>
                                  <button
                                    disabled={busy || executing}
                                    onClick={() => void deny(m, op)}
                                  >
                                    Decline
                                  </button>
                                  {!native && (
                                    <small>
                                      File changes and commands require the
                                      desktop app.
                                    </small>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {m.output?.artifacts.map((a, i) => (
                          <button
                            className="artifact-card"
                            key={i}
                            onClick={() => download(a)}
                          >
                            <span className="artifact-icon">
                              <Icon name="files" />
                            </span>
                            <span>
                              <strong>{a.name}</strong>
                              <small>Generated document · Download</small>
                            </span>
                            <Icon name="download" />
                          </button>
                        ))}
                        {m.status === "complete" && (
                          <div className="response-meta">
                            {m.model}
                            <button
                              onClick={() =>
                                navigator.clipboard
                                  .writeText(m.text)
                                  .then(() => setNotice("Response copied."))
                                  .catch(() =>
                                    setNotice(
                                      "Clipboard access is unavailable.",
                                    ),
                                  )
                              }
                            >
                              Copy
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </article>
              ))}
              <div ref={end} />
            </div>
          )}
        </div>
        <div className="composer-region">
          <div className="composer-wrap">
            {workspace && (
              <div className="workspace-chip">
                <Icon name="folder" size={14} />
                <button onClick={() => setPanel("files")}>
                  {workspace.name}
                </button>
                <span>
                  {folderChanged ? "Changed · refresh on send" : "Live folder"}
                </span>
                <span className="permission-chip">Ask before changes</span>
              </div>
            )}
            {attached.length > 0 && (
              <div className="attachment-chips">
                {attached.map((a) => (
                  <div key={a.id} title={a.extraction}>
                    <Icon name="attach" size={14} />
                    {a.name}
                    <button
                      aria-label={"Remove " + a.name}
                      onClick={() =>
                        setAttached((v) => v.filter((f) => f.id !== a.id))
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div
              className="prompt-box"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!busy) void upload(e.dataTransfer.files);
              }}
            >
              <textarea
                ref={composer}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask anything about your software, or describe what you want to do…"
                aria-label="Message EthicSpark"
                rows={3}
                disabled={uploading}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <div className="composer-tools">
                <div>
                  <button
                    className="icon-button"
                    title="Attach files"
                    aria-label="Attach files"
                    disabled={busy || uploading}
                    onClick={() => fileInput.current?.click()}
                  >
                    <Icon name="attach" />
                  </button>
                  <button
                    className="icon-button"
                    title="Link a folder"
                    aria-label="Link a folder"
                    disabled={busy || executing}
                    onClick={linkFolder}
                  >
                    <Icon name="folder" />
                  </button>
                  {uploading && (
                    <span className="composer-status">Uploading…</span>
                  )}
                  {busy && <span className="composer-status">{activity}</span>}
                </div>
                {busy || pending ? (
                  <button
                    className="send-button stop-button"
                    aria-label="Stop response"
                    onClick={() => void stop()}
                  >
                    <Icon name="stop" />
                  </button>
                ) : (
                  <button
                    className="send-button"
                    aria-label="Send message"
                    disabled={
                      uploading ||
                      (!prompt.trim() && !attached.length) ||
                      executing
                    }
                    onClick={() => void send()}
                  >
                    <Icon name="send" />
                  </button>
                )}
              </div>
            </div>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={(e) => void upload(e.target.files)}
            />
            <div className="composer-caption">
              The catalogue informs relevant answers. File edits and commands
              require your permission.
              {thread && (
                <button
                  onClick={() => void send(true)}
                  disabled={busy || executing}
                >
                  Continue task
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
      {panel && (
        <aside className="context-panel">
          <div className="context-header">
            <strong>Project context</strong>
            <button
              className="icon-button"
              aria-label="Close context"
              onClick={() => setPanel(null)}
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="context-tabs">
            {(["files", "artifacts", "activity"] as const).map((p) => (
              <button
                className={panel === p ? "active" : ""}
                key={p}
                onClick={() => setPanel(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          {panel === "files" ? (
            <div className="context-body">
              {workspace ? (
                <>
                  <div className="folder-heading">
                    <Icon name="folder" />
                    <strong>{workspace.name}</strong>
                  </div>
                  <p className="context-description">{workspace.path}</p>
                  <p className="context-description">
                    Choose a file to read it and include its latest contents in
                    the conversation. The assistant can request other files when
                    needed.
                  </p>
                  {workspace.truncated && (
                    <Alert severity="info">
                      Folder index is limited to 2,000 files. Known relative
                      paths can still be requested.
                    </Alert>
                  )}
                  <div className="file-tree">
                    {workspace.tree.map((path) => (
                      <button
                        key={path}
                        className={paths.includes(path) ? "included" : ""}
                        onClick={() => void openFile(path)}
                      >
                        <Icon name="files" size={14} />
                        <span>{path}</span>
                        {paths.includes(path) && (
                          <Icon name="check" size={12} />
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      if (native && projectId)
                        void native.unlinkFolder(projectId).then(() => {
                          setWorkspace(null);
                          setPaths([]);
                        });
                    }}
                  >
                    Unlink folder
                  </button>
                </>
              ) : (
                <div className="empty-context">
                  <Icon name="folder" size={32} />
                  <h3>Work with your project</h3>
                  <p>
                    Link a local folder to read current files and review
                    proposed changes.
                  </p>
                  <button onClick={linkFolder}>Link folder</button>
                  {!native && (
                    <small>
                      Live folder access is available in the desktop app. Run
                      ./scripts/desktop.sh.
                    </small>
                  )}
                </div>
              )}
            </div>
          ) : panel === "artifacts" ? (
            <div className="context-body">
              {artifacts.length ? (
                artifacts.map((a, i) => (
                  <button
                    className="artifact-card"
                    key={i}
                    onClick={() => download(a)}
                  >
                    <Icon name="files" />
                    <span>
                      <strong>{a.name}</strong>
                      <small>Download</small>
                    </span>
                  </button>
                ))
              ) : (
                <p className="context-description">
                  Documents and other generated artefacts will appear here.
                </p>
              )}
              {thread && (
                <a
                  className="export-link"
                  href={"/api/assistant/threads/" + thread.id + "/export"}
                  download
                >
                  <Icon name="download" />
                  Export conversation
                </a>
              )}
            </div>
          ) : (
            <div className="context-body">
              {thread?.receipts.length ? (
                thread.receipts.map((r) => (
                  <details key={r.id} className="activity-item">
                    <summary>
                      {r.status} · {r.summary}
                    </summary>
                    <pre>{r.output}</pre>
                  </details>
                ))
              ) : (
                <p className="context-description">
                  Approved changes, command results and declined operations will
                  appear here.
                </p>
              )}
            </div>
          )}
        </aside>
      )}
      <Dialog
        open={settings}
        onClose={() => setSettings(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Model connection</DialogTitle>
        <DialogContent>
          <p className="settings-intro">
            Choose your assistant once. You can change it whenever you need.
          </p>
          <div className="settings-fields">
            <TextField
              select
              label="Provider"
              value={providers.length ? provider : ""}
              onChange={(e) => {
                setProvider(e.target.value);
                setModels([]);
                setModel("");
              }}
            >
              {providers.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Model ID"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Choose or enter an available model"
              inputProps={{ list: "model-options" }}
            />
            <datalist id="model-options">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <Button
              onClick={loadModels}
              disabled={!currentProvider?.configured}
            >
              Load available models
            </Button>
          </div>
          {currentProvider && !currentProvider.configured && (
            <Alert severity="info">
              {currentProvider.setup} Keys stay on the backend; they are never
              stored in the conversation.
            </Alert>
          )}
          {currentProvider?.id === "ollama" && (
            <Alert severity="info">
              Start Ollama and install a model first. Use a vision model for
              image attachments.
            </Alert>
          )}
          <label className="model-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                const checked = e.target.checked;
                void ensureProject()
                  .then((id) =>
                    setConsents((v) => ({
                      ...v,
                      [id + ":" + provider]: checked,
                    })),
                  )
                  .catch((e) => setError(e.message));
              }}
            />
            <span>
              {currentProvider?.external
                ? "Allow this provider to process messages, attached material, shared project files and approved command output for this project."
                : "Allow the configured local model server to process this project’s conversation and shared context."}
            </span>
          </label>
          <p className="settings-note">
            OpenAI/Claude use API credentials configured in the local .env. A
            consumer chat subscription is not an API key. See
            docs/CONVERSATIONAL_WORKSPACE.md.
          </p>
          <a href="/?legacy=1" className="legacy-link">
            Open the earlier structured workflow
          </a>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettings(false)}>Done</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={newProject}
        onClose={() => setNewProject(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Create a project</DialogTitle>
        <DialogContent>
          <p>
            Give your conversations a home. You can link a folder now or later.
          </p>
          <TextField
            autoFocus
            fullWidth
            label="Project name"
            placeholder="New project"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewProject(false)}>Cancel</Button>
          <Button onClick={() => void createProject(false)}>Create</Button>
          {native && (
            <Button
              variant="contained"
              onClick={() => void createProject(true)}
            >
              Create and link folder
            </Button>
          )}
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!fileView}
        onClose={() => setFileView(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>{fileView?.path}</DialogTitle>
        <DialogContent>
          <p className="settings-note">
            Current contents · Included in the next message’s context
          </p>
          <pre className="file-preview">{fileView?.text}</pre>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (fileView)
                setPaths((v) => v.filter((p) => p !== fileView.path));
              setFileView(null);
            }}
          >
            Remove from context
          </Button>
          <Button onClick={() => setFileView(null)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!citation}
        onClose={() => setCitation(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {citation?.clusterId} · {citationSource?.title || "Catalogue context"}
        </DialogTitle>
        <DialogContent>
          <p>{citationSource?.definition}</p>
          <p>{citation?.rationale}</p>
          <p className="settings-note">
            Source actions:{" "}
            {citation?.actionIds.join(", ") || "Cluster-level guidance"}
          </p>
          <p className="settings-note">
            The catalogue supports this reasoning; it does not certify
            compliance or correctness.
          </p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCitation(null)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!preview}
        onClose={() => !executing && setPreview(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          {preview?.value.kind === "write"
            ? "Review proposed file change"
            : "Review proposed command"}
        </DialogTitle>
        <DialogContent>
          {preview && (
            <>
              <p>{preview.operation.reason}</p>
              {preview.value.kind === "write" ? (
                <>
                  <strong>{preview.value.path}</strong>
                  <div className="change-preview">
                    <div>
                      <h4>Before</h4>
                      <pre>{preview.value.before || "(new file)"}</pre>
                    </div>
                    <div>
                      <h4>After</h4>
                      <pre>{preview.value.after}</pre>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <pre className="command-preview">
                    {preview.value.program} {JSON.stringify(preview.value.args)}
                    {"\n"}Working directory: {preview.value.cwd}
                  </pre>
                  <Alert severity="warning">
                    This command runs with your user permissions. It may access
                    resources outside the project and use the network. Output
                    can enter the conversation’s model context.
                  </Alert>
                  {liveOutput && (
                    <pre className="command-output">{liveOutput}</pre>
                  )}
                </>
              )}
              <p className="settings-note">
                The desktop app will ask for native confirmation of this exact
                operation. This permission applies once.
              </p>
            </>
          )}
        </DialogContent>
        <DialogActions>
          {executing ? (
            <Button
              onClick={() =>
                preview && native?.stopCommand(preview.value.ticket)
              }
            >
              Stop command
            </Button>
          ) : (
            <>
              <Button
                onClick={() =>
                  preview && void deny(preview.message, preview.operation)
                }
              >
                Decline
              </Button>
              <Button onClick={() => setPreview(null)}>Close</Button>
              <Button variant="contained" onClick={() => void approve()}>
                Request permission and{" "}
                {preview?.value.kind === "write" ? "apply" : "run"}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
      <Snackbar
        open={!!notice}
        message={notice}
        autoHideDuration={7000}
        onClose={() => setNotice("")}
      />
    </div>
  );
}
