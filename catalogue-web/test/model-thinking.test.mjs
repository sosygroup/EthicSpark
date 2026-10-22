import test from "node:test";
import assert from "node:assert/strict";
import {
  thinkingChoice,
  thinkingRequest,
  thinkingLabel,
  readThinkingPreferences,
} from "../src/model-thinking.ts";
test("automatic omits the override; model default explicitly omits the server preference", () => {
  assert.equal(thinkingRequest("auto"), undefined);
  assert.equal(thinkingRequest("default"), "");
  for (const value of [true, false, "low", "medium", "high", "default", "true"])
    assert.equal(thinkingRequest(thinkingChoice(value)), value);
  assert.equal(thinkingLabel(false), "Off");
  assert.equal(thinkingLabel("low"), "Low");
  for (const invalid of ["bad", "value:12", 'value:{"level":"high"}'])
    assert.equal(thinkingRequest(invalid), undefined);
});
test("model preferences are separate and corrupted saved values are ignored", () => {
  assert.deepEqual(
    readThinkingPreferences(
      JSON.stringify({
        "model-a": "auto",
        "model-b": thinkingChoice("high"),
        "model-c": "default",
        bad: 7,
      }),
    ),
    {
      "model-a": "auto",
      "model-b": thinkingChoice("high"),
      "model-c": "default",
    },
  );
  for (const raw of ["null", "[]", "invalid"])
    assert.deepEqual(readThinkingPreferences(raw), {});
});
