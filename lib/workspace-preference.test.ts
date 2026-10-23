import { test } from "node:test";
import assert from "node:assert/strict";
import { readWorkspacePreference } from "./workspace-preference.ts";

test("workspace preference restores saved open state and width with safe defaults", () => {
  assert.deepEqual(readWorkspacePreference(JSON.stringify({ open: false, size: 50 })), { open: false, size: 50 });
  for (const raw of [null, "", "not json", "null", "[]", JSON.stringify({ open: "yes", size: 40 }), JSON.stringify({ open: true }), JSON.stringify({ open: true, size: "40" })]) {
    assert.deepEqual(readWorkspacePreference(raw), { open: true, size: 45 });
  }
});

test("restored width is clamped so conversation and workspace both keep their minimum space", () => {
  assert.deepEqual(readWorkspacePreference(JSON.stringify({ open: true, size: 95 })), { open: true, size: 65 });
  assert.deepEqual(readWorkspacePreference(JSON.stringify({ open: true, size: 3 })), { open: true, size: 30 });
});
