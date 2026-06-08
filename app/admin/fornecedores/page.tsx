"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Truck,
  Loader2,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SupplierEditModal } from "@/components/nf/supplier-edit-modal";
import { useCan } from "@/lib/nf-role-context";
import { useToast } from "@/lib/toast-context";
import { apiFetch } from "@/lib/api";
import type { Supplier, ClientEntity } from "@/types";

type ActiveFilter = "active" | "inactive" | "all";
type EntityFilter = "" | ClientEntity;

export default function FornecedoresPage() {
  return (
    <AppShell>
      <FornecedoresContent />
    </AppShell>
  );
}

function FornecedoresContent() {
  const can = useCan();
  const router = useRouter();
  const toast = useToast();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const canSee = can("nf.fornecedores.view");
  const canManage = can("nf.fornecedores.manage");

  // Guard de acesso
  useEffect(() => {
    if (!canSee) {
      router.replace("/");
    }
  }, [canSee, router]);

  // Debounce da busca (300ms)
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (activeFilter === "active") params.set("active", "true");
      else if (activeFilter === "inactive") params.set("active", "false");
      // all: backend default e active=true; pra "todos" chamamos 2x e mergeamos.
      if (entityFilter) params.set("entity", entityFilter);
      if (debouncedSearch) params.set("q", debouncedSearch);

      let items: Supplier[] = [];
      if (activeFilter === "all") {
        const [resTrue, resFalse] = await Promise.all([
          apiFetch(`/suppliers?${withActive(params, "true")}`),
          apiFetch(`/suppliers?${withActive(params, "false")}`)
        ]);
        const a = Array.isArray(resTrue) ? resTrue : resTrue?.items || [];
        const b = Array.isArray(resFalse) ? resFalse : resFalse?.items || [];
        items = [...a, ...b].sort((x, y) =>
          (x.name || "").localeCompare(y.name || "")
        );
      } else {
        const res: { items: Supplier[] } | Supplier[] = await apiFetch(
          `/suppliers?${params.toString()}`
        );
        items = Array.isArray(res) ? res : res?.items || [];
      }
      setSuppliers(items);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar fornecedores.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canSee) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee, activeFilter, entityFilter, debouncedSearch]);

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setModalOpen(true);
  };

  const onSaved = (saved: Supplier) => {
    setModalOpen(false);
    setSuppliers((prev) => {
      const exists = prev.find((s) => s.id === saved.id);
      if (exists) return prev.map((s) => (s.id === saved.id ? saved : s));
      return [saved, ...prev];
    });
    toast.success(editing ? "Fornecedor atualizado." : "Fornecedor criado.");
    setEditing(null);
    // Recarrega pra respeitar os filtros vigentes (o saved pode nao matchar)
    load();
  };

  const toggleActive = async (s: Supplier) => {
    const verb = s.active ? "desativar" : "ativar";
    if (!confirm(`Tem certeza que quer ${verb} "${s.name}"?`)) return;
    setBusyId(s.id);
    try {
      const updated: Supplier = await apiFetch(
        `/suppliers/${s.id}/toggle-active`,
        { method: "PATCH" }
      );
      setSuppliers((prev) =>
        prev.map((x) => (x.id === s.id ? updated : x))
      );
      toast.success(updated.active ? "Fornecedor ativado." : "Fornecedor desativado.");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao alterar status.");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => suppliers, [suppliers]);

  if (!canSee) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
            Cadastro
          </h4>
          <h1 className="text-2xl font-semibold text-foreground">Fornecedores</h1>
          <p className="mt-1 text-sm text-muted">
            Cadastro de fornecedores (entidades que emitem NF a pagar pra Caracol, sem login no sistema).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-border bg-surface p-2 text-muted transition-colors hover:bg-surface/80 disabled:opacity-50"
            title="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {canManage && (
            <button
              onClick={openNew}
              className="flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-black hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Novo fornecedor
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface">
        {/* Toolbar */}
        <div className="flex flex-col items-start gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
          <div className="relative w-full flex-1 sm:w-auto">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary/50"
            />
          </div>

          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value as EntityFilter)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
            aria-label="Filtrar por pais"
          >
            <option value="">Todos os paises</option>
            <option value="BR">Brasil</option>
            <option value="LLC">Exterior</option>
          </select>

          <div className="flex items-center gap-1">
            {(
              [
                { v: "active", l: "Ativos" },
                { v: "inactive", l: "Inativos" },
                { v: "all", l: "Todos" }
              ] as Array<{ v: ActiveFilter; l: string }>
            ).map((opt) => (
              <button
                key={opt.v}
                onClick={() => setActiveFilter(opt.v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeFilter === opt.v
                    ? "bg-primary text-black"
                    : "bg-background text-muted hover:text-foreground"
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {[
                  "Nome",
                  "Tax ID",
                  "Pais",
                  "Moeda",
                  "Contato",
                  "Status",
                  "Acoes"
                ].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Truck className="mx-auto mb-3 h-8 w-8 opacity-20" />
                    <p className="text-sm text-muted">
                      {debouncedSearch || entityFilter
                        ? "Nenhum fornecedor encontrado com esses filtros."
                        : "Nenhum fornecedor cadastrado. Clique em '+ Novo fornecedor' pra comecar."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((s, i) => (
                  <tr
                    key={s.id}
                    className={`transition-colors hover:bg-background ${
                      i < filtered.length - 1 ? "border-b border-border" : ""
                    } ${!s.active ? "opacity-60" : ""}`}
                  >
                    <td className="px-5 py-4 font-medium text-foreground">{s.name}</td>
                    <td className="px-5 py-4 text-muted">{s.tax_id || "—"}</td>
                    <td className="px-5 py-4 text-muted">{s.default_entity === "BR" ? "Brasil" : "Exterior"}</td>
                    <td className="px-5 py-4 text-muted">{s.default_moeda}</td>
                    <td className="px-5 py-4 text-muted">
                      {s.contact_name || s.contact_email ? (
                        <div className="flex flex-col">
                          {s.contact_name && (
                            <span className="text-foreground">{s.contact_name}</span>
                          )}
                          {s.contact_email && (
                            <span className="text-xs text-muted">{s.contact_email}</span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      {s.active ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-zinc-500/15 px-2 py-0.5 text-xs font-medium text-zinc-300">
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        {canManage && (
                          <>
                            <button
                              onClick={() => openEdit(s)}
                              disabled={busyId === s.id}
                              className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground disabled:opacity-50"
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </button>
                            <button
                              onClick={() => toggleActive(s)}
                              disabled={busyId === s.id}
                              className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground disabled:opacity-50"
                              title={s.active ? "Desativar" : "Ativar"}
                            >
                              <Power className="h-3.5 w-3.5" />
                              {busyId === s.id ? "..." : s.active ? "Desativar" : "Ativar"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <SupplierEditModal
          supplier={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i} className="border-b border-border">
          {Array.from({ length: 7 }).map((__, j) => (
            <td key={j} className="px-5 py-4">
              <div className="h-3 w-full max-w-[140px] animate-pulse rounded bg-border" />
            </td>
          ))}
        </tr>
      ))}
      <tr>
        <td colSpan={7} className="py-2 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
        </td>
      </tr>
    </>
  );
}

// Reusa params atuais mas troca `active`
function withActive(base: URLSearchParams, value: string): string {
  const next = new URLSearchParams(base.toString());
  next.set("active", value);
  return next.toString();
}
