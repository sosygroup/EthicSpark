import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { reportIssue, reportNotice } from "./notification-store";
import { clearWorkspacePreferences } from "./reset-preferences";
type Snapshot = {
  counts: Record<string, number>;
  snapshotToken: string;
  available: boolean;
  reason: string;
};
async function request(path: string, body?: unknown) {
  const response = await fetch(
    "/api/assistant/maintenance" + path,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const data = await response.json();
  if (!response.ok) throw Error(data.detail || "Workspace maintenance failed.");
  return data;
}
export default function ResetDialog({
  open,
  blocked,
  onClose,
  onResetSettings,
}: {
  open: boolean;
  blocked: boolean;
  onClose: () => void;
  onResetSettings: () => void;
}) {
  const [mode, setMode] = useState<"settings" | "workspace" | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState("");
  async function refresh() {
    setWorking(true);
    setProblem("");
    try {
      setSnapshot(await request(""));
    } catch (e) {
      setProblem((e as Error).message);
      setSnapshot(null);
    } finally {
      setWorking(false);
    }
  }
  useEffect(() => {
    if (open) {
      setMode(null);
      setConfirmation("");
      void refresh();
    }
  }, [open]);
  async function exportWorkspace() {
    setWorking(true);
    setProblem("");
    try {
      const data = await request("/export");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download =
        "ethicspark-workspace-" +
        new Date().toISOString().slice(0, 10) +
        ".json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function reset() {
    if (blocked || working || !snapshot?.available) return;
    setWorking(true);
    setProblem("");
    try {
      if (mode === "settings") {
        const current: Snapshot = await request("");
        if (!current.available) throw Error(current.reason);
        onResetSettings();
        onClose();
        reportNotice({
          key: "settings-reset",
          source: "Settings",
          severity: "info",
          title: "Settings restored",
          explanation:
            "Provider/model selection, processing permissions and Ollama preferences were restored in this browser or desktop app. Projects, conversations and linked folders were kept.",
          nextStep: "Choose a provider and model when you are ready.",
        });
      } else if (mode === "workspace" && confirmation === "RESET") {
        await request("/reset", {
          confirmation,
          snapshotToken: snapshot.snapshotToken,
        });
        clearWorkspacePreferences(localStorage, sessionStorage);
        try {
          await window.ethicsparkDesktop?.resetWorkspaceLinks?.();
        } catch (e) {
          reportIssue((e as Error).message, "Local folder links", "warning");
          setProblem(
            "The workspace was reset. Local link cleanup failed; restart the desktop app before linking folders again.",
          );
          return;
        }
        window.location.replace("/");
      }
    } catch (e) {
      setProblem((e as Error).message);
      if (mode === "workspace") {
        setSnapshot(null);
        setConfirmation("");
      }
    } finally {
      setWorking(false);
    }
  }
  const unavailable = blocked || working || !snapshot?.available;
  const oldDesktop =
    !!window.ethicsparkDesktop && !window.ethicsparkDesktop.resetWorkspaceLinks;
  return (
    <Dialog
      open={open}
      onClose={() => !working && onClose()}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        {mode === "workspace"
          ? "Reset workspace"
          : mode === "settings"
            ? "Reset settings"
            : "Reset"}
      </DialogTitle>
      <DialogContent className="reset-content">
        <p>
          Settings belong to this browser or desktop app. Workspace data belongs
          to the shared local backend: resetting it affects every window
          connected to it.
        </p>
        {blocked && (
          <Alert severity="info">
            Wait for responses, uploads, model preparation and local operations
            to finish.
          </Alert>
        )}
        {snapshot && !snapshot.available && (
          <Alert severity="info">{snapshot.reason}</Alert>
        )}
        {problem && <Alert severity="error">{problem}</Alert>}
        {mode === null && (
          <>
            <section className="reset-option">
              <h3>Reset settings</h3>
              <p>
                Restore OpenAI with no model selected, processing permission
                off, automatic compatible reasoning, preload enabled and
                30-minute model retention. Keep projects, conversations,
                attachments and folder links.
              </p>
              <Button
                disabled={unavailable}
                onClick={() => setMode("settings")}
              >
                Reset settings…
              </Button>
            </section>
            <section className="reset-option">
              <h3>Reset workspace</h3>
              <p>
                Permanently delete your projects (including Trash),
                conversations, attachments, artifacts, receipts and legacy
                workflow records. Restore default preferences and a fresh copy
                of the bundled demo, as on first launch. Changes or extra
                conversations in the demo are removed.
              </p>
              <Button
                color="error"
                disabled={unavailable || oldDesktop}
                onClick={() => setMode("workspace")}
              >
                Reset workspace…
              </Button>
            </section>
          </>
        )}
        {mode === "settings" && (
          <p>
            This restores preferences in this window's browser or desktop app.
            It does not clear conversations, unsent text, attached material or
            linked folders. A loaded Ollama model is not unloaded.
          </p>
        )}
        {mode === "workspace" && (
          <>
            <Alert severity="warning">
              Your work will be replaced by the original offline demo. This
              cannot be undone through Trash. Export first if you want to keep a
              copy. The JSON export is for archival use; automatic import is not
              available.
            </Alert>
            {snapshot && (
              <ul>
                <li>
                  Projects, including legacy projects and Trash:{" "}
                  {snapshot.counts.workflow_project}
                </li>
                <li>Conversations: {snapshot.counts.assistant_thread}</li>
                <li>Messages: {snapshot.counts.assistant_message}</li>
                <li>Uploaded files: {snapshot.counts.profile_attachment}</li>
                <li>Operation receipts: {snapshot.counts.assistant_receipt}</li>
              </ul>
            )}
            <Button
              disabled={working || blocked}
              onClick={() => void exportWorkspace()}
            >
              Export workspace (JSON)
            </Button>
            <p>
              The export contains project material and attachment bytes. Store
              it as confidential project data. It does not export files from
              linked local folders.
            </p>
            <TextField
              fullWidth
              label="Type RESET to confirm"
              value={confirmation}
              disabled={working || blocked}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
            />
          </>
        )}
        {oldDesktop && (
          <Alert severity="info">
            Restart the desktop app with ./scripts/desktop.sh to enable complete
            reset and local folder-link cleanup.
          </Alert>
        )}
        <p>
          The catalogue, files in local project folders, installed Ollama models
          and server configuration (including API keys) are kept. Other browsers
          keep their own preferences and desktop links; reload those windows
          after a workspace reset. Removed project identities cannot be used for
          new operations.
        </p>
      </DialogContent>
      <DialogActions>
        <Button disabled={working} onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={working}
          onClick={() => {
            setConfirmation("");
            void refresh();
          }}
        >
          Refresh summary
        </Button>
        {mode && (
          <Button
            variant="contained"
            color={mode === "workspace" ? "error" : "primary"}
            disabled={
              unavailable ||
              (mode === "workspace" && (confirmation !== "RESET" || oldDesktop))
            }
            onClick={() => void reset()}
          >
            {working
              ? "Working…"
              : mode === "workspace"
                ? "Permanently reset workspace"
                : "Restore default settings"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
