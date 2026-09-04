"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Filter,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
  X
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { fmtCurrency, fmtDate, fmtDateOnly, fmtRefMonth } from "@/lib/i18n";
import { useNfRole } from "@/lib/nf-role-context";
import { useToast } from "@/lib/toast-context";
import { ReceivableEditModal } from "@/components/nf/receivable-edit-modal";
import { ReceivableReceiveModal } from "@/components/nf/receivable-receive-modal";
import type {
  Client,
  ClientEntity,
  Moeda,
  NfReceivable,
  NfReceivableStatus,
  NfReceivableSummary
} from "@/types";

const STATUS_OPTIONS: { value: NfReceivableStatus | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "pendente", label: "Pendente" },
  { value: "recebida", label: "Recebida" },
  { value: "cancelada", label: "Cancelada" }
];

// Mes ref options (mesmo padrao do dashboard de NF a Pagar)
function makeRefMonthOptions(): { value: string; label: string }[] {
  const today = new Date();
  const opts: { value: string; label: string }[] = [];
  for (let i = -12; i <= 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const value = `${y}-${m}`;
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
    opts.push({ value, label });
  }
  return opts;
}

/**
 * View de NF a Receber — renderizada quando ?view=receber no dashboard.
 *
 * Permissoes (alinhadas com o backend):
 * - admin: ve tudo, cria, edita, marca recebida, cancela
 * - adm_campanha: ve tudo, cria (read-only nas demais acoes mutativas: edita/marca/cancela)
 * - publisher: nao deveria nem ter chegado aqui (escondido na tab)
 */
