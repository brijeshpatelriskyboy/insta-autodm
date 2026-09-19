export const PASSWORD_MIN_LENGTH = 8;

export const GENERIC_FORGOT_PASSWORD_MESSAGE =
  "If an account exists for that email, reset instructions can be sent.";

export const EMAIL_DELIVERY_NOT_ENABLED_MESSAGE =
  "Email delivery is not enabled in this beta. A transactional email provider must be connected before password-reset emails can be sent.";

export const CONSENT_REQUIRED_MESSAGE =
  "You must agree to the Terms of Service and Privacy Policy.";

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) {
    return "Email is required";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "Enter a valid email address";
  }
  return null;
}

export function validatePassword(password: string, label = "Password"): string | null {
  if (!password) {
    return `${label} is required`;
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `${label} must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  return null;
}

export function validateRegistrationConsent(accepted: boolean): string | null {
  return accepted ? null : CONSENT_REQUIRED_MESSAGE;
}

export function validateForgotPasswordForm(email: string): string | null {
  return validateEmail(email);
}

export function validateResetPasswordForm(input: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}): string | null {
  if (!input.token.trim()) {
    return "This reset link is missing or invalid.";
  }
  const passwordError = validatePassword(input.newPassword, "New password");
  if (passwordError) {
    return passwordError;
  }
  if (input.newPassword !== input.confirmPassword) {
    return "Passwords do not match";
  }
  return null;
}

export function validateChangePasswordForm(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): string | null {
  if (!input.currentPassword) {
    return "Current password is required";
  }
  const passwordError = validatePassword(input.newPassword, "New password");
  if (passwordError) {
    return passwordError;
  }
  if (input.newPassword === input.currentPassword) {
    return "New password must be different from the current password";
  }
  if (input.newPassword !== input.confirmPassword) {
    return "Passwords do not match";
  }
  return null;
}
