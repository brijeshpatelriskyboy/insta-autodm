"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/providers/ToastProvider";
import { KeywordRuleForm } from "@/components/rules/KeywordRuleForm";
import { KeywordRulesTable } from "@/components/rules/KeywordRulesTable";
import { api, ApiError, type KeywordRule } from "@/lib/api";
import { getToken } from "@/lib/auth";

export default function RulesPage() {
  const toast = useToast();
  const [rules, setRules] = useState<KeywordRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<KeywordRule | null>(null);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<KeywordRule | null>(null);

  const loadRules = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const data = await api.getKeywordRules(token);
      setRules(data);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to load keyword rules",
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const filteredRules = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rules;
    return rules.filter(
      (rule) =>
        rule.keyword.toLowerCase().includes(query) ||
        rule.dmMessage.toLowerCase().includes(query),
    );
  }, [rules, search]);

  async function handleCreate(data: {
    keyword: string;
    dmMessage: string;
    isActive: boolean;
  }) {
    const token = getToken();
    if (!token) return;

    await api.createKeywordRule(token, data);
    setShowForm(false);
    toast.success(`Created rule "${data.keyword.toUpperCase()}"`);
    await loadRules();
  }

  async function handleUpdate(data: {
    keyword: string;
    dmMessage: string;
    isActive: boolean;
  }) {
    const token = getToken();
    if (!token || !editingRule) return;

    const updated = await api.updateKeywordRule(token, editingRule.id, data);
    setEditingRule(null);
    toast.success(`Updated rule "${updated.keyword}"`);
    await loadRules();
  }

  async function confirmDelete() {
    if (!ruleToDelete) return;

    const token = getToken();
    if (!token) return;

    setDeletingId(ruleToDelete.id);

    try {
      await api.deleteKeywordRule(token, ruleToDelete.id);

      const deletedId = ruleToDelete.id;

      setRules((prev) => prev.filter((rule) => rule.id !== deletedId));

      if (editingRule?.id === deletedId) {
        setEditingRule(null);
      }

      toast.success("Rule deleted");
      setRuleToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to delete rule",
      );
    } finally {
      setDeletingId(null);
    }
  }

  function openCreateForm() {
    setEditingRule(null);
    setShowForm(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Keyword Rules"
        description="When someone comments a keyword, the matching DM is sent automatically."
        action={
          !showForm && !editingRule ? (
            <Button onClick={openCreateForm}>
              <Plus className="h-4 w-4" />
              Add Rule
            </Button>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-brand-200/80 bg-brand-50/50 px-4 py-3 text-sm text-brand-900">
        Rules are ready and will become active once Instagram is connected.
      </div>

      {(showForm || editingRule) && (
        <Card title={editingRule ? "Edit Rule" : "New Rule"}>
          <KeywordRuleForm
            key={editingRule?.id ?? "new"}
            initial={editingRule ?? undefined}
            onSubmit={editingRule ? handleUpdate : handleCreate}
            onCancel={() => {
              setShowForm(false);
              setEditingRule(null);
            }}
          />
        </Card>
      )}

      {!showForm && !editingRule && (
        <div className="max-w-md">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search keywords or messages..."
          />
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={4} />
      ) : (
        <KeywordRulesTable
          rules={filteredRules}
          deletingId={deletingId}
          onEdit={(rule) => {
            setShowForm(false);
            setEditingRule(rule);
          }}
          onDelete={setRuleToDelete}
          onCreate={openCreateForm}
        />
      )}

      <ConfirmDialog
        open={!!ruleToDelete}
        onClose={() => setRuleToDelete(null)}
        onConfirm={confirmDelete}
        title={`Delete "${ruleToDelete?.keyword}"?`}
        description="This keyword rule will be permanently removed from your automations."
        confirmLabel="Delete Rule"
        loading={!!deletingId}
      />
    </div>
  );
}
