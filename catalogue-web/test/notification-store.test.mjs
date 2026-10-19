import test from "node:test";
import assert from "node:assert/strict";
import {
  reportNotice,
  getNotices,
  markNoticesRead,
  clearReadNotices,
  explainIssue,
} from "../src/notification-store.ts";
test("repeated issues are grouped, reading acknowledges them and a new occurrence becomes unread", () => {
  markNoticesRead();
  clearReadNotices();
  const notice = {
    key: "fixture",
    source: "Diagram",
    severity: "warning",
    title: "Source needs review",
    explanation: "Fixture",
    nextStep: "Review source",
  };
  reportNotice(notice);
  reportNotice(notice);
  assert.equal(getNotices().length, 1);
  assert.equal(getNotices()[0].count, 2);
  assert.equal(getNotices()[0].read, false);
  markNoticesRead();
  assert.equal(getNotices()[0].read, true);
  reportNotice(notice);
  assert.equal(getNotices()[0].read, false);
  assert.equal(getNotices()[0].count, 3);
  markNoticesRead();
  clearReadNotices();
  assert.equal(getNotices().length, 0);
});
test("explanations distinguish missing interface modules, model requests and unknown application failures", () => {
  const module = explainIssue(
    "Failed to fetch dynamically imported module: /assets/sequenceDiagram-old.js",
  );
  assert.equal(module.action, "reload");
  assert.match(module.explanation, /does not establish.*invalid/);
  assert.match(
    explainIssue("Cannot reach Ollama").explanation,
    /does not prove/,
  );
  assert.match(
    explainIssue("Unexpected internal state").explanation,
    /application problem/,
  );
});
test("history is bounded and technical details are truncated", () => {
  for (let i = 0; i < 60; i++)
    reportNotice({
      key: String(i),
      severity: "error",
      source: "Fixture",
      title: "Test",
      explanation: "Test",
      nextStep: "Test",
      details: "x".repeat(4000),
    });
  assert.equal(getNotices().length, 50);
  assert.equal(getNotices()[0].details.length, 3000);
  markNoticesRead();
  clearReadNotices();
});
