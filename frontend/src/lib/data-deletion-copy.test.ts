import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DATA_DELETION_SECTIONS,
  dataDeletionStatusCopy,
} from "./data-deletion-copy";

describe("public data-deletion page copy", () => {
  it("covers in-app deletion, Instagram/Meta handling, retention limits, and support", () => {
    assert.ok(DATA_DELETION_SECTIONS.includes("in-app account deletion"));
    assert.ok(DATA_DELETION_SECTIONS.includes("Instagram disconnect"));
    assert.ok(DATA_DELETION_SECTIONS.includes("Meta data-deletion callback"));
    assert.ok(DATA_DELETION_SECTIONS.includes("what Comment2DM deletes"));
    assert.ok(DATA_DELETION_SECTIONS.includes("what may remain outside Comment2DM"));
    assert.ok(DATA_DELETION_SECTIONS.includes("support contact"));
  });

  it("explains Meta callback status without promising extra legal outcomes", () => {
    assert.match(dataDeletionStatusCopy("completed"), /Instagram-sourced data/);
    assert.match(dataDeletionStatusCopy("not_found"), /did not find/);
    assert.match(dataDeletionStatusCopy("missing"), /not found/);
  });
});
