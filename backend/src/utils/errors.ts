export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    /** Optional Meta Graph API error code when the failure originated from Meta. */
    public metaCode?: number | null,
    /** Optional Meta Graph API error message (never contains tokens). */
    public metaMessage?: string | null,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** True when the error carries a Meta Graph API code/message pair. */
export function getMetaErrorDetails(error: unknown): {
  metaCode: number | null;
  metaMessage: string | null;
} {
  if (error instanceof AppError) {
    return {
      metaCode: typeof error.metaCode === "number" ? error.metaCode : null,
      metaMessage: error.metaMessage?.trim() || error.message || null,
    };
  }
  if (error instanceof Error) {
    return { metaCode: null, metaMessage: error.message || null };
  }
  return { metaCode: null, metaMessage: null };
}
