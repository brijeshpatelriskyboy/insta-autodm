"use client";

import { useEffect, useState } from "react";

/**
 * Renders a time label only after mount so SSR HTML and the first client paint match.
 * Pass a formatter that may use Date.now() / locale APIs.
 */
export function ClientTime({
  timestamp,
  format,
  className,
  placeholder = "—",
}: {
  timestamp: string;
  format: (timestamp: string) => string;
  className?: string;
  placeholder?: string;
}) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(format(timestamp));
  }, [timestamp, format]);

  return (
    <time className={className} dateTime={timestamp}>
      {label ?? placeholder}
    </time>
  );
}
