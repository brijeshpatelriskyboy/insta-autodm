/**
 * Creator-friendly Instagram media labels for Rules UI.
 * Display-only — never used for matching or webhook logic.
 */

export type InstagramMediaKind = "reel" | "post" | "carousel" | "unknown";

export function getMediaKind(mediaType: string | null | undefined): InstagramMediaKind {
  switch ((mediaType ?? "").trim().toUpperCase()) {
    case "VIDEO":
      return "reel";
    case "IMAGE":
      return "post";
    case "CAROUSEL_ALBUM":
      return "carousel";
    default:
      return "unknown";
  }
}

/** e.g. "🎥 Reel" */
export function formatMediaTypeLabel(mediaType: string | null | undefined): string {
  switch (getMediaKind(mediaType)) {
    case "reel":
      return "🎥 Reel";
    case "post":
      return "🖼️ Post";
    case "carousel":
      return "📚 Carousel";
    default:
      return "🖼️ Post";
  }
}

/** Caption line, or Untitled Reel / Post / Carousel when empty. */
export function formatMediaCaption(
  caption: string | null | undefined,
  mediaType: string | null | undefined,
): string {
  const trimmed = caption?.trim();
  if (trimmed) return trimmed;

  switch (getMediaKind(mediaType)) {
    case "reel":
      return "Untitled Reel";
    case "carousel":
      return "Untitled Carousel";
    case "post":
    default:
      return "Untitled Post";
  }
}

/**
 * Format Instagram media timestamp in the browser's local timezone.
 * Pattern: d MMM yyyy • h:mm a  (e.g. "7 Aug 2026 • 8:42 PM")
 * Returns null when timestamp is missing/invalid (old rules).
 */
export function formatMediaTimestamp(
  timestamp: string | Date | null | undefined,
): string | null {
  if (timestamp == null || timestamp === "") return null;

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  const datePart = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);

  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  return `${datePart} • ${timePart}`;
}

/** Compact option label for the post picker select. */
export function formatMediaOptionLabel(
  mediaType: string | null | undefined,
  caption: string | null | undefined,
  fallbackId?: string,
): string {
  const typeLabel = formatMediaTypeLabel(mediaType);
  const title = caption?.trim() || formatMediaCaption(null, mediaType);
  const short = title.slice(0, 60);
  if (!caption?.trim() && fallbackId) {
    return `${typeLabel} — ${short}`;
  }
  return `${typeLabel} — ${short}`;
}
