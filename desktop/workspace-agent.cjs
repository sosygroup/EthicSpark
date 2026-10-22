"use strict";
const fs = require("node:fs/promises");
const { watch, constants } = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { TextDecoder } = require("node:util");
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const excluded = new Set([
  ".git",
  ".ssh",
  ".aws",
  ".codex",
  ".agents",
  "node_modules",
  "target",
  "dist",
  "build",
  ".idea",
  ".vscode",
  ".next",
  ".venv",
  "venv",
  "__pycache__",
]);
function safeRel(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 1000 ||
    path.isAbsolute(value) ||
    /[\\:\x00-\x1f]/.test(value)
  )
    throw Error("Use a relative path inside the linked project.");
  const parts = value.split("/");
  if (
    parts.some(
      (p) =>
        !p ||
        p === "." ||
        p === ".." ||
        excluded.has(p) ||
        p.toLowerCase().startsWith(".env") ||
        /\.(pem|key|p12|pfx)$/i.test(p) ||
        (p.startsWith(".") &&
          ![
            ".github",
            ".gitignore",
            ".dockerignore",
            ".gitattributes",
            ".editorconfig",
          ].includes(p)),
    )
  )
    throw Error(
      "This path is outside the readable project context or contains excluded configuration.",
    );
  return parts;
}
class WorkspaceAgent {
  constructor({
    statePath,
    confirm,
    onChange = () => {},
    onOutput = () => {},
    timeoutMs = 120000,
  }) {
    this.statePath = statePath;
    this.confirm = confirm;
    this.onChange = onChange;
    this.onOutput = onOutput;
    this.timeoutMs = timeoutMs;
    this.roots = {};
    this.tickets = new Map();
    this.running = new Map();
    this.approving = 0;
    this.watchers = new Map();
  }
  async init() {
    try {
      this.roots = JSON.parse(await fs.readFile(this.statePath, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    return this;
  }
  async persist() {
    await fs.mkdir(path.dirname(this.statePath), { recursive: true });
    await fs.writeFile(this.statePath, JSON.stringify(this.roots), {
      mode: 0o600,
    });
  }
  async link(project, root) {
    if (!/^[a-f0-9-]{36}$/.test(project))
      throw Error("Invalid project identifier.");
    const canonical = await fs.realpath(root);
    if (!(await fs.stat(canonical)).isDirectory())
      throw Error("Choose a project directory.");
    this.roots[project] = canonical;
    await this.persist();
    this.startWatch(project, canonical);
    return this.workspace(project);
  }
  async openFolder(project, open) {
    const root = await this.root(project);
    if (!(await fs.stat(root)).isDirectory())
      throw Error("The linked folder is no longer a directory.");
    const error = await open(root);
    if (error) throw Error(error);
    return null;
  }
  async unlink(project) {
    for (const [ticket, value] of this.tickets)
      if (value.project === project) this.tickets.delete(ticket);
    this.watchers.get(project)?.close();
    this.watchers.delete(project);
    delete this.roots[project];
    await this.persist();
    return null;
  }
  startWatch(project, root) {
    this.watchers.get(project)?.close();
    let timer;
    try {
      const watcher = watch(root, { recursive: true }, (_, name) => {
        if (name) {
          try {
            safeRel(String(name).split(path.sep).join("/"));
          } catch {
            return;
          }
        }
        clearTimeout(timer);
        timer = setTimeout(() => this.onChange({ projectId: project }), 400);
      });
      watcher.on("error", () => {});
      this.watchers.set(project, watcher);
    } catch {
      /* Fresh context is also read on every turn. */
    }
  }
  async root(project) {
    const root = this.roots[project];
    if (!root) throw Error("Link a local folder first.");
    const current = await fs.realpath(root);
    if (current !== root)
      throw Error("The linked folder changed identity. Link it again.");
    return root;
  }
  async resolve(project, relative, { create = false } = {}) {
    const parts = safeRel(relative),
      root = await this.root(project);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      current = path.join(current, parts[i]);
      try {
        const stat = await fs.lstat(current);
        if (stat.isSymbolicLink())
          throw Error("Symbolic links are excluded from project access.");
        if (i < parts.length - 1 && !stat.isDirectory())
          throw Error("A parent path is not a directory.");
      } catch (e) {
        if (e.code === "ENOENT" && create)
          return { root, path: path.join(root, ...parts), exists: false };
        throw e;
      }
    }
    const actual = await fs.realpath(current);
    if (actual !== root && !actual.startsWith(root + path.sep))
      throw Error("Path escapes the linked project.");
    return { root, path: actual, exists: true };
  }
  async workspace(project) {
    if (!this.roots[project]) return null;
    const root = await this.root(project);
    if (!this.watchers.has(project)) this.startWatch(project, root);
    const tree = [];
    let visited = 0,
      truncated = false;
    const walk = async (dir, prefix = "", depth = 0) => {
      if (depth > 12) {
        truncated = true;
        return;
      }
      const entries = (await fs.readdir(dir, { withFileTypes: true })).sort(
        (a, b) => a.name.localeCompare(b.name),
      );
      for (const entry of entries) {
        if (++visited > 6000 || tree.length >= 2000) {
          truncated = true;
          return;
        }
        const relative = prefix + entry.name;
        try {
          safeRel(relative);
        } catch {
          continue;
        }
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory())
          await walk(path.join(dir, entry.name), relative + "/", depth + 1);
        else if (entry.isFile()) tree.push(relative);
      }
    };
    await walk(root);
    return {
      projectId: project,
      name: path.basename(root),
      path: root,
      tree,
      truncated,
    };
  }
  async read(project, relative) {
    const resolved = await this.resolve(project, relative);
    const handle = await fs.open(
      resolved.path,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > 200000)
        throw Error(
          "Only text files up to 200,000 bytes can enter workspace context. Attach larger documents separately.",
        );
      const bytes = await handle.readFile();
      if (bytes.includes(0))
        throw Error("Binary file: attach it to the conversation instead.");
      let text;
      try {
        text = new TextDecoder("utf-8", {
          fatal: true,
          ignoreBOM: true,
        }).decode(bytes);
      } catch {
        throw Error("This file is not UTF-8 text; attach it separately.");
      }
      return { path: relative, sha256: hash(bytes), text, notice: "" };
    } finally {
      await handle.close();
    }
  }
  async prepare(project, operation) {
    if (
      !operation ||
      !["write", "command"].includes(operation.kind) ||
      typeof operation.reason !== "string" ||
      !operation.reason.trim() ||
      operation.reason.length > 4000
    )
      throw Error("Invalid operation.");
    const root = await this.root(project);
    let preview;
    if (operation.kind === "write") {
      if (
        typeof operation.content !== "string" ||
        Buffer.byteLength(operation.content) > 200000 ||
        operation.content.includes("\0")
      )
        throw Error("Replacement content is missing or too large.");
      const resolved = await this.resolve(project, operation.path, {
        create: true,
      });
      let before = "";
      if (resolved.exists) {
        const current = await this.read(project, operation.path);
        if (operation.baseSha256 !== current.sha256)
          throw Error(
            "This file changed or was not read before the edit. Refresh its context and ask for an updated proposal.",
          );
        before = current.text;
      } else if (operation.baseSha256)
        throw Error(
          "The original file no longer exists. Ask for an updated proposal.",
        );
      preview = {
        kind: "write",
        path: operation.path,
        before,
        after: operation.content,
        beforeSha256: resolved.exists ? hash(Buffer.from(before)) : "",
        afterSha256: hash(Buffer.from(operation.content)),
        reason: operation.reason,
      };
    } else {
      if (
        typeof operation.program !== "string" ||
        !/^(?:\.\/)?[a-zA-Z0-9_.-]{1,100}$/.test(operation.program) ||
        operation.program.includes("..") ||
        !Array.isArray(operation.args) ||
        operation.args.length > 50 ||
        operation.args.some(
          (a) => typeof a !== "string" || a.length > 2000 || a.includes("\0"),
        )
      )
        throw Error(
          "Commands must use an executable and an argument list, without a shell string.",
        );
      if (JSON.stringify(operation.args).length > 8000)
        throw Error("The command is too long to review.");
      if (operation.program.startsWith("./"))
        await this.resolve(project, operation.program.slice(2));
      preview = {
        kind: "command",
        program: operation.program,
        args: [...operation.args],
        cwd: root,
        reason: operation.reason,
      };
    }
    const ticket = crypto.randomUUID();
    this.tickets.set(ticket, {
      project,
      root,
      operation: JSON.parse(JSON.stringify(operation)),
      preview,
    });
    return { ticket, ...preview };
  }
  async resetLinks() {
    if (this.approving || this.running.size)
      throw Error(
        "Wait for approvals and commands to finish before resetting folder links.",
      );
    const old = this.roots;
    this.roots = {};
    try {
      await this.persist();
    } catch (error) {
      this.roots = old;
      throw error;
    }
    for (const watcher of this.watchers.values()) watcher.close();
    this.watchers.clear();
    this.tickets.clear();
  }
  async approve(ticket, ensureActive = async () => {}) {
    this.approving++;
    try {
      return await this.approveInternal(ticket, ensureActive);
    } finally {
      this.approving--;
    }
  }
  async approveInternal(ticket, ensureActive) {
    const prepared = this.tickets.get(ticket);
    if (!prepared) throw Error("Approval expired or already used.");
    this.tickets.delete(ticket);
    const { project, operation, preview, root } = prepared;
    if ((await this.root(project)) !== root)
      throw Error("The linked folder changed. Review the operation again.");
    if (!(await this.confirm(preview)))
      return {
        status: "rejected",
        summary: "Developer declined this operation.",
        output: "",
        exitCode: null,
      };
    await ensureActive();
    if (operation.kind === "write") {
      const resolved = await this.resolve(project, operation.path, {
        create: true,
      });
      if (resolved.exists) {
        const current = await this.read(project, operation.path);
        if (current.sha256 !== preview.beforeSha256)
          throw Error(
            "The file changed after the preview. No edit was applied.",
          );
      } else if (preview.beforeSha256)
        throw Error(
          "The original file disappeared after preview. No edit was applied.",
        );
      if (!preview.beforeSha256 && resolved.exists)
        throw Error("A new file appeared after preview. No edit was applied.");
      const parent = path.dirname(operation.path);
      if (parent !== ".") await this.mkdir(project, parent);
      await this.resolve(project, operation.path, { create: true });
      const mode = resolved.exists
        ? (await fs.stat(resolved.path)).mode & 0o777
        : 0o644;
      const temporary = path.join(
        path.dirname(resolved.path),
        ".ethicspark-" + crypto.randomUUID() + ".tmp",
      );
      try {
        await fs.writeFile(temporary, operation.content, { flag: "wx", mode });
        await this.resolve(project, operation.path, { create: true });
        await fs.rename(temporary, resolved.path);
      } finally {
        await fs.rm(temporary, { force: true }).catch(() => {});
      }
      this.onChange({ projectId: project });
      return {
        status: "applied",
        summary: "Updated " + operation.path,
        output:
          "Before SHA-256: " +
          preview.beforeSha256 +
          "\nAfter SHA-256: " +
          preview.afterSha256,
        exitCode: null,
      };
    }
    return this.run(ticket, project, operation, root);
  }
  async mkdir(project, relative) {
    const parts = safeRel(relative);
    let prefix = "";
    for (const part of parts) {
      prefix = prefix ? prefix + "/" + part : part;
      const resolved = await this.resolve(project, prefix, { create: true });
      if (!resolved.exists) await fs.mkdir(resolved.path);
      await this.resolve(project, prefix);
    }
  }
  async run(ticket, project, operation, root) {
    if ((await this.root(project)) !== root)
      throw Error("The linked folder changed.");
    const env = {};
    for (const k of [
      "PATH",
      "HOME",
      "USERPROFILE",
      "TMPDIR",
      "TEMP",
      "SystemRoot",
      "JAVA_HOME",
      "LANG",
      "LC_ALL",
    ])
      if (process.env[k]) env[k] = process.env[k];
    return new Promise((resolve) => {
      let output = "",
        settled = false,
        cancelled = false;
      const child = spawn(operation.program, operation.args, {
        cwd: root,
        env,
        shell: false,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
      });
      const force = () => {
        if (settled) return;
        try {
          if (process.platform === "win32") child.kill("SIGKILL");
          else process.kill(-child.pid, "SIGKILL");
        } catch {}
      };
      const stop = () => {
        if (settled) return;
        cancelled = true;
        try {
          if (process.platform === "win32") child.kill("SIGTERM");
          else process.kill(-child.pid, "SIGTERM");
        } catch {}
        setTimeout(force, 1500).unref();
      };
      stop.force = force;
      this.running.set(ticket, stop);
      const timer = setTimeout(stop, this.timeoutMs);
      const finish = (code, error = "") => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.running.delete(ticket);
        resolve({
          status: cancelled
            ? "cancelled"
            : error || code !== 0
              ? "failed"
              : "executed",
          summary: cancelled
            ? "Command stopped."
            : error || "Command completed with exit code " + code,
          output: output + (error ? "\n" + error : ""),
          exitCode: code,
        });
      };
      const append = (data) => {
        const text = data.toString();
        if (output.length < 100000) {
          const piece = text.slice(0, 100000 - output.length);
          output += piece;
          this.onOutput({ ticket, text: piece });
        }
      };
      child.stdout.on("data", append);
      child.stderr.on("data", append);
      child.on("error", (e) => finish(null, e.message));
      child.on("close", (code) => finish(code));
    });
  }
  stop(ticket) {
    this.running.get(ticket)?.();
  }
  close() {
    for (const watcher of this.watchers.values()) watcher.close();
    for (const stop of this.running.values()) {
      stop();
      stop.force?.();
    }
  }
}
module.exports = { WorkspaceAgent, safeRel, hash };
