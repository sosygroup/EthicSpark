import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMermaid,
  artifactImage,
  isMermaidArtifact,
} from "../src/visual-utils.ts";
test("repairs the reported missing space without inventing a missing diagram body", () => {
  assert.equal(normalizeMermaid("graphTB subgraph"), "graph TB subgraph");
  assert.equal(
    normalizeMermaid("flowchartLR\r\n A-->B"),
    "flowchart LR\n A-->B",
  );
  assert.equal(
    normalizeMermaid("graph TB\n A[graphTB]-->B"),
    "graph TB\n A[graphTB]-->B",
  );
  assert.equal(
    normalizeMermaid("sequenceDiagram\n A->>B: hi"),
    "sequenceDiagram\n A->>B: hi",
  );
});
test("only self-contained supported images are previewed; remote and executable URLs are rejected", () => {
  const artifact = (content) => ({
    name: "figure.png",
    mediaType: "image/png",
    content,
  });
  for (const url of [
    "https://example.com/tracker.png",
    "javascript:alert(1)",
    "data:text/html;base64,AAAA",
    "data:image/svg+xml;base64,AAAA",
  ]) {
    assert.equal(artifactImage(artifact(url)), null);
  }
  for (const format of ["png", "jpeg", "gif", "webp"])
    assert.equal(
      artifactImage(artifact(`data:image/${format};base64,AAAA`)),
      `data:image/${format};base64,AAAA`,
    );
  assert.equal(artifactImage(artifact("x".repeat(200001))), null);
  assert.equal(
    artifactImage({
      name: "figure.svg",
      mediaType: "image/svg+xml",
      content: "not SVG",
    }),
    null,
  );
  assert.match(
    artifactImage({
      name: "figure.svg",
      mediaType: "image/svg+xml",
      content: '<svg xmlns="http://www.w3.org/2000/svg"/>',
    }),
    /^data:image\/svg\+xml;charset=utf-8,/,
  );
});
test("recognizes Mermaid downloads by type or extension", () => {
  assert.ok(
    isMermaidArtifact({
      name: "architecture.mmd",
      mediaType: "text/plain",
      content: "",
    }),
  );
  assert.ok(
    isMermaidArtifact({
      name: "architecture.txt",
      mediaType: "text/vnd.mermaid",
      content: "",
    }),
  );
  assert.equal(
    isMermaidArtifact({
      name: "notes.md",
      mediaType: "text/markdown",
      content: "",
    }),
    false,
  );
});
