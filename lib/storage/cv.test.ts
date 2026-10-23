import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { cvSchema, exportCv } from "./cv.ts";

test("a CV can omit contact and every conventional section", () => {
  const value = { schemaVersion: 1, sections: [{ type: "text", title: "Research interests", content: { text: "Reliable queues", evidence: ["p-research"] } }] };
  assert.deepEqual(cvSchema.parse(value), value);
});

test("export removes evidence from every claim while keeping ordered content", () => {
  const value = { schemaVersion: 1, sections: [
    { type: "list", title: "Tools", items: [{ text: "TypeScript", evidence: ["p-skills"] }] },
    { type: "entries", title: "Selected work", entries: [{ heading: { text: "Queue service", evidence: ["p-queue"] }, highlights: [{ text: "Built retries", evidence: ["p-queue"] }] }] },
  ] };
  assert.deepEqual(JSON.parse(exportCv(value)), { schemaVersion: 1, sections: [
    { type: "list", title: "Tools", items: [{ text: "TypeScript" }] },
    { type: "entries", title: "Selected work", entries: [{ heading: { text: "Queue service" }, highlights: [{ text: "Built retries" }] }] },
  ] });
});

test("documented examples validate with optional entry fields omitted", () => {
  for (const name of ["minimal", "custom"]) {
    const value = JSON.parse(readFileSync(new URL(`../../docs/examples/cv/${name}.json`, import.meta.url), "utf8"));
    assert.deepEqual(cvSchema.parse(value), value);
    assert.equal(exportCv(value).includes('"evidence"'), false);
  }
});

test("malformed content and unapproved metadata fail validation and export", () => {
  const value = { schemaVersion: 1, sections: [{ type: "text", title: "Summary", content: { text: "Engineer", evidence: ["p-role"] } }] };
  const invalid = [
    { ...value, schemaVersion: 2 },
    { ...value, sections: [] },
    { ...value, credentials: "secret" },
    { ...value, contact: { email: "invalid" } },
    { ...value, contact: { links: [{ url: "javascript:alert(1)" }] } },
    { ...value, sections: [{ type: "list", title: "Tools", items: [] }] },
    { ...value, sections: [{ type: "entries", title: "Work", entries: [{}] }] },
    ...[
      { text: " " , evidence: ["p-role"] },
      { text: "Engineer" },
      { text: "Engineer", evidence: [] },
      { text: "Engineer", evidence: ["invalid"] },
      { text: "Engineer", evidence: ["p-role"], explanation: "private" },
    ].map(content => ({ ...value, sections: [{ type: "text", title: "Summary", content }] })),
  ];
  for (const document of invalid) {
    assert.equal(cvSchema.safeParse(document).success, false);
    assert.throws(() => exportCv(document));
  }
});
