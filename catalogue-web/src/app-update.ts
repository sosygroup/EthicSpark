import { reportNotice } from "./notification-store.ts";
/** A failed chunk request may indicate an old page after a deployment, or a temporary outage. */
export type UpdateState = "current" | "updated" | "unavailable" | "blocked";
let state: UpdateState = "current";
const subscribers = new Set<() => void>();
let checking: Promise<void> | null = null;
export const subscribeUpdates = (callback: () => void) => {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
};
export const getUpdateState = () => state;
function reportUpdateNotice(state: UpdateState, details?: string) {
  if (state === "current") return;
  reportNotice({
    key: "application-update",
    source: "Application files",
    severity: state === "updated" ? "info" : "warning",
    title:
      state === "updated"
        ? "Application updated"
        : state === "blocked"
          ? "Reload is waiting for active work"
          : "An interface component could not load",
    explanation:
      state === "updated"
        ? "The server is serving a newer interface than this open window. This is an update notification, not a failure of your project or the model."
        : state === "blocked"
          ? "A response or command is still running. EthicSpark did not interrupt it to reload the window."
          : "The browser could not retrieve part of the interface. An older open window after an update, a local service restart or a connection problem can cause this. This does not establish that a diagram contains invalid syntax.",
    nextStep:
      state === "blocked"
        ? "Stop or finish the current response or command, then reload."
        : "Check that the local service is running, then use Reload app. Saved conversations and unsent message text are kept.",
    action: "reload",
    details,
  });
}
function publish(next: UpdateState, force = false, details?: string) {
  if (state !== next || force) reportUpdateNotice(next, details);
  if (state !== next) {
    state = next;
    subscribers.forEach((callback) => callback());
  }
}
export function isModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|loading (?:css )?chunk .*failed|unable to preload css/i.test(
    message,
  );
}
export function entryScript(html: string, base: string): string | null {
  const document = new DOMParser().parseFromString(html, "text/html");
  const src = document
    .querySelector<HTMLScriptElement>('script[type="module"][src]')
    ?.getAttribute("src");
  return src ? new URL(src, base).href : null;
}
export async function checkForAppUpdate(
  failed = false,
  error?: unknown,
): Promise<void> {
  if (failed)
    publish(
      state === "updated" ? "updated" : "unavailable",
      true,
      error instanceof Error
        ? error.message
        : error === undefined
          ? undefined
          : String(error),
    );
  if (checking) return checking;
  checking = (async () => {
    try {
      const current = document.querySelector<HTMLScriptElement>(
        'script[type="module"][src]',
      )?.src;
      const response = await fetch("/", {
        cache: "no-store",
        headers: { Accept: "text/html" },
        signal: AbortSignal.timeout(5000),
      });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("text/html")
      )
        return;
      const latest = entryScript(await response.text(), location.origin);
      if (current && latest && current !== latest) publish("updated");
    } catch {
      /* Keep the page usable while the local service is restarting or offline. */
    } finally {
      checking = null;
    }
  })();
  return checking;
}
export function reloadApp(): void {
  // Let the workspace preserve the unsent draft and veto interruption of active work.
  if (
    !window.dispatchEvent(
      new Event("ethicspark:before-reload", { cancelable: true }),
    )
  ) {
    publish("blocked");
    return;
  }
  location.reload();
}
export function installUpdateDetection(): void {
  window.ethicsparkDesktop?.onApplicationUpdateCheck?.(() => {
    void checkForAppUpdate();
  });
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    void checkForAppUpdate(
      true,
      (event as Event & { payload?: unknown }).payload,
    );
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (isModuleLoadError(event.reason)) {
      event.preventDefault();
      void checkForAppUpdate(true, event.reason);
    }
  });
  window.addEventListener("focus", () => {
    void checkForAppUpdate();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkForAppUpdate();
  });
  void checkForAppUpdate();
}
