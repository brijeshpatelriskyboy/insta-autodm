"use client";

import {
  formatMediaCaption,
  formatMediaTimestamp,
  formatMediaTypeLabel,
} from "@/lib/instagram-media-display";

export type InstagramMediaDisplayProps = {
  thumbnailUrl: string | null | undefined;
  mediaType: string | null | undefined;
  caption: string | null | undefined;
  /** ISO string or Date from Graph / cached KeywordRule.mediaTimestamp */
  timestamp?: string | Date | null;
  permalink?: string | null;
  /** Slightly denser layout for table cells */
  compact?: boolean;
};

/**
 * Shared hierarchy for Rules form preview + Rules table:
 * Thumbnail → Media type → Caption → Date & time → View on Instagram
 */
export function InstagramMediaDisplay({
  thumbnailUrl,
  mediaType,
  caption,
  timestamp,
  permalink,
  compact = false,
}: InstagramMediaDisplayProps) {
  const typeLabel = formatMediaTypeLabel(mediaType);
  const title = formatMediaCaption(caption, mediaType);
  // Always show a date line so missing cache never looks like a load failure.
  const when = formatMediaTimestamp(timestamp ?? null) ?? "Date unavailable";
  const thumbSize = compact ? "h-12 w-12" : "h-16 w-16";

  return (
    <div className={`flex gap-3 ${compact ? "max-w-xs" : "rounded-xl border border-slate-200 bg-white p-3"}`}>
      <div className={`${thumbSize} shrink-0 overflow-hidden rounded-lg bg-slate-100`}>
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
            No image
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[11px] font-semibold text-slate-500">{typeLabel}</p>
        <p className={`line-clamp-2 font-medium text-slate-900 ${compact ? "text-sm" : "text-sm"}`}>
          {title}
        </p>
        <p className="text-xs text-slate-500">{when}</p>
        {permalink && (
          <a
            href={permalink}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-[11px] font-medium text-brand-600 hover:underline"
          >
            View on Instagram ↗
          </a>
        )}
      </div>
    </div>
  );
}
