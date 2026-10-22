"use strict";
const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  session,
  shell,
} = require("electron");
const { safeExternalUrl } = require("./external-link.cjs");
const { loadCurrentUI } = require("./ui-startup.cjs");
const path = require("node:path");
const { WorkspaceAgent } = require("./workspace-agent.cjs");
const target = new URL(process.env.ETHICSPARK_URL || "http://localhost:8082/");
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
  target.protocol !== "http:" ||
  target.username ||
  target.password
)
  throw Error("The desktop workspace requires a local backend URL.");
let window, agent;
app.setName("EthicSpark");
const primary = app.requestSingleInstanceLock();
if (!primary) {
  console.log(
    "[EthicSpark] Reusing the running desktop instance; checking it for interface updates.",
  );
  app.quit();
}
if (primary)
  app.whenReady().then(async () => {
    console.log("[EthicSpark] Desktop source: " + path.dirname(__dirname));
    agent = await new WorkspaceAgent({
      statePath: path.join(app.getPath("userData"), "linked-projects.json"),
      confirm: async (preview) => {
        const detail =
          preview.kind === "write"
            ? preview.reason +
              "\n\nFile: " +
              preview.path +
              "\nBefore SHA-256: " +
              (preview.beforeSha256 || "(new file)") +
              "\nAfter SHA-256: " +
              preview.afterSha256 +
              "\n\nReview the complete before/after content in the app."
            : preview.reason +
              "\n\nWorking directory: " +
              preview.cwd +
              "\nProgram: " +
              preview.program +
              "\nArguments: " +
              JSON.stringify(preview.args) +
              "\n\nThis command runs with your user permissions and can access resources outside the linked folder. Child processes may use the network. Review project scripts before approving.";
        const answer = await dialog.showMessageBox(window, {
          type: "question",
          title: "EthicSpark — Permission required",
          message:
            preview.kind === "write"
              ? "Allow this exact file change?"
              : "Allow this exact command?",
          detail,
          buttons: [
            "Deny",
            preview.kind === "write" ? "Apply change" : "Run command",
          ],
          defaultId: 0,
          cancelId: 0,
          noLink: true,
        });
        return answer.response === 1;
      },
      onChange: (change) =>
        window?.webContents.send("workspace:changed", change),
      onOutput: (output) =>
        window?.webContents.send("workspace:output", output),
    }).init();
    session.defaultSession.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false),
    );
    window = new BrowserWindow({
      title: "EthicSpark",
      width: 1440,
      height: 960,
      minWidth: 760,
      minHeight: 600,
      backgroundColor: "#f9f9f8",
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event, url) => {
      if (new URL(url).origin !== target.origin) event.preventDefault();
    });
    const trusted = (event) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        new URL(event.senderFrame.url).origin !== target.origin
      )
        throw Error("Untrusted native request.");
    };
    const handle = (name, fn) =>
      ipcMain.handle(name, async (event, ...args) => {
        trusted(event);
        return fn(...args);
      });
    handle("workspace:link", async (project) => {
      const choice = await dialog.showOpenDialog(window, {
        title: "Link a local project folder",
        properties: ["openDirectory"],
      });
      if (choice.canceled) return null;
      return agent.link(project, choice.filePaths[0]);
    });
    handle("reference:open", (url) => shell.openExternal(safeExternalUrl(url)));
    handle("workspace:get", (project) => agent.workspace(project));
    handle("workspace:open", (project) =>
      agent.openFolder(project, (root) => shell.openPath(root)),
    );
    handle("workspace:unlink", (project) => agent.unlink(project));
    handle("workspace:read", (project, relative) =>
      agent.read(project, relative),
    );
    handle("workspace:prepare", (project, operation) =>
      agent.prepare(project, operation),
    );
    handle("workspace:approve", (ticket, lease) =>
      agent.approve(ticket, async () => {
        if (typeof lease !== "string" || !/^[a-f0-9-]{36}$/.test(lease))
          throw Error("Reload EthicSpark before approving operations.");
        const response = await fetch(
          new URL(
            "/api/assistant/maintenance/operations/" + lease + "/renew",
            target,
          ),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
            signal: AbortSignal.timeout(10000),
          },
        );
        if (!response.ok)
          throw Error(
            "Operation permission expired or workspace changed. Review the operation again.",
          );
      }),
    );
    handle("workspace:reset-links", () => agent.resetLinks());
    handle("workspace:stop", (ticket) => agent.stop(ticket));
    window.webContents.session.webRequest.onCompleted(
      { urls: [target.origin + "/assets/*"] },
      (details) => {
        const pathname = new URL(details.url).pathname;
        if (/^\/assets\/index-[^/]+\.js$/.test(pathname))
          console.log(
            `[EthicSpark] Loaded interface ${pathname} (HTTP ${details.statusCode}).`,
          );
      },
    );
    await loadCurrentUI(window, target);
  });
app.on("second-instance", () => {
  window?.show();
  window?.focus();
  window?.webContents.send("application:check-update");
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => agent?.close());
