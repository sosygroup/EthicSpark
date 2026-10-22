import {
  useEffect,
  memo,
  useCallback,
  useRef,
  useState,
  isValidElement,
  lazy,
  Suspense,
} from "react";
import type { ReactElement, MouseEvent } from "react";
import {
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Menu,
  Button,
  TextField,
} from "@mui/material";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  ModelPreparation,
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
import ArtifactView from "./ArtifactView";
import { downloadArtifact as download } from "./visual-utils";
import ModelLoadingGauge from "./ModelLoadingGauge";
import ModelThinkingSelector from "./ModelThinkingSelector";
import ResetDialog from "./ResetDialog";
import CompatibleProviderSettings from "./CompatibleProviderSettings";
import { clearSettingsPreferences } from "./reset-preferences";
import { thinkingRequest, readThinkingPreferences } from "./model-thinking";
import { ModuleLoadBoundary } from "./AppUpdateNotice";
import { explainIssue, reportIssue, reportNotice } from "./notification-store";
import { openNotifications } from "./NotificationCenter";
import { Info, HelpButton, HelpMuiButton } from "./Help";

const CatalogueExplorer = lazy(() => import("./CatalogueExplorer"));
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
    book: "M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1m0-15c3-2 7-2 10-1v15c-3-1-7-1-10 1Zm0 0v15",
    copy: "M9 3h12v14H9ZM3 7h3v14h12v-1",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    edit: "m4 16 11-11 4 4-11 11-5 1Zm9-9 4 4",
    trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
    open: "M3 7V5h6l2 2h10v6M3 7v12h8M14 15h7m-3-3 3 3-3 3",
    restore: "M4 5v6h6M4 11a8 8 0 1 1 1 7",
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
const RichText = memo(function RichText({
  text,
  artifacts = [],
}: {
  text: string;
  artifacts?: Artifact[];
}) {
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
          img: ({ src, alt }) => {
            const artifact = artifacts.find(
              (a) => a.name === src || "attachment:" + a.name === src,
            );
            return artifact ? (
              <span>{artifact.name} — preview below</span>
            ) : (
              <span>
                {alt || "Image"} (use a self-contained image artifact to preview
                here)
              </span>
            );
          },
          pre: ({ children }) => {
            const child = isValidElement(children)
              ? (children as ReactElement<{
                  className?: string;
                  children?: unknown;
                }>)
              : null;
            const code = String(child?.props.children || "");
            if (child?.props.className === "language-mermaid")
              return <Diagram code={code} />;
            if (child?.props.className === "language-svg")
              return (
                <ArtifactView
                  artifact={{
                    name: "figure.svg",
                    mediaType: "image/svg+xml",
                    content: code,
                  }}
                />
              );
            return (
              <div className="code-block">
                <pre>{children}</pre>
              </div>
            );
          },
          code: ({ children, className }) => (
            <code className={className}>{children}</code>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
});
export default function App() {
  const [projects, setProjects] = useState<Project[]>([]),
    [threads, setThreads] = useState<Summary[]>([]),
    [thread, setThread] = useState<Thread | null>(null),
    [projectId, setProjectId] = useState(
      localStorage.getItem("ethicspark-project") || "",
    );
  const [prompt, setPrompt] = useState(
      () => sessionStorage.getItem("ethicspark-reload-prompt") || "",
    ),
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
  const [resetOpen, setResetOpen] = useState(false);
  const [manualModel, setManualModel] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const modelListAbort = useRef<AbortController | null>(null);
  const [consents, setConsents] = useState<Record<string, boolean>>(() =>
      JSON.parse(localStorage.getItem("ethicspark-consents") || "{}"),
    ),
    [settings, setSettings] = useState(false),
    [newProject, setNewProject] = useState(false),
    [projectName, setProjectName] = useState("");
  useEffect(() => {
    if (!settings) return;
    let active = true;
    void api<Provider[]>("/api/reasoning/providers")
      .then((data) => {
        if (active) setProviders(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [settings]);
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
  const [projectMenu, setProjectMenu] = useState<{
    anchor: HTMLElement;
    project: Project;
  } | null>(null);
  const [menuFolder, setMenuFolder] = useState<Workspace | null>(null);
  const [projectDialog, setProjectDialog] = useState<{
    kind: "rename" | "delete";
    project: Project;
  } | null>(null);
  const [renameName, setRenameName] = useState("");
  const [managing, setManaging] = useState(false);
  const [preloadEnabled, setPreloadEnabled] = useState(
    () => localStorage.getItem("ethicspark-preload") !== "false",
  );
  const [retentionPreferences, setRetentionPreferences] = useState<
    Record<string, number>
  >(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("ethicspark-retention") || "{}",
      );
      return Object.fromEntries(
        Object.entries(saved).filter(
          ([key, value]) =>
            key.length <= 200 &&
            typeof value === "number" &&
            Number.isInteger(value) &&
            value >= 1 &&
            value <= 240,
        ),
      ) as Record<string, number>;
    } catch {
      return {};
    }
  });
  const [customRetention, setCustomRetention] = useState<
    Record<string, string>
  >({});
  const [thinkingPreferences, setThinkingPreferences] = useState<
    Record<string, string>
  >(() => {
    return readThinkingPreferences(localStorage.getItem("ethicspark-thinking"));
  });
  useEffect(() => {
    localStorage.setItem(
      "ethicspark-thinking",
      JSON.stringify(thinkingPreferences),
    );
  }, [thinkingPreferences]);
  const thinkingPreference = thinkingPreferences[model.trim()] || "auto";
  const retentionKey = model.trim();
  const retentionMinutes = retentionPreferences[retentionKey] ?? 30;
  const retentionDraft = customRetention[retentionKey];
  const retentionValid =
    retentionDraft === undefined ||
    (/^\d+$/.test(retentionDraft) &&
      Number(retentionDraft) >= 1 &&
      Number(retentionDraft) <= 240);
  const retentionChoice =
    retentionDraft !== undefined || ![5, 30, 60].includes(retentionMinutes)
      ? "custom"
      : String(retentionMinutes);
  const [unloading, setUnloading] = useState(false);
  const [unloadedModel, setUnloadedModel] = useState("");
  useEffect(() => {
    localStorage.setItem(
      "ethicspark-retention",
      JSON.stringify(retentionPreferences),
    );
  }, [retentionPreferences]);
  const [warmup, setWarmup] = useState<{
    model: string;
    status: "preparing" | "ready" | "error";
    startedAt: number;
    data?: ModelPreparation;
    error?: string;
  } | null>(null);
  const warmupRef = useRef<{
    model: string;
    minutes: number;
    promise: Promise<ModelPreparation>;
    until: number;
  } | null>(null);
  const prepareModel = useCallback(
    (force = false) => {
      const selected = model.trim();
      const old = warmupRef.current;
      if (!retentionValid)
        return Promise.reject(
          Error("Choose a duration from 1 to 240 minutes."),
        );
      if (
        old?.model === selected &&
        old.minutes === retentionMinutes &&
        old.until > Date.now() &&
        !force
      )
        return old.promise;
      setUnloadedModel("");
      const startedAt = performance.now();
      setWarmup({ model: selected, status: "preparing", startedAt });
      const entry = {
        model: selected,
        minutes: retentionMinutes,
        promise: null as unknown as Promise<ModelPreparation>,
        until: Infinity,
      };
      const promise = api<ModelPreparation>(
        "/api/reasoning/providers/ollama/prepare",
        { model: selected, keepAliveMinutes: retentionMinutes },
      )
        .then((data) => {
          entry.until = Date.now() + data.keepAliveMinutes * 60000;
          if (warmupRef.current === entry)
            setWarmup({ model: selected, status: "ready", data, startedAt });
          return data;
        })
        .catch((e) => {
          entry.until = 0;
          if (warmupRef.current === entry)
            setWarmup({
              model: selected,
              status: "error",
              error: e.message,
              startedAt,
            });
          throw e;
        });
      entry.promise = promise;
      warmupRef.current = entry;
      return promise;
    },
    [model, retentionMinutes, retentionValid],
  );
  useEffect(() => {
    localStorage.setItem("ethicspark-preload", String(preloadEnabled));
    if (
      provider !== "ollama" ||
      !model.trim() ||
      !preloadEnabled ||
      !retentionValid ||
      unloadedModel === model.trim() ||
      unloading ||
      loading ||
      busy
    )
      return;
    const timer = setTimeout(() => {
      void prepareModel().catch(() => undefined);
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    provider,
    model,
    preloadEnabled,
    loading,
    busy,
    prepareModel,
    retentionValid,
    unloadedModel,
    unloading,
  ]);
  async function unloadModel() {
    const selected = model.trim();
    setUnloading(true);
    try {
      await api("/api/reasoning/providers/ollama/unload", { model: selected });
      warmupRef.current = null;
      setWarmup(null);
      setUnloadedModel(selected);
      setNotice(
        "Model unloaded. It will load again when you prepare it or send a message.",
      );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setUnloading(false);
    }
  }
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashed, setTrashed] = useState<Project[]>([]);
  const abort = useRef<AbortController | null>(null),
    end = useRef<HTMLDivElement | null>(null),
    fileInput = useRef<HTMLInputElement | null>(null),
    composer = useRef<HTMLTextAreaElement | null>(null);
  const project = projects.find((p) => p.id === projectId),
    currentProvider = providers.find((p) => p.id === provider);
  const consentKey =
      projectId +
      ":" +
      provider +
      (provider === "compatible"
        ? ":" + (currentProvider?.connectionId || "")
        : ""),
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
        } else if (
          data.ps.length === 1 &&
          data.ts.length === 1 &&
          data.ps[0].name === "Demo — fictional support portal" &&
          data.ts[0].projectId === data.ps[0].id
        ) {
          const demo = await api<Thread>(
            "/api/assistant/threads/" + data.ts[0].id,
          );
          if (active) {
            setThread(demo);
            setProjectId(demo.projectId);
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
    if (
      thread?.messages.length === 12 &&
      thread.messages[0]?.provider === "demo"
    ) {
      document
        .getElementById("message-" + thread.messages[0].id)
        ?.scrollIntoView({ behavior: "instant", block: "start" });
    } else end.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.id, thread?.messages.length, thread?.messages.at(-1)?.status]);
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
  useEffect(() => {
    sessionStorage.removeItem("ethicspark-reload-prompt");
  }, []);
  useEffect(() => {
    const prepareReload = (event: Event) => {
      if (busy || executing) {
        event.preventDefault();
        return;
      }
      sessionStorage.setItem("ethicspark-reload-prompt", prompt);
    };
    window.addEventListener("ethicspark:before-reload", prepareReload);
    return () =>
      window.removeEventListener("ethicspark:before-reload", prepareReload);
  }, [prompt, busy, executing]);
  const reportedMessageErrors = useRef(new Set<string>());
  useEffect(() => {
    if (error) reportIssue(error, "Workspace");
  }, [error]);
  useEffect(() => {
    if (notice) {
      reportIssue(notice, "Workspace", "info");
      setNotice("");
    }
  }, [notice]);
  useEffect(() => {
    for (const message of thread?.messages || [])
      if (
        message.status === "error" &&
        !reportedMessageErrors.current.has(message.id)
      ) {
        reportedMessageErrors.current.add(message.id);
        const issue = {
          ...explainIssue(message.text, message.provider || "Model"),
          key: "response:" + message.id,
        };
        reportNotice(issue);
      }
  }, [thread]);
  useEffect(() => {
    if (warmup?.status === "error")
      reportIssue(
        warmup.error || "Model preparation failed",
        "Ollama preparation",
        "warning",
      );
  }, [warmup]);
  const [loadingDemo, setLoadingDemo] = useState(false);
  async function loadDemo() {
    setLoadingDemo(true);
    setError("");
    try {
      const t = await api<Thread>("/api/assistant/projects/demo", {});
      setProjectId(t.projectId);
      setThread(t);
      setAttached([]);
      setPrompt("");
      setNewProject(false);
      await refresh();
      setNotice(
        "Offline demo opened. Its six stages are authored examples, not live model responses.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingDemo(false);
    }
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
  async function openProjectMenu(
    event: MouseEvent<HTMLButtonElement>,
    p: Project,
  ) {
    setProjectMenu({ anchor: event.currentTarget, project: p });
    setMenuFolder(null);
    if (native) {
      try {
        const folder = await native.workspace(p.id);
        setMenuFolder(folder);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }
  async function showTrash() {
    setError("");
    try {
      setTrashed(await api<Project[]>("/api/assistant/projects/trash"));
      setTrashOpen(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function restoreProject(p: Project) {
    setManaging(true);
    try {
      await api<Project>("/api/assistant/projects/" + p.id + "/restore", {});
      setTrashed(await api<Project[]>("/api/assistant/projects/trash"));
      await refresh();
      setNotice("Project restored. Link its local folder again if needed.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setManaging(false);
    }
  }
  async function saveProjectChange() {
    if (!projectDialog || managing) return;
    setManaging(true);
    setError("");
    const { kind, project: p } = projectDialog;
    try {
      if (kind === "rename") {
        await api<Project>("/api/assistant/projects/" + p.id + "/rename", {
          name: renameName.trim(),
        });
        setNotice("Project renamed.");
      } else {
        await api("/api/assistant/projects/" + p.id + "/trash", {});
        let unlinkFailed = false;
        try {
          await native?.unlinkFolder(p.id);
        } catch {
          unlinkFailed = true;
        }
        if (p.id === projectId) {
          setProjectId("");
          setThread(null);
          setAttached([]);
          setPrompt("");
          setWorkspace(null);
          setPaths([]);
          setPreview(null);
          setFileView(null);
          setPanel(null);
          localStorage.removeItem("ethicspark-thread");
        }
        localStorage.removeItem("ethicspark-files-" + p.id);
        setConsents((v) =>
          Object.fromEntries(
            Object.entries(v).filter(([key]) => !key.startsWith(p.id + ":")),
          ),
        );
        setNotice(
          unlinkFailed
            ? "Project moved to trash. Its desktop folder link could not be cleared; no files were deleted."
            : "Project moved to trash. Your local files are unchanged.",
        );
      }
      await refresh();
      setProjectDialog(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setManaging(false);
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
    if (busy || uploading || executing || unloading) return;
    if (provider === "ollama" && !retentionValid) {
      setSettings(true);
      return;
    }
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
      if (provider === "ollama" && preloadEnabled) {
        setActivity(
          "Preparing Ollama model… No project content is sent during preparation.",
        );
        await prepareModel().catch(() => undefined);
        if (abort.current?.signal.aborted) return;
      }
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
            : provider === "ollama"
              ? "Waiting for Ollama: processing context and generating a response. This may take several minutes…"
              : "Thinking through your request…",
        );
        const body = {
          revision: current!.revision,
          requestKey: crypto.randomUUID(),
          text: round ? "Continue using the requested file contents." : text,
          provider,
          model,
          consent: true,
          providerConnectionId:
            provider === "compatible"
              ? currentProvider?.connectionId
              : undefined,
          ollamaThinking:
            provider === "ollama"
              ? thinkingRequest(thinkingPreference)
              : undefined,
          keepAliveMinutes: provider === "ollama" ? retentionMinutes : null,
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
  useEffect(() => {
    if (!settings) setModelsOpen(false);
    return () => modelListAbort.current?.abort();
  }, [provider, settings]);
  async function loadModels() {
    const controller = new AbortController();
    modelListAbort.current?.abort();
    modelListAbort.current = controller;
    setError("");
    setLoadingModels(true);
    try {
      const ids = await api<string[]>(
        "/api/reasoning/providers/" + provider + "/models",
        undefined,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setModels(ids);
      setManualModel(false);
      if (!ids.includes(model)) setModel("");
      if (ids.length) setModelsOpen(true);
      else
        setNotice(
          "No models were returned. Install an Ollama model or check provider configuration.",
        );
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (modelListAbort.current === controller) setLoadingModels(false);
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
    let lease: string | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    try {
      const activity = await api<{ id: string }>(
        "/api/assistant/maintenance/operations",
        { projectId: thread?.projectId },
      );
      lease = activity.id;
      heartbeat = setInterval(() => {
        void api(
          "/api/assistant/maintenance/operations/" + activity.id + "/renew",
          {},
        ).catch(() => {
          void native.stopCommand(preview.value.ticket);
        });
      }, 15000);
      const result = await native.approveOperation(
        preview.value.ticket,
        activity.id,
      );
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
      if (heartbeat) clearInterval(heartbeat);
      if (lease)
        await fetch("/api/assistant/maintenance/operations/" + lease, {
          method: "DELETE",
        }).catch(() => {});
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
        <HelpButton
          help="conversation"
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
        </HelpButton>
        <button
          className="side-new catalogue-launch"
          onClick={() => {
            setCatalogueOpen(true);
            setSidebar(false);
          }}
        >
          <Icon name="book" />
          Explore catalogue
        </button>
        <div className="side-heading">
          <span>
            Projects <Info topic="projects" />
          </span>
          <HelpButton
            help="projects"
            title="New project"
            aria-label="New project"
            onClick={() => setNewProject(true)}
          >
            <Icon name="plus" size={16} />
          </HelpButton>
        </div>
        <div className="project-list">
          {projects.map((p) => (
            <div key={p.id}>
              <div className="project-row-shell">
                <HelpButton
                  help="project"
                  className={
                    "project-row " + (p.id === projectId ? "selected" : "")
                  }
                  onClick={() => void chooseProject(p.id)}
                >
                  <Icon name="folder" />
                  <span>{p.name}</span>
                </HelpButton>
                <button
                  type="button"
                  className="project-menu-button"
                  aria-label={"Project menu: " + p.name}
                  title="Project menu"
                  aria-haspopup="menu"
                  aria-expanded={projectMenu?.project.id === p.id}
                  onClick={(e) => void openProjectMenu(e, p)}
                >
                  <Icon name="more" />
                </button>
              </div>
              {p.id === projectId && (
                <div className="thread-list">
                  {threads
                    .filter((t) => t.projectId === p.id)
                    .map((t) => (
                      <HelpButton
                        help="thread"
                        key={t.id}
                        className={thread?.id === t.id ? "active" : ""}
                        onClick={() => void chooseThread(t.id)}
                      >
                        {t.title}
                      </HelpButton>
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
          <button type="button" onClick={() => void showTrash()}>
            <Icon name="trash" /> Trash
          </button>
          <HelpButton help="settings" onClick={() => setSettings(true)}>
            <Icon name="gear" />
            Model settings
          </HelpButton>
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
            <HelpButton
              help="sidebar"
              className="icon-button mobile-menu"
              aria-label="Toggle sidebar"
              onClick={() => setSidebar((v) => !v)}
            >
              <Icon name="menu" />
            </HelpButton>
            <span className="project-breadcrumb">
              {project?.name || "Your workspace"}
            </span>
            <span className="header-divider">/</span>
            <span className="conversation-title">
              {thread?.title || "New conversation"}
            </span>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button"
              aria-label="Explore catalogue"
              title="Explore catalogue"
              onClick={() => setCatalogueOpen(true)}
            >
              <Icon name="book" />
            </button>
            <Info topic="start" />
            <HelpButton
              help="settings"
              className="model-pill"
              onClick={() => setSettings(true)}
            >
              {model || "Connect a model"}
              <span>⌄</span>
            </HelpButton>
            <HelpButton
              help="context"
              className="icon-button"
              title="Project context"
              aria-label="Project context"
              onClick={() => setPanel(panel ? null : "files")}
            >
              <Icon name="files" />
            </HelpButton>
          </div>
        </header>
        <div
          className={
            "environment-banner " + (native ? "desktop-mode" : "browser-mode")
          }
          role="note"
        >
          <Icon name={native ? "shield" : "files"} size={18} />
          <div>
            <strong>{native ? "Desktop mode" : "Browser mode"}</strong>
            {native ? (
              <span>
                {" "}
                Link a local folder to work with current files. File edits and
                commands require your approval.
              </span>
            ) : (
              <span>
                {" "}
                Chat, attachments and downloads work here. Live project folders,
                file edits and commands require the desktop app. From the
                EthicSpark project folder, run <code>
                  ./scripts/desktop.sh
                </code>{" "}
                with Docker running.
              </span>
            )}
          </div>
          {!native && (
            <button
              type="button"
              className="launch-copy"
              title="Copy desktop launch command"
              aria-label="Copy desktop launch command"
              onClick={() =>
                void navigator.clipboard
                  .writeText("./scripts/desktop.sh")
                  .then(() => setNotice("Desktop launch command copied."))
                  .catch(() =>
                    setNotice("Copy this command: ./scripts/desktop.sh"),
                  )
              }
            >
              <Icon name="copy" size={16} />
              <span>Copy command</span>
            </button>
          )}
          <Info topic="start" />
        </div>
        {thread?.messages[0]?.provider === "demo" && (
          <nav className="demo-stage-nav" aria-label="Demo development stages">
            <span>Offline demo</span>
            {[
              "Requirements",
              "Design",
              "Implementation",
              "Testing",
              "Deployment",
              "Operations",
            ].map((stage, index) => (
              <button
                type="button"
                key={stage}
                onClick={() =>
                  document
                    .getElementById("message-" + thread.messages[index * 2]?.id)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                {index + 1}. {stage}
              </button>
            ))}
          </nav>
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
              <div className="help-start">
                Start here: how to use EthicSpark <Info topic="start" />
              </div>
              <p>
                Ask a question, share a document, or work with your project.
                <br />
                Start where you are. We’ll work through the details together.
              </p>
              <Button onClick={() => setCatalogueOpen(true)}>
                Explore catalogue without a model
              </Button>
              <div className="starter-grid">
                {[
                  [
                    "Try a fictional example",
                    "Review a fictional customer-support portal that stores customer email addresses and ticket text. Suggest a small architecture, three useful tests, and relevant ethical considerations from the catalogue. Keep the answer concise. Do not request real customer data or propose file edits or commands.",
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
                  <HelpButton
                    help="starter"
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
                  </HelpButton>
                ))}
              </div>
              {!projectId && (
                <HelpButton
                  help="folder"
                  className="welcome-link"
                  onClick={linkFolder}
                >
                  <Icon name="folder" />
                  Link a project folder <span>optional</span>
                </HelpButton>
              )}
            </div>
          ) : (
            <div className="messages">
              {visibleMessages.map((m) => (
                <article
                  key={m.id}
                  id={"message-" + m.id}
                  className={"message message-" + m.role}
                >
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
                            {activity ||
                              (m.provider === "ollama"
                                ? "Waiting for Ollama: loading if needed, processing context and generating a response…"
                                : "Working on your request…")}
                          </div>
                        ) : m.status === "error" ? (
                          <div className="response-error">
                            <strong>Response unavailable</strong>
                            <Button onClick={openNotifications}>
                              Details in Notifications
                            </Button>
                            <HelpButton
                              help="retry"
                              onClick={() => void send(true)}
                            >
                              Retry with saved context
                            </HelpButton>
                          </div>
                        ) : (
                          <RichText
                            text={m.text}
                            artifacts={m.output?.artifacts}
                          />
                        )}
                        {m.output?.citations.length ? (
                          <div className="catalogue-citations">
                            <span>
                              <Icon name="shield" size={13} />
                              Catalogue context
                            </span>
                            {m.output.citations.map((c, i) => (
                              <HelpButton
                                help="citations"
                                key={i}
                                onClick={() => void inspectCitation(c)}
                              >
                                {c.clusterId}
                                {c.actionIds.length
                                  ? " · " + c.actionIds.join(", ")
                                  : ""}
                              </HelpButton>
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
                                  <HelpButton
                                    help="review"
                                    disabled={!native || busy || executing}
                                    onClick={() => void prepare(m, op)}
                                  >
                                    Review{" "}
                                    {op.kind === "write" ? "change" : "command"}
                                  </HelpButton>
                                  <HelpButton
                                    help="decline"
                                    disabled={busy || executing}
                                    onClick={() => void deny(m, op)}
                                  >
                                    Decline
                                  </HelpButton>
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
                          <ArtifactView key={i} artifact={a} />
                        ))}
                        {m.status === "complete" && m.metrics && (
                          <details className="response-timing">
                            <summary>
                              Response timing <Info topic="modelPerformance" />
                            </summary>
                            <dl>
                              {[
                                [
                                  "Context preparation",
                                  m.metrics.contextPreparationSeconds,
                                  "s",
                                ],
                                [
                                  "Model request (wall time)",
                                  m.metrics.requestSeconds,
                                  "s",
                                ],
                                ["Model loading", m.metrics.loadSeconds, "s"],
                                [
                                  "Prompt processing",
                                  m.metrics.promptSeconds,
                                  "s",
                                ],
                                [
                                  "Response generation",
                                  m.metrics.generationSeconds,
                                  "s",
                                ],
                                [
                                  "Input tokens",
                                  m.metrics.inputTokens,
                                  "tokens",
                                ],
                                [
                                  "Generated tokens",
                                  m.metrics.outputTokens,
                                  "tokens",
                                ],
                                [
                                  "Generation rate",
                                  m.metrics.tokensPerSecond,
                                  "tokens/s",
                                ],
                              ].map(([name, value, unit]) => (
                                <div key={String(name)}>
                                  <dt>{name}</dt>
                                  <dd>
                                    {typeof value === "number"
                                      ? `${unit === "tokens" ? value.toLocaleString() : value.toFixed(2)} ${unit}`
                                      : "Not reported"}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </details>
                        )}
                        {m.status === "complete" && (
                          <div className="response-meta">
                            {m.model}
                            <HelpButton
                              help="copy"
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
                            </HelpButton>
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
                <HelpButton help="files" onClick={() => setPanel("files")}>
                  {workspace.name}
                </HelpButton>
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
                    <HelpButton
                      help="removeAttachment"
                      aria-label={"Remove " + a.name}
                      onClick={() =>
                        setAttached((v) => v.filter((f) => f.id !== a.id))
                      }
                    >
                      ×
                    </HelpButton>
                  </div>
                ))}
              </div>
            )}
            <div className="help-field-heading">
              Your message <Info topic="prompt" />
            </div>
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
                  <HelpButton
                    help="attach"
                    className="icon-button"
                    title="Attach files"
                    aria-label="Attach files"
                    disabled={busy || uploading}
                    onClick={() => fileInput.current?.click()}
                  >
                    <Icon name="attach" />
                  </HelpButton>
                  <HelpButton
                    help="folder"
                    className="icon-button"
                    title="Link a folder"
                    aria-label="Link a folder"
                    disabled={busy || executing}
                    onClick={linkFolder}
                  >
                    <Icon name="folder" />
                  </HelpButton>
                  {uploading && (
                    <span className="composer-status">Uploading…</span>
                  )}
                  {busy && <span className="composer-status">{activity}</span>}
                </div>
                {busy || pending ? (
                  <HelpButton
                    help="stop"
                    className="send-button stop-button"
                    aria-label="Stop response"
                    onClick={() => void stop()}
                  >
                    <Icon name="stop" />
                  </HelpButton>
                ) : (
                  <HelpButton
                    help="send"
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
                  </HelpButton>
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
                <HelpButton
                  help="continue"
                  onClick={() => void send(true)}
                  disabled={busy || executing}
                >
                  Continue task
                </HelpButton>
              )}
            </div>
          </div>
        </div>
      </section>
      {panel && (
        <aside className="context-panel">
          <div className="context-header">
            <strong className="help-section-title">
              Project context <Info topic="context" />
            </strong>
            <HelpButton
              help="close"
              className="icon-button"
              aria-label="Close context"
              onClick={() => setPanel(null)}
            >
              <Icon name="close" />
            </HelpButton>
          </div>
          <div className="context-tabs">
            {(["files", "artifacts", "activity"] as const).map((p) => (
              <HelpButton
                help={p}
                className={panel === p ? "active" : ""}
                key={p}
                onClick={() => setPanel(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </HelpButton>
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
                      <HelpButton
                        help="file"
                        key={path}
                        className={paths.includes(path) ? "included" : ""}
                        onClick={() => void openFile(path)}
                      >
                        <Icon name="files" size={14} />
                        <span>{path}</span>
                        {paths.includes(path) && (
                          <Icon name="check" size={12} />
                        )}
                      </HelpButton>
                    ))}
                  </div>
                  <HelpButton
                    help="unlink"
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
                  </HelpButton>
                </>
              ) : (
                <div className="empty-context">
                  <Icon name="folder" size={32} />
                  <h3>Work with your project</h3>
                  <p>
                    Link a local folder to read current files and review
                    proposed changes.
                  </p>
                  <HelpButton help="folder" onClick={linkFolder}>
                    Link folder
                  </HelpButton>
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
                  <HelpButton
                    help="download"
                    className="artifact-card"
                    key={i}
                    onClick={() => download(a)}
                  >
                    <Icon name="files" />
                    <span>
                      <strong>{a.name}</strong>
                      <small>Download</small>
                    </span>
                  </HelpButton>
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
              {thread && <Info topic="export" />}
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
      {catalogueOpen && (
        <Dialog
          open
          fullScreen
          aria-labelledby="catalogue-explorer-title"
          onClose={() => setCatalogueOpen(false)}
        >
          <ModuleLoadBoundary
            fallback={
              <div style={{ padding: 24 }}>
                <Button onClick={openNotifications}>
                  Catalogue view unavailable · open Notifications
                </Button>
                <Button onClick={() => setCatalogueOpen(false)}>
                  Close catalogue
                </Button>
              </div>
            }
          >
            <Suspense fallback={<p>Loading catalogue explorer…</p>}>
              <CatalogueExplorer onClose={() => setCatalogueOpen(false)} />
            </Suspense>
          </ModuleLoadBoundary>
        </Dialog>
      )}
      <Menu
        anchorEl={projectMenu?.anchor}
        open={!!projectMenu}
        onClose={() => setProjectMenu(null)}
      >
        <MenuItem
          disabled={busy || executing || uploading || managing}
          onClick={() => {
            if (projectMenu) {
              setError("");
              setRenameName(projectMenu.project.name);
              setProjectDialog({
                kind: "rename",
                project: projectMenu.project,
              });
            }
            setProjectMenu(null);
          }}
        >
          <Icon name="edit" />{" "}
          <span className="project-menu-label">Rename project</span>
        </MenuItem>
        <MenuItem
          disabled={!native?.openFolder || !menuFolder}
          onClick={() => {
            const p = projectMenu?.project;
            setProjectMenu(null);
            if (p && native)
              void native.openFolder(p.id).catch((e) => setError(e.message));
          }}
        >
          <Icon name="open" />
          <span className="project-menu-label">
            Open folder
            {!native ? (
              <small>Desktop app only</small>
            ) : !menuFolder ? (
              <small>No linked folder</small>
            ) : null}
          </span>
        </MenuItem>
        <MenuItem
          disabled={busy || executing || uploading || managing}
          onClick={() => {
            setError("");
            if (projectMenu)
              setProjectDialog({
                kind: "delete",
                project: projectMenu.project,
              });
            setProjectMenu(null);
          }}
          sx={{ color: "error.main" }}
        >
          <Icon name="trash" />
          <span className="project-menu-label">Delete project</span>
        </MenuItem>
      </Menu>
      {projectDialog && (
        <Dialog
          open={!!projectDialog}
          onClose={() => !managing && setProjectDialog(null)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>
            {projectDialog?.kind === "rename"
              ? "Rename project"
              : "Delete project?"}
          </DialogTitle>
          <DialogContent>
            {projectDialog?.kind === "rename" ? (
              <TextField
                autoFocus
                margin="dense"
                fullWidth
                label="Project name"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                slotProps={{ htmlInput: { maxLength: 160 } }}
                disabled={managing}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && renameName.trim()) {
                    e.preventDefault();
                    void saveProjectChange();
                  }
                }}
              />
            ) : (
              <>
                <p>
                  <strong>{projectDialog?.project.name}</strong> and its
                  conversations will move to Trash. You can restore them later.
                </p>
                <p>
                  Saved attachments, artifacts and operation history are
                  retained. This does not permanently erase project data.
                </p>
                <p>
                  The local folder will be unlinked. Its files will not be
                  changed or deleted.
                </p>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button disabled={managing} onClick={() => setProjectDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color={projectDialog?.kind === "delete" ? "error" : "primary"}
              disabled={
                managing ||
                busy ||
                executing ||
                uploading ||
                (projectDialog?.kind === "rename" && !renameName.trim())
              }
              onClick={() => void saveProjectChange()}
            >
              {managing
                ? "Saving…"
                : projectDialog?.kind === "rename"
                  ? "Save name"
                  : "Move to trash"}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      <Dialog
        open={trashOpen}
        onClose={() => !managing && setTrashOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Trash</DialogTitle>
        <DialogContent>
          <p>
            Deleted projects are kept here with their conversations and saved
            material. Restoring a project does not reconnect its local folder
            automatically.
          </p>
          {trashed.length ? (
            trashed.map((p) => (
              <div className="trash-project-row" key={p.id}>
                <span>{p.name}</span>
                <Button
                  startIcon={<Icon name="restore" />}
                  disabled={managing}
                  onClick={() => void restoreProject(p)}
                >
                  Restore
                </Button>
              </div>
            ))
          ) : (
            <p>Trash is empty.</p>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTrashOpen(false)} disabled={managing}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <ResetDialog
        open={resetOpen}
        blocked={
          busy ||
          executing ||
          uploading ||
          managing ||
          unloading ||
          loadingModels ||
          warmup?.status === "preparing"
        }
        onClose={() => setResetOpen(false)}
        onResetSettings={() => {
          clearSettingsPreferences(localStorage);
          setProvider("openai");
          setModel("");
          setModels([]);
          setManualModel(false);
          setModelsOpen(false);
          setConsents({});
          setRetentionPreferences({});
          setCustomRetention({});
          setThinkingPreferences({});
          setPreloadEnabled(true);
          warmupRef.current = null;
          setWarmup(null);
          setUnloadedModel("");
        }}
      />
      <Dialog
        open={settings}
        onClose={() => setSettings(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          <span className="help-section-title">
            Model connection <Info topic="settings" />
          </span>
        </DialogTitle>
        <DialogContent>
          <p className="settings-intro">
            Choose your assistant once. You can change it whenever you need.
          </p>
          <div className="settings-fields">
            <TextField
              select
              label="Provider"
              disabled={unloading || loadingModels}
              helperText={<Info topic="provider" />}
              value={providers.length ? provider : ""}
              onChange={(e) => {
                setProvider(e.target.value);
                setModels([]);
                setManualModel(false);
                setModelsOpen(false);
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
              select={!manualModel}
              label={manualModel ? "Model ID" : "Model"}
              disabled={unloading || loadingModels}
              helperText={<Info topic="model" />}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={manualModel ? "Enter an exact model ID" : undefined}
              slotProps={{
                inputLabel: !manualModel ? { shrink: true } : undefined,
                select: {
                  displayEmpty: true,
                  open: modelsOpen && settings,
                  onOpen: () => setModelsOpen(true),
                  onClose: () => setModelsOpen(false),
                },
              }}
            >
              {!manualModel && [
                <MenuItem key="empty" value="" disabled>
                  {models.length
                    ? "Choose a model"
                    : "Load available models first"}
                </MenuItem>,
                ...[
                  ...(model && !models.includes(model) ? [model] : []),
                  ...models,
                ].map((id) => (
                  <MenuItem key={id} value={id}>
                    {id}
                  </MenuItem>
                )),
              ]}
            </TextField>
            <HelpMuiButton
              help="loadModels"
              onClick={loadModels}
              disabled={
                !currentProvider?.configured || loadingModels || unloading
              }
            >
              {loadingModels ? "Loading models…" : "Load available models"}
            </HelpMuiButton>
            <Button
              disabled={unloading || loadingModels}
              onClick={() => {
                setManualModel((v) => !v);
                setModelsOpen(false);
              }}
            >
              {manualModel ? "Use model list" : "Enter model ID manually"}
            </Button>
          </div>
          {provider === "compatible" && (
            <CompatibleProviderSettings
              disabled={
                busy || executing || uploading || unloading || loadingModels
              }
              onSaved={async () => {
                const updated = await api<Provider[]>(
                  "/api/reasoning/providers",
                );
                setProviders(updated);
                setModels([]);
                setModel("");
                setModelsOpen(false);
              }}
            />
          )}
          {currentProvider && !currentProvider.configured && (
            <Alert severity="info">
              {currentProvider.setup} Keys stay on the backend; they are never
              stored in the conversation.
            </Alert>
          )}
          {currentProvider?.id === "ollama" && (
            <>
              <ModelThinkingSelector
                model={model}
                value={thinkingPreference}
                disabled={busy || unloading}
                onChange={(choice) =>
                  setThinkingPreferences((old) => ({
                    ...old,
                    [model.trim()]: choice,
                  }))
                }
              />
              <Alert severity="info">
                Start Ollama and install a model first. Use a vision model for
                image attachments. Preparation sends only the model ID; project
                content is sent when you submit a message.
              </Alert>
              <div className="settings-fields">
                <TextField
                  select
                  label="Keep model in memory after use"
                  value={retentionChoice}
                  disabled={
                    !retentionKey ||
                    busy ||
                    unloading ||
                    warmup?.status === "preparing"
                  }
                  onChange={(e) => {
                    const choice = e.target.value;
                    if (choice === "custom")
                      setCustomRetention((old) => ({
                        ...old,
                        [retentionKey]: String(retentionMinutes),
                      }));
                    else {
                      setRetentionPreferences((old) => ({
                        ...old,
                        [retentionKey]: Number(choice),
                      }));
                      setCustomRetention((old) => {
                        const next = { ...old };
                        delete next[retentionKey];
                        return next;
                      });
                    }
                  }}
                >
                  <MenuItem value="5">5 minutes</MenuItem>
                  <MenuItem value="30">30 minutes (default)</MenuItem>
                  <MenuItem value="60">60 minutes</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </TextField>
                {retentionChoice === "custom" && (
                  <TextField
                    label="Custom duration (minutes)"
                    type="number"
                    value={retentionDraft ?? retentionMinutes}
                    error={!retentionValid}
                    helperText="Enter a whole number from 1 to 240."
                    disabled={
                      busy || unloading || warmup?.status === "preparing"
                    }
                    slotProps={{ htmlInput: { min: 1, max: 240, step: 1 } }}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCustomRetention((old) => ({
                        ...old,
                        [retentionKey]: value,
                      }));
                      if (
                        /^\d+$/.test(value) &&
                        Number(value) >= 1 &&
                        Number(value) <= 240
                      )
                        setRetentionPreferences((old) => ({
                          ...old,
                          [retentionKey]: Number(value),
                        }));
                    }}
                  />
                )}
              </div>
              <p className="settings-note">
                Remembered for this model in this browser or desktop app. The
                timer restarts after each use. Keeping a model loaded occupies
                memory; Ollama may unload it earlier if resources change.
              </p>
              <label className="model-consent">
                <input
                  type="checkbox"
                  checked={preloadEnabled}
                  onChange={(e) => setPreloadEnabled(e.target.checked)}
                />
                <span>
                  Preload the selected Ollama model{" "}
                  <Info topic="modelPerformance" />
                </span>
              </label>
              <Button
                disabled={
                  !model.trim() ||
                  !retentionValid ||
                  unloading ||
                  warmup?.status === "preparing" ||
                  busy
                }
                onClick={() => void prepareModel(true).catch(() => undefined)}
              >
                Prepare model now
              </Button>
              <Button
                disabled={
                  !model.trim() ||
                  unloading ||
                  warmup?.status === "preparing" ||
                  busy
                }
                onClick={() => void unloadModel()}
              >
                {unloading ? "Unloading model…" : "Unload model now"}
              </Button>
              {unloadedModel && unloadedModel === model.trim() && (
                <Alert severity="info">
                  Model unloaded. Automatic preparation is paused for this model
                  until you prepare it or send a message. Reopening the app
                  re-enables automatic preparation if selected.
                </Alert>
              )}
              {warmup?.model === model.trim() &&
                (warmup.status === "preparing" ? (
                  <ModelLoadingGauge
                    startedAt={warmup.startedAt}
                    model={warmup.model}
                  />
                ) : warmup.status === "error" ? (
                  <Button onClick={openNotifications}>
                    Preparation unavailable · open Notifications
                  </Button>
                ) : (
                  <Alert severity="success" role="status">
                    {`Model preparation completed in ${warmup.data!.requestSeconds.toFixed(1)} s. Ollama will be asked to retain it for ${warmup.data!.keepAliveMinutes} minutes after each use. Other clients and memory pressure can affect availability.`}
                  </Alert>
                ))}
            </>
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
          <div className="help-field-heading">
            About processing permission <Info topic="consent" />
          </div>
          <p className="settings-note">
            OpenAI/Claude use API credentials configured in the local .env.
            OpenAI-compatible connections can be configured above. A consumer
            chat subscription is not an API key. See
            docs/CONVERSATIONAL_WORKSPACE.md.
          </p>
          <a href="/?legacy=1" className="legacy-link">
            Open the earlier structured workflow
          </a>{" "}
          <Info topic="legacy" />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setSettings(false);
              setResetOpen(true);
            }}
          >
            Reset…
          </Button>
          <HelpMuiButton help="close" onClick={() => setSettings(false)}>
            Done
          </HelpMuiButton>
        </DialogActions>
      </Dialog>
      <Dialog
        open={newProject}
        onClose={() => {
          if (!loadingDemo) setNewProject(false);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          <span className="help-section-title">
            Create a project <Info topic="projects" />
          </span>
        </DialogTitle>
        <DialogContent>
          <div className="demo-project-choice">
            <strong>Load or restore the demo project</strong>
            <p>
              Follow a fictional support portal from Requirements to Operations,
              with diagrams and downloadable artifacts. No model or API key
              needed. If deleted, the demo is restored; existing conversations
              are kept.
            </p>
            <Button
              disabled={loadingDemo || busy || !!executing}
              startIcon={<Icon name="restore" />}
              onClick={() => void loadDemo()}
            >
              {loadingDemo ? "Opening demo…" : "Load demo project"}
            </Button>
          </div>
          <p>
            Give your conversations a home. You can link a folder now or later.
          </p>
          <TextField
            autoFocus
            fullWidth
            label="Project name"
            helperText={<Info topic="projectName" />}
            placeholder="New project"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <HelpMuiButton
            help="cancel"
            disabled={loadingDemo}
            onClick={() => setNewProject(false)}
          >
            Cancel
          </HelpMuiButton>
          <HelpMuiButton
            help="create"
            disabled={loadingDemo}
            onClick={() => void createProject(false)}
          >
            Create
          </HelpMuiButton>
          {native && (
            <HelpMuiButton
              help="createLink"
              disabled={loadingDemo}
              variant="contained"
              onClick={() => void createProject(true)}
            >
              Create and link folder
            </HelpMuiButton>
          )}
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!fileView}
        onClose={() => setFileView(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          <span className="help-section-title">
            {fileView?.path} <Info topic="filePreview" />
          </span>
        </DialogTitle>
        <DialogContent>
          <p className="settings-note">
            Current contents · Included in the next message’s context
          </p>
          <pre className="file-preview">{fileView?.text}</pre>
        </DialogContent>
        <DialogActions>
          <HelpMuiButton
            help="removeContext"
            onClick={() => {
              if (fileView)
                setPaths((v) => v.filter((p) => p !== fileView.path));
              setFileView(null);
            }}
          >
            Remove from context
          </HelpMuiButton>
          <HelpMuiButton help="close" onClick={() => setFileView(null)}>
            Close
          </HelpMuiButton>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!citation}
        onClose={() => setCitation(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          <Info topic="citations" /> {citation?.clusterId} ·{" "}
          {citationSource?.title || "Catalogue context"}
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
          <HelpMuiButton help="close" onClick={() => setCitation(null)}>
            Close
          </HelpMuiButton>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!preview}
        onClose={() => !executing && setPreview(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          <Info topic="review" />{" "}
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
            <HelpMuiButton
              help="stopCommand"
              onClick={() =>
                preview && native?.stopCommand(preview.value.ticket)
              }
            >
              Stop command
            </HelpMuiButton>
          ) : (
            <>
              <HelpMuiButton
                help="decline"
                onClick={() =>
                  preview && void deny(preview.message, preview.operation)
                }
              >
                Decline
              </HelpMuiButton>
              <HelpMuiButton help="close" onClick={() => setPreview(null)}>
                Close
              </HelpMuiButton>
              <HelpMuiButton
                help="permission"
                variant="contained"
                onClick={() => void approve()}
              >
                Request permission and{" "}
                {preview?.value.kind === "write" ? "apply" : "run"}
              </HelpMuiButton>
            </>
          )}
        </DialogActions>
      </Dialog>
    </div>
  );
}
