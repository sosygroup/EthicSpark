"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { safeExternalUrl } = require("../external-link.cjs");
test("source links accept absolute web URLs and reject executable or ambiguous targets", () => {
  assert.equal(
    safeExternalUrl("https://doi.org/10.123/example?a=1#abstract"),
    "https://doi.org/10.123/example?a=1#abstract",
  );
  assert.equal(safeExternalUrl("http://example.org"), "http://example.org/");
  for (const url of [
    "file:///etc/passwd",
    "javascript:alert(1)",
    "data:text/html,hello",
    "/relative",
    "https://user:secret@example.org",
    "https://example.org\n",
    "https:example.org",
    null,
    "https://example.org/" + "x".repeat(8192),
  ])
    assert.throws(() => safeExternalUrl(url));
});
