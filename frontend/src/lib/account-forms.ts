export const ACCOUNT_DELETE_CONFIRMATION = "DELETE";

export function validateDeleteAccountForm(input: {
  currentPassword: string;
  confirmation: string;
}): string | null {
  if (!input.currentPassword) {
    return "Current password is required";
  }
  if (input.confirmation.trim() !== ACCOUNT_DELETE_CONFIRMATION) {
    return `Type ${ACCOUNT_DELETE_CONFIRMATION} to confirm account deletion`;
  }
  return null;
}

/** After the API confirms deletion, drop local auth and send the user to login. */
export function accountDeletionClientOutcome(): {
  clearAuth: true;
  redirectTo: "/login";
} {
  return { clearAuth: true, redirectTo: "/login" };
}
