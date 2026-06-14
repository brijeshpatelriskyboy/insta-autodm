"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { KeywordRule } from "@/lib/api";

interface KeywordRuleFormProps {
  initial?: KeywordRule;
  onSubmit: (data: {
    keyword: string;
    dmMessage: string;
    isActive: boolean;
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
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    setKeyword(initial?.keyword ?? "");
    setDmMessage(initial?.dmMessage ?? "");
    setIsActive(initial?.isActive ?? true);
    setErrors({});
    setSubmitError("");
  }, [initial?.id, initial?.keyword, initial?.dmMessage, initial?.isActive]);

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
      await onSubmit({ keyword, dmMessage, isActive });
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
        hint="Commenters must type this exact keyword to trigger the DM."
      />

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
