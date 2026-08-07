"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setProgress({ ...emptyProgress, loading: false });
      return;
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

  return progress;
}
