"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadCurrentUI } = require("../ui-startup.cjs");

test("fresh desktop startup clears only HTTP cache before loading the configured endpoint", async () => {
  const calls = [];
  let release;
  const clearing = new Promise((resolve) => {
    release = resolve;
  });
  const win = {
    webContents: {
      session: {
        clearCache: () => {
          calls.push("cache");
          return clearing;
        },
        clearStorageData: () => assert.fail("Must preserve user state"),
      },
    },
    loadURL: async (url, options) => {
      calls.push({ url, options });
    },
  };
  const loading = loadCurrentUI(
    win,
    new URL("http://127.0.0.1:8091/"),
    () => {},
  );
  assert.deepEqual(calls, ["cache"]);
  release();
  await loading;
  assert.equal(calls[1].url, "http://127.0.0.1:8091/");
  assert.match(calls[1].options.extraHeaders, /Cache-Control: no-cache/);
});

test("diagnostics identify an explicitly selected legacy view without logging query values", async () => {
  const logs = [];
  const win = {
    webContents: { session: { clearCache: async () => {} } },
    loadURL: async () => {},
  };
  await loadCurrentUI(
    win,
    new URL("http://localhost:8082/?legacy=1&note=private-value"),
    (line) => logs.push(line),
  );
  assert.match(logs[0], /legacy workflow/);
  assert.doesNotMatch(logs[0], /private-value/);
});
