import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONSENT_REQUIRED_MESSAGE,
  GENERIC_FORGOT_PASSWORD_MESSAGE,
  INVALID_OR_EXPIRED_RESET_MESSAGE,
  friendlyResetPasswordError,
  getResetTokenFromQuery,
  validateChangePasswordForm,
  validateForgotPasswordForm,
  validateRegistrationConsent,
  validateResetPasswordForm,
} from "./auth-forms";

describe("forgot password UI validation", () => {
  it("requires a valid email", () => {
    assert.equal(validateForgotPasswordForm(""), "Email is required");
    assert.equal(validateForgotPasswordForm("not-an-email"), "Enter a valid email address");
    assert.equal(validateForgotPasswordForm("ada@example.com"), null);
  });

  it("uses generic success copy that does not reveal account existence", () => {
    assert.equal(
      GENERIC_FORGOT_PASSWORD_MESSAGE,
      "If an account exists for that email, we've sent password reset instructions.",
    );
  });
});

describe("reset password UI", () => {
  it("reads the token from the query string", () => {
    const params = new URLSearchParams("token=abc_reset_token");
    assert.equal(getResetTokenFromQuery(params), "abc_reset_token");
    assert.equal(getResetTokenFromQuery(new URLSearchParams("")), "");
  });

  it("shows a clear invalid or expired error state", () => {
    assert.equal(
      friendlyResetPasswordError("Invalid or expired reset token"),
      INVALID_OR_EXPIRED_RESET_MESSAGE,
    );
    assert.equal(
      friendlyResetPasswordError("This reset link is missing or invalid."),
      INVALID_OR_EXPIRED_RESET_MESSAGE,
    );
  });

  it("rejects a missing token and mismatched passwords", () => {
    assert.equal(
      validateResetPasswordForm({
        token: "",
        newPassword: "new-password-9",
        confirmPassword: "new-password-9",
      }),
      "This reset link is missing or invalid.",
    );
    assert.equal(
      validateResetPasswordForm({
        token: "abc",
        newPassword: "short",
        confirmPassword: "short",
      }),
      "New password must be at least 8 characters",
    );
    assert.equal(
      validateResetPasswordForm({
        token: "abc",
        newPassword: "new-password-9",
        confirmPassword: "other-password",
      }),
      "Passwords do not match",
    );
    assert.equal(
      validateResetPasswordForm({
        token: "abc",
        newPassword: "new-password-9",
        confirmPassword: "new-password-9",
      }),
      null,
    );
  });
});

describe("change password UI validation", () => {
  it("requires current password, policy, and confirmation", () => {
    assert.equal(
      validateChangePasswordForm({
        currentPassword: "",
        newPassword: "new-password-9",
        confirmPassword: "new-password-9",
      }),
      "Current password is required",
    );
    assert.equal(
      validateChangePasswordForm({
        currentPassword: "old-password-9",
        newPassword: "old-password-9",
        confirmPassword: "old-password-9",
      }),
      "New password must be different from the current password",
    );
    assert.equal(
      validateChangePasswordForm({
        currentPassword: "old-password-9",
        newPassword: "new-password-9",
        confirmPassword: "mismatch",
      }),
      "Passwords do not match",
    );
    assert.equal(
      validateChangePasswordForm({
        currentPassword: "old-password-9",
        newPassword: "new-password-9",
        confirmPassword: "new-password-9",
      }),
      null,
    );
  });
});

describe("registration consent checkbox", () => {
  it("is required", () => {
    assert.equal(validateRegistrationConsent(false), CONSENT_REQUIRED_MESSAGE);
    assert.equal(validateRegistrationConsent(true), null);
  });
});
