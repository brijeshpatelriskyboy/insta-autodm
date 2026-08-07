"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { InstagramMediaDisplay } from "@/components/rules/InstagramMediaDisplay";
import {
  api,
  type InstagramMediaItem,
  type KeywordRule,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import { formatMediaOptionLabel } from "@/lib/instagram-media-display";

interface KeywordRuleFormProps {
  initial?: KeywordRule;
  onSubmit: (data: {
    keyword: string;
    dmMessage: string;
    isActive: boolean;
    instagramMediaId: string | null;
  }) => Promise<void>;
  onCancel: () => void;
}

interface FormErrors {
  keyword?: string;
  dmMessage?: string;
}

function validate(keyword: string, dmMessage: string): FormErrors {
  const errors: FormErrors = {};

  if (!keyword.trim()) {
    errors.keyword = "Keyword is required";
  } else if (keyword.trim().length > 50) {
    errors.keyword = "Keyword must be 50 characters or less";
  }

  if (!dmMessage.trim()) {
    errors.dmMessage = "DM message is required";
  } else if (dmMessage.trim().length > 1000) {
    errors.dmMessage = "Message must be 1000 characters or less";
  }

  return errors;
}

export function KeywordRuleForm({ initial, onSubmit, onCancel }: KeywordRuleFormProps) {
  const [keyword, setKeyword] = useState(initial?.keyword ?? "");
  const [dmMessage, setDmMessage] = useState(initial?.dmMessage ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [instagramMediaId, setInstagramMediaId] = useState<string | null>(
    initial?.instagramMediaId ?? null,
  );
  const [mediaItems, setMediaItems] = useState<InstagramMediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    setKeyword(initial?.keyword ?? "");
    setDmMessage(initial?.dmMessage ?? "");
    setIsActive(initial?.isActive ?? true);
    setInstagramMediaId(initial?.instagramMediaId ?? null);
    setErrors({});
    setSubmitError("");
  }, [
    initial?.id,
    initial?.keyword,
    initial?.dmMessage,
    initial?.isActive,
    initial?.instagramMediaId,
  ]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let cancelled = false;
    setMediaLoading(true);
    setMediaError("");
    api
      .getInstagramMedia(token, 25)
      .then((res) => {
        if (!cancelled) setMediaItems(res.media);
      })
      .catch((err) => {
        if (!cancelled) {
          setMediaError(
            err instanceof Error
              ? err.message
              : "Could not load Instagram posts. You can still save a global rule.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setMediaLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedMedia =
    instagramMediaId == null
      ? null
      : mediaItems.find((m) => m.id === instagramMediaId) ??
        (initial?.instagramMediaId === instagramMediaId
          ? {
              id: initial.instagramMediaId,
              caption: initial.mediaCaption,
              mediaType: initial.mediaType,
              thumbnailUrl: initial.mediaThumbnailUrl,
              permalink: initial.mediaPermalink,
              timestamp: initial.mediaTimestamp,
            }
          : null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");

    const validationErrors = validate(keyword, dmMessage);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      await onSubmit({ keyword, dmMessage, isActive, instagramMediaId });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save rule");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {submitError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}

      <Input
        label="Keyword"
        placeholder="e.g. GUIDE"
        value={keyword}
        onChange={(e) => {
          setKeyword(e.target.value.toUpperCase());
          if (errors.keyword) setErrors((prev) => ({ ...prev, keyword: undefined }));
        }}
        error={errors.keyword}
        hint="Commenters must type this keyword to trigger the DM."
      />

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">Instagram post</label>
        <p className="text-xs text-slate-500">
          Attach this keyword to one post/Reel, or keep it global for all posts. The same keyword
          can be used on different posts.
        </p>
        <select
          value={instagramMediaId ?? ""}
          onChange={(e) => setInstagramMediaId(e.target.value ? e.target.value : null)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          disabled={mediaLoading}
        >
          <option value="">All posts (global)</option>
          {mediaItems.map((item) => (
            <option key={item.id} value={item.id}>
              {formatMediaOptionLabel(item.mediaType, item.caption, item.id)}
            </option>
          ))}
        </select>
        {mediaLoading && <p className="text-xs text-slate-500">Loading recent posts…</p>}
        {mediaError && <p className="text-xs text-amber-700">{mediaError}</p>}
        {selectedMedia && (
          <InstagramMediaDisplay
            thumbnailUrl={selectedMedia.thumbnailUrl}
            caption={selectedMedia.caption}
            mediaType={selectedMedia.mediaType}
            timestamp={selectedMedia.timestamp}
            permalink={selectedMedia.permalink}
          />
        )}
        {!selectedMedia && instagramMediaId == null && (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Global rule — matches this keyword on any post.
          </p>
        )}
      </div>

      <Textarea
        label="DM Message"
        placeholder="Message sent when someone comments this keyword..."
        value={dmMessage}
        onChange={(e) => {
          setDmMessage(e.target.value);
          if (errors.dmMessage) setErrors((prev) => ({ ...prev, dmMessage: undefined }));
        }}
        rows={4}
        error={errors.dmMessage}
        hint={`${dmMessage.length}/1000 characters`}
      />

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <div>
          <p className="text-sm font-medium text-slate-900">Active</p>
          <p className="text-xs text-slate-500">Only active rules will trigger automations</p>
        </div>
      </label>

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
        <Button type="button" variant="secondary" onClick={onCancel} className="sm:flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={loading} className="sm:flex-1">
          {loading ? "Saving..." : initial ? "Update Rule" : "Create Rule"}
        </Button>
      </div>
    </form>
  );
}
