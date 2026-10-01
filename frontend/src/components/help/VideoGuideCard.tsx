"use client";

import { PlayCircle, ChevronDown } from "lucide-react";

type VideoGuideCardProps = {
  title: string;
  description: string;
  src: string;
  duration?: string;
};

export function VideoGuideCard({
  title,
  description,
  src,
  duration,
}: VideoGuideCardProps) {
  return (
    <details className="group overflow-hidden rounded-2xl border-2 border-[#8545ef] bg-gradient-to-br from-[#f6f3ff] via-white to-[#eee6ff] shadow-[0_5px_0_#6a2fd0]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#8545ef] text-white shadow-[0_3px_0_#4b1fa0]">
            <PlayCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{title}</p>
            <p className="mt-0.5 text-sm text-slate-600">{description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-purple-700">
          {duration && <span>{duration}</span>}
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="border-t border-purple-200 bg-[#f6f3ff] p-4">
        <div className="mx-auto max-w-[320px] overflow-hidden rounded-2xl border border-purple-300 bg-[#f6f3ff]">
          <video
            className="aspect-[9/16] w-full bg-[#f6f3ff] object-cover"
            controls
            preload="metadata"
            playsInline
            aria-label={title}
          >
            <source src={src} type="video/mp4" />
            Your browser does not support video playback.
          </video>
        </div>
      </div>
    </details>
  );
}
