import test from "node:test";
import assert from "node:assert/strict";
import { isModuleLoadError } from "../src/app-update.ts";
test("recognizes missing application modules without misclassifying syntax or ordinary API errors", () => {
  for (const message of [
    "Failed to fetch dynamically imported module: http://localhost:8082/assets/sequenceDiagram-old.js",
    "Importing a module script failed.",
    "error loading dynamically imported module",
    "Loading chunk 19 failed.",
    "Unable to preload CSS for /assets/example.css",
  ])
    assert.equal(isModuleLoadError(new TypeError(message)), true);
  for (const message of [
    "Parse error on line 1: graphTB subgraph",
    "Invalid Mermaid source",
    "Failed to fetch",
    "Catalogue version not found",
  ])
    assert.equal(isModuleLoadError(new Error(message)), false);
});
