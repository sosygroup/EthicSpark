import test from "node:test";
import assert from "node:assert/strict";
import {
  clearSettingsPreferences,
  clearWorkspacePreferences,
} from "../src/reset-preferences.ts";
function storage(entries) {
  const data = new Map(Object.entries(entries));
  return {
    get length() {
      return data.size;
    },
    key: (i) => Array.from(data.keys())[i] ?? null,
    removeItem: (key) => data.delete(key),
    getItem: (key) => data.get(key) ?? null,
  };
}
test("settings reset preserves workspace selections, context, drafts and unrelated storage", () => {
  const local = storage({
    "ethicspark-provider": "ollama",
    "ethicspark-model": "example",
    "ethicspark-consents": "{}",
    "ethicspark-retention": "{}",
    "ethicspark-thinking": "{}",
    "ethicspark-preload": "false",
    "ethicspark-project": "p",
    "ethicspark-files-p": "[]",
    other: "keep",
  });
  clearSettingsPreferences(local);
  assert.equal(local.getItem("ethicspark-provider"), null);
  assert.equal(local.getItem("ethicspark-model"), null);
  assert.equal(local.getItem("ethicspark-project"), "p");
  assert.equal(local.getItem("ethicspark-files-p"), "[]");
  assert.equal(local.getItem("other"), "keep");
  assert.equal(local.length, 3);
});
test("workspace cleanup removes only EthicSpark settings, context and legacy data from both stores", () => {
  const local = storage({
      "ethicspark-files-p": "[]",
      "ethics-project": "p",
      "ethics-actor": "name",
      other: "keep",
    }),
    session = storage({ "ethicspark-reload-prompt": "draft", other: "keep" });
  clearWorkspacePreferences(local, session);
  assert.equal(local.length, 1);
  assert.equal(session.length, 1);
  assert.equal(local.getItem("other"), "keep");
  assert.equal(session.getItem("other"), "keep");
});
