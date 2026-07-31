"use client";

import { useEffect, useState } from "react";

/** True only after client mount — use to defer browser-only UI safely past hydration. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
