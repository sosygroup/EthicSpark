"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { WorkspaceAgent, hash, safeRel } = require("../workspace-agent.cjs");
async function fixture(t, confirm = async () => true, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ethicspark-test-")),
    project = randomUUID();
  const agent = await new WorkspaceAgent({
    statePath: path.join(root, "state", "links.json"),
    confirm,
    ...options,
  }).init();
  const folder = path.join(root, "project");
  await fs.mkdir(folder);
  await agent.link(project, folder);
  t.after(async () => {
    agent.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  return { root, folder, project, agent };
}
test("live folder reads stay inside the selected root and exclude secrets, dependencies and symlinks", async (t) => {
  const { root, folder, project, agent } = await fixture(t);
  await fs.writeFile(path.join(folder, "main.java"), "first version");
  await fs.writeFile(path.join(folder, ".env"), "never share");
  await fs.mkdir(path.join(folder, "node_modules"));
  await fs.writeFile(path.join(folder, "node_modules", "cache.txt"), "ignored");
  await fs.writeFile(path.join(root, "outside.txt"), "private");
  await fs.symlink(
    path.join(root, "outside.txt"),
    path.join(folder, "linked.txt"),
  );
  const index = await agent.workspace(project);
  assert.deepEqual(index.tree, ["main.java"]);
  const first = await agent.read(project, "main.java");
  assert.equal(first.sha256, hash(Buffer.from("first version")));
  await fs.writeFile(path.join(folder, "main.java"), "updated externally");
  assert.equal(
    (await agent.read(project, "main.java")).text,
    "updated externally",
  );
  const bom = Buffer.from("\uFEFFwith BOM");
  await fs.writeFile(path.join(folder, "bom.txt"), bom);
  const decoded = await agent.read(project, "bom.txt");
  assert.equal(decoded.text, "\uFEFFwith BOM");
  assert.equal(hash(Buffer.from(decoded.text)), decoded.sha256);
  await assert.rejects(agent.read(project, "../outside.txt"));
  await assert.rejects(agent.read(project, ".env"));
  await assert.rejects(agent.read(project, "linked.txt"));
  assert.throws(() => safeRel("/etc/passwd"));
  assert.throws(() => safeRel("src/../../outside"));
  assert.throws(() => safeRel(".AWS/credentials"));
});
test("denying an edit leaves the file unchanged and approval tickets cannot be reused", async (t) => {
  const { folder, project, agent } = await fixture(t, async () => false);
  await fs.writeFile(path.join(folder, "app.txt"), "old");
  const before = await agent.read(project, "app.txt");
  const preview = await agent.prepare(project, {
    kind: "write",
    path: "app.txt",
    content: "new",
    baseSha256: before.sha256,
    reason: "Update this file",
  });
  assert.equal(preview.before, "old");
  assert.equal(preview.after, "new");
  assert.equal((await agent.approve(preview.ticket)).status, "rejected");
  assert.equal(await fs.readFile(path.join(folder, "app.txt"), "utf8"), "old");
  await assert.rejects(agent.approve(preview.ticket));
});
test("approved changes preserve file mode and reject a stale preview or blind overwrite", async (t) => {
  const { folder, project, agent } = await fixture(t);
  await fs.writeFile(path.join(folder, "test.sh"), "echo old\n", {
    mode: 0o755,
  });
  const before = await agent.read(project, "test.sh");
  const preview = await agent.prepare(project, {
    kind: "write",
    path: "test.sh",
    content: "echo new\n",
    baseSha256: before.sha256,
    reason: "Update test output",
  });
  assert.equal((await agent.approve(preview.ticket)).status, "applied");
  assert.equal(
    await fs.readFile(path.join(folder, "test.sh"), "utf8"),
    "echo new\n",
  );
  assert.equal(
    (await fs.stat(path.join(folder, "test.sh"))).mode & 0o777,
    0o755,
  );
  await assert.rejects(
    agent.prepare(project, {
      kind: "write",
      path: "test.sh",
      content: "blind replacement",
      baseSha256: "",
      reason: "Replace",
    }),
  );
  const current = await agent.read(project, "test.sh");
  const stale = await agent.prepare(project, {
    kind: "write",
    path: "test.sh",
    content: "other",
    baseSha256: current.sha256,
    reason: "Change",
  });
  await fs.writeFile(path.join(folder, "test.sh"), "external edit");
  await assert.rejects(agent.approve(stale.ticket));
  assert.equal(
    await fs.readFile(path.join(folder, "test.sh"), "utf8"),
    "external edit",
  );
});
test("new nested files require approval and switching folders invalidates a prepared action", async (t) => {
  const { root, folder, project, agent } = await fixture(t);
  const preview = await agent.prepare(project, {
    kind: "write",
    path: "docs/design.md",
    content: "# Design\n",
    baseSha256: "",
    reason: "Create design document",
  });
  assert.equal((await agent.approve(preview.ticket)).status, "applied");
  assert.equal(
    await fs.readFile(path.join(folder, "docs/design.md"), "utf8"),
    "# Design\n",
  );
  const next = await agent.prepare(project, {
    kind: "write",
    path: "new.txt",
    content: "one",
    baseSha256: "",
    reason: "Create file",
  });
  const other = path.join(root, "other");
  await fs.mkdir(other);
  await agent.link(project, other);
  await assert.rejects(agent.approve(next.ticket));
  await assert.rejects(fs.stat(path.join(other, "new.txt")));
});
test("commands use exact argv, cannot run without approval, and return actual exit codes", async (t) => {
  let allow = false,
    seen;
  const { project, agent } = await fixture(t, async (preview) => {
    seen = preview;
    return allow;
  });
  const command = {
    kind: "command",
    program: "node",
    args: ["-e", 'console.log("fixture output");process.exit(7)'],
    reason: "Exercise the command runner",
  };
  const denied = await agent.prepare(project, command);
  assert.equal((await agent.approve(denied.ticket)).status, "rejected");
  allow = true;
  const approved = await agent.prepare(project, command);
  const result = await agent.approve(approved.ticket);
  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 7);
  assert.match(result.output, /fixture output/);
  assert.deepEqual(seen.args, command.args);
  await assert.rejects(
    agent.prepare(project, { ...command, program: "node; rm -rf /" }),
  );
});
test("long-running commands are stopped at the deadline", async (t) => {
  const { project, agent } = await fixture(t, async () => true, {
    timeoutMs: 250,
  });
  const preview = await agent.prepare(project, {
    kind: "command",
    program: "node",
    args: ["-e", 'console.log("started");setInterval(()=>{},1000)'],
    reason: "Exercise cancellation",
  });
  const result = await agent.approve(preview.ticket);
  assert.equal(result.status, "cancelled");
  assert.match(result.output, /started/);
});

test("closing the app terminates an approved child even if it ignores a graceful stop", async (t) => {
  let ready;
  const started = new Promise((resolve) => {
    ready = resolve;
  });
  const { project, agent } = await fixture(t, async () => true, {
    timeoutMs: 10000,
    onOutput: () => ready(),
  });
  const preview = await agent.prepare(project, {
    kind: "command",
    program: "node",
    args: [
      "-e",
      'process.on("SIGTERM",()=>{});console.log("ready");setInterval(()=>{},1000)',
    ],
    reason: "Exercise app-exit cancellation",
  });
  const running = agent.approve(preview.ticket);
  await started;
  agent.close();
  const result = await running;
  assert.equal(result.status, "cancelled");
});

test("open folder uses only the linked directory and unlink invalidates pending approvals without deleting files", async (t) => {
  const { project, agent, folder } = await fixture(t, async () => true);
  let opened;
  await agent.openFolder(project, async (folder) => {
    opened = folder;
    return "";
  });
  assert.equal(opened, await fs.realpath(folder));
  await assert.rejects(
    agent.openFolder("00000000-0000-0000-0000-000000000000", async () =>
      assert.fail("must not open"),
    ),
  );
  await assert.rejects(
    agent.openFolder(project, async () => "Finder could not open the folder"),
    /Finder/,
  );
  const ticket = await agent.prepare(project, {
    kind: "write",
    path: "new.txt",
    content: "example",
    baseSha256: "",
    reason: "Create file",
  });
  await agent.unlink(project);
  await assert.rejects(agent.approve(ticket.ticket), /expired/);
  assert.equal((await fs.stat(folder)).isDirectory(), true);
});
