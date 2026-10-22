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

test("provider authentication and thinking compatibility have specific recovery instructions", () => {
  for (const message of [
    "OpenAI returned HTTP 401. Check server configuration, model access, input compatibility and provider quota.",
    "OpenAI returned HTTP 401. Authentication was rejected.",
  ]) {
    const issue = explainIssue(message, "openai");
    assert.match(issue.title, /authentication/i);
    assert.match(issue.nextStep, /backend/);
    assert.doesNotMatch(issue.explanation, /resource limits|quota/);
  }
  assert.match(
    explainIssue(
      "This model does not support the configured OLLAMA_REASONING_EFFORT.",
      "ollama",
    ).nextStep,
    /leave OLLAMA_REASONING_EFFORT empty/,
  );
  assert.match(
    explainIssue("OpenAI returned HTTP 403.", "openai").title,
    /denied access/,
  );
  assert.match(
    explainIssue("OpenAI returned HTTP 429.", "openai").title,
    /limit/,
  );
});

test("compatible authentication errors direct the user to editable connection settings", () => {
  const notice = explainIssue(
    "OpenAI-compatible returned HTTP 401. Authentication was rejected.",
  );
  assert.match(notice.nextStep, /Save connection/);
  assert.match(notice.nextStep, /No restart/);
});
