import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldOfferMockInstagramConnect } from "./mockInstagramConnect";

describe("shouldOfferMockInstagramConnect", () => {
  it("hides Connect (Demo) in production builds", () => {
    assert.equal(shouldOfferMockInstagramConnect("production"), false);
  });

  it("offers Connect (Demo) in development and test", () => {
    assert.equal(shouldOfferMockInstagramConnect("development"), true);
    assert.equal(shouldOfferMockInstagramConnect("test"), true);
    assert.equal(shouldOfferMockInstagramConnect(undefined), true);
  });
});
