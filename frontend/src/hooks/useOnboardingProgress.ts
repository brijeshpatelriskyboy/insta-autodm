"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

export type OnboardingProgress = {
  loading: boolean;
  instagramConnected: boolean;
  hasKeywordRule: boolean;
  hasSuccessfulDm: boolean;
  /** True when the user has completed at least one checklist step. */
  isReturning: boolean;
};

const emptyProgress: OnboardingProgress = {
  loading: true,
  instagramConnected: false,
  hasKeywordRule: false,
  hasSuccessfulDm: false,
  isReturning: false,
};

export function useOnboardingProgress(): OnboardingProgress {
  const [progress, setProgress] = useState<OnboardingProgress>(emptyProgress);

  const loadProgress = useCallback(() => {
    const token = getToken();
    if (!token) {
      setProgress({ ...emptyProgress, loading: false });
      return () => {};
    }

    let cancelled = false;

    Promise.allSettled([
      api.getInstagramIntegrationStatus(token),
      api.getKeywordRules(token),
      api.getActivityEvents(token),
    ]).then(([statusResult, rulesResult, activityResult]) => {
      if (cancelled) return;

      const instagramConnected =
        statusResult.status === "fulfilled" && statusResult.value.connected;
      const hasKeywordRule =
        rulesResult.status === "fulfilled" && rulesResult.value.length > 0;
      // Only real successes hide the test panel — dm_failed must not count.
      const hasSuccessfulDm =
        activityResult.status === "fulfilled" &&
        activityResult.value.some((event) => event.type === "dm_sent");

      setProgress({
        loading: false,
        instagramConnected,
        hasKeywordRule,
        hasSuccessfulDm,
        isReturning: instagramConnected || hasKeywordRule || hasSuccessfulDm,
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = loadProgress();
    return cancel;
  }, [loadProgress]);

  // Refetch when the user returns to the tab (e.g. after checking Activity for dm_sent).
  useEffect(() => {
    function onFocus() {
      loadProgress();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadProgress]);

  return progress;
}
