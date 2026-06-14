"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { KeywordRule } from "@/lib/api";

interface KeywordRulesTableProps {
  rules: KeywordRule[];
  deletingId?: string | null;
  onEdit: (rule: KeywordRule) => void;
  onDelete: (rule: KeywordRule) => void;
  onCreate?: () => void;
}

export function KeywordRulesTable({
  rules,
  deletingId,
  onEdit,
  onDelete,
  onCreate,
}: KeywordRulesTableProps) {
  if (rules.length === 0) {
    return (
      <EmptyState
        title="No keyword rules yet"
        description="Create your first automation rule. When someone comments a keyword on your post, we'll send them a DM instantly."
        actionLabel="Create your first rule"
        onAction={onCreate}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Keyword
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                DM Message
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Status
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.map((rule) => (
              <tr
                key={rule.id}
                className="transition-colors hover:bg-slate-50/80"
              >
                <td className="whitespace-nowrap px-5 py-4">
                  <span className="inline-flex rounded-lg bg-brand-50 px-2.5 py-1 text-sm font-semibold text-brand-700">
                    {rule.keyword}
                  </span>
                </td>
                <td className="max-w-xs px-5 py-4 text-sm text-slate-600 lg:max-w-md">
                  <p className="line-clamp-2">{rule.dmMessage}</p>
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <Badge active={rule.isActive} />
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(rule)}
                      aria-label={`Edit ${rule.keyword}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={deletingId === rule.id}
                      onClick={() => onDelete(rule)}
                      aria-label={`Delete ${rule.keyword}`}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
