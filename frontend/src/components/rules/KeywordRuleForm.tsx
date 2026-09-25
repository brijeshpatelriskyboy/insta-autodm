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
    triggerType: "keyword" | "any_comment";
    dmMessage: string;
    isActive: boolean;
    publicReplyEnabled: boolean;
    publicReplyMessage: string | null;
    instagramMediaId: string | null;
  }) => Promise<void>;
  onCancel: () => void;
}

interface FormErrors {
  keyword?: string;
  dmMessage?: string;
}

function validate(
  triggerType: "keyword" | "any_comment",
  keyword: string,
  dmMessage: string,
): FormErrors {
  const errors: FormErrors = {};

  if (triggerType === "keyword" && !keyword.trim()) {
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
  const [triggerType, setTriggerType] = useState<"keyword" | "any_comment">(
    initial?.triggerType ?? "keyword",
  );
  const [dmMessage, setDmMessage] = useState(initial?.dmMessage ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [publicReplyEnabled, setPublicReplyEnabled] = useState(initial?.publicReplyEnabled ?? false);
  const [publicReplyMessage, setPublicReplyMessage] = useState(
    initial?.publicReplyMessage ?? "Thanks! We sent the details to your DM 📩",
  );
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
    setTriggerType(initial?.triggerType ?? "keyword");
    setDmMessage(initial?.dmMessage ?? "");
    setIsActive(initial?.isActive ?? true);
    setPublicReplyEnabled(initial?.publicReplyEnabled ?? false);
    setPublicReplyMessage(initial?.publicReplyMessage ?? "Thanks! We sent the details to your DM 📩");
    setInstagramMediaId(initial?.instagramMediaId ?? null);
    setErrors({});
    setSubmitError("");
  }, [
    initial?.id,
    initial?.keyword,
    initial?.triggerType,
    initial?.dmMessage,
    initial?.isActive,
    initial?.publicReplyEnabled,
    initial?.publicReplyMessage,
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

    const validationErrors = validate(triggerType, keyword, dmMessage);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      await onSubmit({
        keyword,
        triggerType,
        dmMessage,
        isActive,
        publicReplyEnabled,
        publicReplyMessage: publicReplyEnabled ? publicReplyMessage : null,
        instagramMediaId,
      });
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

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Trigger type</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["keyword", "any_comment"] as const).map((type) => (
            <label key={type} className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 px-4 py-3">
              <input type="radio" name="triggerType" value={type} checked={triggerType === type} onChange={() => setTriggerType(type)} />
              <span>
                <span className="block text-sm font-medium text-slate-900">{type === "keyword" ? "Specific keyword" : "Any comment"}</span>
                <span className="block text-xs text-slate-500">{type === "keyword" ? "Send when the comment contains your keyword." : "Send when no specific keyword rule matches."}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {triggerType === "keyword" && (
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
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">Instagram post</label>
        <p className="text-xs text-slate-500">
          Apply this trigger to one post/Reel, or keep it global for all posts.
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
            Global rule — applies this trigger on any post.
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

      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={publicReplyEnabled}
            onChange={(e) => setPublicReplyEnabled(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <div>
            <p className="text-sm font-medium text-slate-900">Reply publicly after the DM is sent</p>
            <p className="text-xs text-slate-500">Adds a short reply beneath the comment so the customer knows to check their DMs.</p>
          </div>
        </label>
        {publicReplyEnabled && (
          <Textarea
            label="Public reply"
            value={publicReplyMessage}
            onChange={(e) => setPublicReplyMessage(e.target.value)}
            rows={2}
            maxLength={300}
            required
            hint={`${publicReplyMessage.length}/300 characters`}
          />
        )}
      </div>

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