export function ReceivablesView() {
  const role = useNfRole();
  const toast = useToast();
  const canManage = role === "admin"; // soh admin edita/marca/cancela
  const canCreate = role === "admin" || role === "adm_campanha"; // admin e adm_campanha criam
  const canSee = role === "admin" || role === "adm_campanha";

  const [list, setList] = useState<NfReceivable[]>([]);
  const [summary, setSummary] = useState<NfReceivableSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Filtros
  const [statusFilter, setStatusFilter] = useState<NfReceivableStatus | "todos">("todos");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [entityFilter, setEntityFilter] = useState<"" | ClientEntity>("");
  const [moedaFilter, setMoedaFilter] = useState<"" | Moeda>("");
  const [refMonthFilter, setRefMonthFilter] = useState<string>("");

  // Clientes (pra dropdown de filtro)
  const [clients, setClients] = useState<Client[]>([]);

  // Modals
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<NfReceivable | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiving, setReceiving] = useState<NfReceivable | null>(null);

  const refMonthOptions = useMemo(() => makeRefMonthOptions(), []);

  const serverQuery = useMemo(() => {
    const qs = new URLSearchParams();
    if (statusFilter !== "todos") qs.set("status", statusFilter);
    if (clientFilter) qs.set("client_id", clientFilter);
    if (entityFilter) qs.set("entity", entityFilter);
    if (moedaFilter) qs.set("moeda", moedaFilter);
    if (refMonthFilter) qs.set("reference_month", refMonthFilter);
    return qs.toString();
  }, [statusFilter, clientFilter, entityFilter, moedaFilter, refMonthFilter]);

  const hasActiveFilters =
    statusFilter !== "todos" ||
    !!clientFilter ||
    !!entityFilter ||
    !!moedaFilter ||
    !!refMonthFilter;

  const load = async () => {
    if (!canSee) return;
    setLoading(true);
    setError("");
    try {
      const url = serverQuery
        ? `/nf/receivables?${serverQuery}`
        : "/nf/receivables";
      const summaryUrl = serverQuery
        ? `/nf/receivables/dashboard/summary?${serverQuery}`
        : "/nf/receivables/dashboard/summary";
      const [listRes, summaryRes] = await Promise.all([
        apiFetch(url),
        apiFetch(summaryUrl).catch(() => null)
      ]);
      const items: NfReceivable[] = Array.isArray(listRes)
        ? listRes
        : listRes?.items || [];
      setList(items);
      if (summaryRes) setSummary(summaryRes);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverQuery, canSee]);

  // Carrega clientes uma vez (pra dropdown de filtro)
  useEffect(() => {
    if (!canSee) return;
    (async () => {
      try {
        const res: { items: Client[] } | Client[] = await apiFetch(
          "/clients?active=true"
        );
        const items = Array.isArray(res) ? res : res?.items || [];
        setClients(items);
      } catch {
        // silencioso
      }
    })();
  }, [canSee]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => {
      const inv = (r.invoice_number || "").toLowerCase();
      const cli = (r.client_name || "").toLowerCase();
      const desc = (r.description || "").toLowerCase();
      return inv.includes(q) || cli.includes(q) || desc.includes(q);
    });
  }, [list, search]);

  const openNew = () => {
    setEditing(null);
    setEditOpen(true);
  };
  const openEdit = (r: NfReceivable) => {
    setEditing(r);
    setEditOpen(true);
  };
  const openReceive = (r: NfReceivable) => {
    setReceiving(r);
    setReceiveOpen(true);
  };

  const onSaved = (saved: NfReceivable) => {
    setEditOpen(false);
    setEditing(null);
    setList((prev) => {
      const exists = prev.find((x) => x.id === saved.id);
      if (exists) return prev.map((x) => (x.id === saved.id ? saved : x));
      return [saved, ...prev];
    });
    toast.success(editing ? "NF atualizada." : "NF a Receber criada.");
    load();
  };

  const onReceived = (saved: NfReceivable) => {
    setReceiveOpen(false);
    setReceiving(null);
    setList((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
    toast.success("NF marcada como recebida.");
    load();
  };

  const onCancel = async (r: NfReceivable) => {
    const reason = window.prompt(
      `Cancelar NF ${r.invoice_number || r.id.slice(0, 8)}?\n\nMotivo (opcional):`,
      ""
    );
    if (reason === null) return; // user cancelou
    setBusyId(r.id);
    try {
      const updated: NfReceivable = await apiFetch(
        `/nf/receivables/${r.id}/cancel`,
        {
          method: "POST",
          body: JSON.stringify(reason ? { reason } : {})
        }
      );
      setList((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
      toast.success("NF cancelada.");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao cancelar.");
    } finally {
      setBusyId(null);
    }
  };

  const openPdf = async (r: NfReceivable) => {
    try {
      const res: { url: string } = await apiFetch(
        `/nf/receivables/${r.id}/pdf`
      );
      if (res?.url) window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao gerar link do PDF.");
    }
  };

  const openProof = async (r: NfReceivable) => {
    try {
      const res: { url: string } = await apiFetch(
        `/nf/receivables/${r.id}/proof`
      );
      if (res?.url) window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao gerar link do comprovante.");
    }
  };

  const clearFilters = () => {
    setStatusFilter("todos");
    setClientFilter("");
    setEntityFilter("");
    setMoedaFilter("");
    setRefMonthFilter("");
  };

  if (role && !canSee) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">
          Voce nao tem permissao para acessar NF a Receber.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
            Financeiro
          </h4>
          <h1 className="text-2xl font-semibold text-foreground">
            NF a Receber
          </h1>
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
          {canCreate && (
            <button
              onClick={openNew}
              className="flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-black hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Nova NF
            </button>
          )}
        </div>
      </div>

      {/* Linha de filtros */}
      <div className="mb-4 rounded-xl border border-border bg-surface px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as NfReceivableStatus | "todos")
              }
              className="h-9 min-w-[140px] rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary/50"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Cliente
            </label>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="h-9 min-w-[200px] rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary/50"
            >
              <option value="">Todos</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Pais
            </label>
            <select
              value={entityFilter}
              onChange={(e) =>
                setEntityFilter(e.target.value as "" | ClientEntity)
              }
              className="h-9 min-w-[120px] rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary/50"
            >
              <option value="">Todos</option>
              <option value="BR">Brasil</option>
              <option value="LLC">Exterior</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Moeda
            </label>
            <select
              value={moedaFilter}
              onChange={(e) => setMoedaFilter(e.target.value as "" | Moeda)}
              className="h-9 min-w-[100px] rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary/50"
            >
              <option value="">Todas</option>
              <option value="BRL">BRL</option>
              <option value="USD">USD</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Mes de referencia
            </label>
            <select
              value={refMonthFilter}
              onChange={(e) => setRefMonthFilter(e.target.value)}
              className="h-9 min-w-[160px] rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary/50"
            >
              <option value="">Todos</option>
              {refMonthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[12px] font-medium text-muted hover:bg-surface/80 hover:text-foreground"
              title="Limpar todos os filtros"
            >
              <X className="h-3.5 w-3.5" />
              Limpar filtros
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
            <Filter className="h-3 w-3 text-muted" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Filtrado
            </span>
          </div>
        )}
      </div>

      {/* Chips de resumo */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <ReceivableStatCard
          icon={Clock}
          label="Pendentes"
          count={summary?.pending_count ?? 0}
          brl={summary?.pending_brl ?? 0}
          usd={summary?.pending_usd ?? 0}
          tone="amber"
        />
        <ReceivableStatCard
          icon={AlertCircle}
          label="Vencidas"
          count={summary?.overdue_count ?? 0}
          brl={summary?.overdue_brl ?? 0}
          usd={summary?.overdue_usd ?? 0}
          tone="red"
        />
        <ReceivableStatCard
          icon={CheckCircle}
          label="Recebidas (30d)"
          count={summary?.received_last_30d_count ?? 0}
          brl={summary?.received_last_30d_brl ?? 0}
          usd={summary?.received_last_30d_usd ?? 0}
          tone="emerald"
        />
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface">
        <div className="flex flex-col items-start gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
          <div className="relative w-full flex-1 sm:w-auto">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Buscar por NF, cliente ou descricao..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary/50"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {[
                  "Cliente",
                  "Numero NF",
                  "Valor",
                  "Pais",
                  "Vencimento",
                  "Mes Ref",
                  "Status",
                  "Recebido em",
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
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <Wallet className="mx-auto mb-3 h-8 w-8 opacity-20" />
                    <p className="text-sm text-muted">
                      {hasActiveFilters || search
                        ? "Nenhuma NF a receber encontrada com esses filtros."
                        : "Nenhuma NF a receber cadastrada."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <ReceivableRow
                    key={r.id}
                    r={r}
                    isLast={i === filtered.length - 1}
                    canManage={canManage}
                    busy={busyId === r.id}
                    onEdit={openEdit}
                    onReceive={openReceive}
                    onCancel={onCancel}
                    onOpenPdf={openPdf}
                    onOpenProof={openProof}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <p className="text-xs text-muted">
              {filtered.length} {filtered.length === 1 ? "NF" : "NFs"}
            </p>
            <div className="flex flex-col items-end gap-0.5 text-xs font-medium text-foreground">
              {(() => {
                const totalBrl = filtered
                  .filter((r) => (r.moeda || "BRL") === "BRL")
                  .reduce((s, r) => s + Number(r.amount || 0), 0);
                const totalUsd = filtered
                  .filter((r) => r.moeda === "USD")
                  .reduce((s, r) => s + Number(r.amount || 0), 0);
                const showUsd = totalUsd > 0;
                return (
                  <>
                    <p>Total: {fmtCurrency(totalBrl, "BRL", "pt")}</p>
                    {showUsd && (
                      <p className="text-muted">
                        {fmtCurrency(totalUsd, "USD", "pt")}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {editOpen && (
        <ReceivableEditModal
          receivable={editing}
          onClose={() => {
            setEditOpen(false);
            setEditing(null);
          }}
          onSaved={onSaved}
        />
      )}

      {receiveOpen && receiving && (
        <ReceivableReceiveModal
          receivable={receiving}
          onClose={() => {
            setReceiveOpen(false);
            setReceiving(null);
          }}
          onSaved={onReceived}
        />
      )}
    </div>
  );
}

function ReceivableStatCard({
  icon: Icon,
  label,
  count,
  brl,
  usd,
  tone
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  brl: number;
  usd: number;
  tone: "amber" | "red" | "emerald";
}) {
  const toneCls = {
    amber: "bg-amber-500/10 text-amber-300",
    red: "bg-red-500/10 text-red-300",
    emerald: "bg-emerald-500/10 text-emerald-300"
  }[tone];

  return (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-surface p-5">
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${toneCls}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="mb-0.5 text-xs font-medium text-muted">{label}</p>
        <p className="text-xl font-semibold text-foreground">{count}</p>
        <p className="mt-0.5 text-sm font-medium leading-tight text-foreground/90">
          {fmtCurrency(brl, "BRL", "pt")}
        </p>
        <p className="text-sm font-medium leading-tight text-foreground/90">
          {fmtCurrency(usd, "USD", "pt")}
        </p>
      </div>
    </div>
  );
}

function ReceivableRow({
  r,
  isLast,
  canManage,
  busy,
  onEdit,
  onReceive,
  onCancel,
  onOpenPdf,
  onOpenProof
}: {
  r: NfReceivable;
  isLast: boolean;
  canManage: boolean;
  busy: boolean;
  onEdit: (r: NfReceivable) => void;
  onReceive: (r: NfReceivable) => void;
  onCancel: (r: NfReceivable) => void;
  onOpenPdf: (r: NfReceivable) => void;
  onOpenProof: (r: NfReceivable) => void;
}) {
  const isPending = r.status === "pendente";

  return (
    <tr
      className={`transition-colors hover:bg-background ${
        !isLast ? "border-b border-border" : ""
      }`}
    >
      <td className="px-5 py-4">
        <p className="text-sm font-medium text-foreground">
          {r.client_name || <span className="text-muted">—</span>}
        </p>
        {r.description && (
          <p className="mt-0.5 max-w-[280px] truncate text-[11px] text-muted">
            {r.description}
          </p>
        )}
        {(r.tag_name || (r.campanhas && r.campanhas.length > 0)) && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {r.tag_name && (
              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {r.tag_name}
              </span>
            )}
            {r.campanhas && r.campanhas.length > 0 && (
              <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted">
                {r.campanhas.length}{" "}
                {r.campanhas.length === 1 ? "campanha" : "campanhas"}
              </span>
            )}
          </div>
        )}
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-muted">
        {r.invoice_number || (
          <span className="text-[11px] italic text-muted/60">
            {r.has_invoice ? "—" : "sem NF"}
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-5 py-4 font-medium text-foreground">
        {fmtCurrency(Number(r.amount || 0), r.moeda || "BRL", "pt")}
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-muted">
        {r.caracol_entity === "BR" ? "Brasil" : "Exterior"}
      </td>
      <td className="whitespace-nowrap px-5 py-4">
        <div className="flex flex-col gap-1">
          <span className="text-muted">{fmtDate(r.due_date, "pt")}</span>
          {r.is_vencida && isPending && (
            <span className="inline-flex w-fit items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-300">
              vencida
            </span>
          )}
        </div>
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-muted">
        {fmtRefMonth(r.reference_month, "pt")}
      </td>
      <td className="whitespace-nowrap px-5 py-4">
        <ReceivableStatusBadge status={r.status} />
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-muted">
        {/* `received_at` vem como timestamp ISO — fmtDateOnly evita o
            deslocamento de um dia por timezone. */}
        {r.received_at ? fmtDateOnly(r.received_at, "pt") : "—"}
      </td>
      <td className="whitespace-nowrap px-5 py-4">
        <div className="flex items-center gap-1.5">
          {r.pdf_path && (
            <button
              onClick={() => onOpenPdf(r)}
              className="inline-flex items-center gap-1 rounded p-1.5 text-primary hover:bg-background"
              title="Baixar PDF da NF"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
          {r.status === "recebida" && r.received_proof_path && (
            <button
              onClick={() => onOpenProof(r)}
              className="inline-flex items-center gap-1 rounded p-1.5 text-emerald-300 hover:bg-background"
              title="Baixar comprovante de recebimento"
            >
              <FileText className="h-3.5 w-3.5" />
            </button>
          )}
          {canManage && isPending && (
            <>
              <button
                onClick={() => onEdit(r)}
                disabled={busy}
                className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted hover:text-foreground disabled:opacity-50"
                title="Editar"
              >
                <Pencil className="h-3 w-3" />
                Editar
              </button>
              <button
                onClick={() => onReceive(r)}
                disabled={busy}
                className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                title="Marcar recebida"
              >
                <CheckCircle className="h-3 w-3" />
                Recebida
              </button>
              <button
                onClick={() => onCancel(r)}
                disabled={busy}
                className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted hover:text-red-300 disabled:opacity-50"
                title="Cancelar"
              >
                <Trash2 className="h-3 w-3" />
                Cancelar
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function ReceivableStatusBadge({ status }: { status: NfReceivableStatus }) {
  const map: Record<NfReceivableStatus, { label: string; cls: string }> = {
    pendente: {
      label: "Pendente",
      cls: "border border-amber-500/30 bg-amber-500/10 text-amber-300"
    },
    recebida: {
      label: "Recebida",
      cls: "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    },
    cancelada: {
      label: "Cancelada",
      cls: "border border-zinc-500/30 bg-zinc-500/10 text-zinc-300"
    }
  };
  const m = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
