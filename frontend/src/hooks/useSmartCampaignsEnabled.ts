"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { parseFeatureFlags } from "@/lib/features";

/**
 * Backend is source of truth for SMART_CAMPAIGNS_ENABLED.
 * Defaults to false until the features endpoint confirms true.
 */
export function useSmartCampaignsEnabled(): {
  enabled: boolean;
  loading: boolean;
} {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    if (!token) {
      setEnabled(false);
      setLoading(false);
      return;
    }

    api
      .getFeatures(token)
      .then((payload) => {
        if (!cancelled) {
          setEnabled(parseFeatureFlags(payload).smartCampaigns);
        }
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { enabled, loading };
}
