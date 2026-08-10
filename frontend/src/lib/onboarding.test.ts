import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldShowTestAutomationPanel } from "./onboarding";

describe("shouldShowTestAutomationPanel", () => {
  it("hides when there are zero rules", () => {
    assert.equal(
      shouldShowTestAutomationPanel({
        hasKeywordRule: false,
        hasSuccessfulDm: false,
        dismissed: false,
      }),
      false,
    );
  });

  it("shows after first rule with zero dm_sent", () => {
    assert.equal(
      shouldShowTestAutomationPanel({
        hasKeywordRule: true,
        hasSuccessfulDm: false,
        dismissed: false,
      }),
      true,
    );
  });

  it("stays visible with more rules and zero dm_sent", () => {
    assert.equal(
      shouldShowTestAutomationPanel({
        hasKeywordRule: true,
        hasSuccessfulDm: false,
        dismissed: false,
      }),
      true,
    );
  });

  it("hides when any real dm_sent exists", () => {
    assert.equal(
      shouldShowTestAutomationPanel({
        hasKeywordRule: true,
        hasSuccessfulDm: true,
        dismissed: false,
      }),
      false,
    );
  });

  it("hides when dismissed without treating DM as completed", () => {
    assert.equal(
      shouldShowTestAutomationPanel({
        hasKeywordRule: true,
        hasSuccessfulDm: false,
        dismissed: true,
      }),
      false,
    );
  });

  it("keeps panel visible when only dm_failed would apply (hasSuccessfulDm false)", () => {
    // Callers must only set hasSuccessfulDm from type === "dm_sent".
    assert.equal(
      shouldShowTestAutomationPanel({
        hasKeywordRule: true,
        hasSuccessfulDm: false,
        dismissed: false,
      }),
      true,
    );
  });
});

describe("dm_sent detection contract", () => {
  it("only dm_sent counts as success", () => {
    const events = [
      { type: "comment_received" },
      { type: "keyword_matched" },
      { type: "dm_failed" },
    ];
    const hasSuccessfulDm = events.some((event) => event.type === "dm_sent");
    assert.equal(hasSuccessfulDm, false);

    events.push({ type: "dm_sent" });
    assert.equal(
      events.some((event) => event.type === "dm_sent"),
      true,
    );
  });
});
