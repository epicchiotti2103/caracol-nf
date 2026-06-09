"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Plus, RefreshCw, Tag as TagIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useNfRole } from "@/lib/nf-role-context";
import { useToast } from "@/lib/toast-context";
import { apiFetch } from "@/lib/api";
import type { NfTag } from "@/types";

export default function TagsPage() {
  return (
    <AppShell>
      <TagsContent />
    </AppShell>
  );
}

function TagsContent() {
  const role = useNfRole();
  const router = useRouter();
  const toast = useToast();

  const isAdmin = role === "admin";

  const [tags, setTags] = useState<NfTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Guard de acesso — tags sao admin-only.
  useEffect(() => {
    if (!isAdmin) router.replace("/");
  }, [isAdmin, router]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res: { items: NfTag[] } | NfTag[] = await apiFetch("/nf/tags");
      const items = Array.isArray(res) ? res : res?.items || [];
      setTags(items);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar tags.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const createTag = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created: NfTag = await apiFetch("/nf/tags", {
        method: "POST",
        body: JSON.stringify({ name })
      });
      setTags((prev) =>
        [...prev, created].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "")
        )
      );
      setNewName("");
      toast.success("Tag criada.");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao criar tag.");
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (tag: NfTag) => {
    setBusyId(tag.id);
    try {
      const updated: NfTag = await apiFetch(`/nf/tags/${tag.id}/toggle-active`, {
        method: "PATCH"
      });
      setTags((prev) =>
        prev.map((t) =>
          t.id === tag.id ? { ...t, active: updated?.active ?? !t.active } : t
        )
      );
      toast.success(updated?.active ?? !tag.active ? "Tag ativada." : "Tag desativada.");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao atualizar tag.");
    } finally {
      setBusyId(null);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
            Catalogo
          </h4>
          <h1 className="text-2xl font-semibold text-foreground">Tags de NF</h1>
          <p className="mt-1 text-sm text-muted">
            Cada nota pode receber uma tag. Tags inativas nao aparecem no seletor.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-border bg-surface p-2 text-muted transition-colors hover:bg-surface/80 disabled:opacity-50"
          title="Atualizar"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Criar tag */}
      <div className="mb-6 flex gap-2 rounded-xl border border-border bg-surface p-4">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") createTag();
          }}
          placeholder="Nome da nova tag..."
          className="flex-1 rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary/60"
        />
        <button
          onClick={createTag}
          disabled={creating || !newName.trim()}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Criar
        </button>
      </div>

      {/* Lista */}
      <div className="rounded-xl border border-border bg-surface">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          </div>
        ) : tags.length === 0 ? (
          <div className="py-16 text-center">
            <TagIcon className="mx-auto mb-3 h-8 w-8 opacity-20" />
            <p className="text-sm text-muted">Nenhuma tag cadastrada.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {tags.map((tag) => (
              <li
                key={tag.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <TagIcon
                    className={`h-4 w-4 flex-shrink-0 ${
                      tag.active ? "text-primary" : "text-muted/50"
                    }`}
                  />
                  <span
                    className={`truncate text-sm font-medium ${
                      tag.active ? "text-foreground" : "text-muted line-through"
                    }`}
                  >
                    {tag.name}
                  </span>
                  {!tag.active && (
                    <span className="flex-shrink-0 rounded bg-background px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Inativa
                    </span>
                  )}
                </div>
                <button
                  onClick={() => toggleActive(tag)}
                  disabled={busyId === tag.id}
                  className="flex-shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground disabled:opacity-50"
                >
                  {busyId === tag.id ? "..." : tag.active ? "Desativar" : "Ativar"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
