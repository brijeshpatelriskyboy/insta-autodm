export const DATA_DELETION_LAST_UPDATED = "August 2026";

export const DATA_DELETION_SECTIONS = [
  "in-app account deletion",
  "Instagram disconnect",
  "Meta data-deletion callback",
  "what Comment2DM deletes",
  "what may remain outside Comment2DM",
  "Stripe subscription cancellation before delete",
  "support contact",
] as const;

export function dataDeletionStatusCopy(status: string | undefined): string {
  switch (status) {
    case "completed":
      return "Comment2DM finished removing Instagram-sourced data for this request.";
    case "not_found":
      return "Comment2DM did not find a connected Instagram integration for the Meta user id in this request. No Instagram-sourced records were changed.";
    case "received":
      return "Comment2DM received this deletion request.";
    default:
      return "This confirmation code was not found.";
  }
}
