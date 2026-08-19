import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACCOUNT_DELETE_CONFIRMATION,
  accountDeletionClientOutcome,
  validateDeleteAccountForm,
} from "./account-forms";

describe("Danger Zone account deletion", () => {
  it("requires the current password and exact DELETE confirmation", () => {
    assert.equal(
      validateDeleteAccountForm({ currentPassword: "", confirmation: "DELETE" }),
      "Current password is required",
    );
    assert.equal(
      validateDeleteAccountForm({ currentPassword: "secret12", confirmation: "delete" }),
      `Type ${ACCOUNT_DELETE_CONFIRMATION} to confirm account deletion`,
    );
    assert.equal(
      validateDeleteAccountForm({ currentPassword: "secret12", confirmation: "DELETE " }),
      null,
    );
  });

  it("logs the user out and sends them to login after a successful delete", () => {
    assert.deepEqual(accountDeletionClientOutcome(), {
      clearAuth: true,
      redirectTo: "/login",
    });
  });
});
