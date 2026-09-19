import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONSENT_REQUIRED_MESSAGE,
  GENERIC_FORGOT_PASSWORD_MESSAGE,
  EMAIL_DELIVERY_NOT_ENABLED_MESSAGE,
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

  it("uses generic copy that does not claim an email was sent", () => {
    assert.match(GENERIC_FORGOT_PASSWORD_MESSAGE, /if an account exists/i);
    assert.doesNotMatch(GENERIC_FORGOT_PASSWORD_MESSAGE, /sent an email|email has been sent/i);
    assert.match(EMAIL_DELIVERY_NOT_ENABLED_MESSAGE, /not enabled/i);
  });
});

describe("reset password UI validation", () => {
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
