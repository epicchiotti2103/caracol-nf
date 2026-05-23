"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  Search,
  Plus,
  RefreshCw,
  Eye,
  Download,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle,
  DollarSign,
  Inbox,
  ChevronRight,
  X,
  Filter
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { ApprovalBadge, OverdueBadge } from "@/components/nf/approval-badge";
import { DashboardChips } from "@/components/nf/dashboard-chips";
import { DateRangePicker } from "@/components/nf/date-range-picker";
import { useAuth } from "@/lib/auth-context";
import {
  useNfRole,
  langForRole,
  usePendingAssignedCount
} from "@/lib/nf-role-context";
import { apiFetch } from "@/lib/api";
import { fmtCurrency, fmtDate, fmtRefMonth, tr } from "@/lib/i18n";
import type {
  DashboardSummary,
  Invoice,
  InvoiceStatus,
  NfUser
} from "@/types";

const STATUS_OPTIONS: { value: InvoiceStatus | "todos"; pt: string; en: string }[] = [
  { value: "todos", pt: "Todos", en: "All" },
  { value: "em_analise", pt: "Em analise", en: "Under review" },
  { value: "aprovada", pt: "Aprovada", en: "Approved" },
  { value: "paga", pt: "Paga", en: "Paid" },
  { value: "recusada", pt: "Recusada", en: "Rejected" }
];

// Opcoes de mes de referencia: ultimos 12 + proximos 3.
// Format do valor: "YYYY-MM" (alinha com query param `reference_month` do backend).
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

export default function HomePage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        }
      >
        <HomeContent />
      </Suspense>
    </AppShell>
  );
}

function HomeContent() {
  const role = useNfRole();
  const lang = langForRole(role);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const pendingAssignedCount = usePendingAssignedCount();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Lista de users (pra dropdown de responsavel). So fetch quando admin/adm.
  const [nfUsers, setNfUsers] = useState<NfUser[]>([]);

  // Filtros (com deep-link via querystring)
  const initialStatus = (searchParams?.get("status") as InvoiceStatus | "todos") || "todos";
  const initialVencida = searchParams?.get("vencida") === "1";
  const initialDueStart = searchParams?.get("due_date_start") || "";
  const initialDueEnd = searchParams?.get("due_date_end") || "";
  const initialRefMonth = searchParams?.get("reference_month") || "";
  const initialAssignee = searchParams?.get("assignee_id") || "";

  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "todos">(initialStatus);
  const [overdueOnly, setOverdueOnly] = useState<boolean>(initialVencida);
  const [dueDateStart, setDueDateStart] = useState<string>(initialDueStart);
  const [dueDateEnd, setDueDateEnd] = useState<string>(initialDueEnd);
  const [referenceMonth, setReferenceMonth] = useState<string>(initialRefMonth);
  const [assigneeId, setAssigneeId] = useState<string>(initialAssignee);
  const [mineOnly, setMineOnly] = useState(false);

  const showAssignedBanner =
    (role === "admin" || role === "adm_campanha") && pendingAssignedCount > 0;
  const showFilters = role === "admin" || role === "adm_campanha";

  // Constroi querystring que vai pros endpoints (backend params: status,
  // due_date_start, due_date_end, reference_month, assignee_id). Apenas server-side;
  // search e overdueOnly continuam client-side.
  const serverQuery = useMemo(() => {
    const qs = new URLSearchParams();
    if (statusFilter !== "todos") qs.set("status", statusFilter);
    if (dueDateStart) qs.set("due_date_start", dueDateStart);
    if (dueDateEnd) qs.set("due_date_end", dueDateEnd);
    if (referenceMonth) qs.set("reference_month", referenceMonth);
    if (assigneeId) {
      // "me" e atalho client-side — converte pra user.id antes de mandar
      const realId = assigneeId === "me" ? user?.id || "" : assigneeId;
      if (realId) qs.set("assignee_id", realId);
    }
    return qs.toString();
  }, [statusFilter, dueDateStart, dueDateEnd, referenceMonth, assigneeId, user?.id]);

  const hasActiveFilters =
    statusFilter !== "todos" ||
    !!dueDateStart ||
    !!dueDateEnd ||
    !!referenceMonth ||
    !!assigneeId ||
    overdueOnly;

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const url = serverQuery ? `/nf/invoices?${serverQuery}` : "/nf/invoices";
      const list: { items: Invoice[]; total: number } | Invoice[] = await apiFetch(url);
      const items = Array.isArray(list) ? list : list?.items || [];
      setInvoices(items);
      if (role === "admin") {
        try {
          const summaryUrl = serverQuery
            ? `/nf/dashboard/summary?${serverQuery}`
            : "/nf/dashboard/summary";
          const s: DashboardSummary = await apiFetch(summaryUrl);
          setSummary(s);
        } catch {
          // summary opcional
        }
      }
    } catch (err: any) {
      setError(err?.message || (lang === "pt" ? "Falha ao carregar" : "Failed to load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, serverQuery]);

  // Carrega users uma vez (pra dropdown). So admin/adm tem permissao.
  useEffect(() => {
    if (!showFilters) return;
    (async () => {
      try {
        const res: { items: NfUser[] } | NfUser[] = await apiFetch("/nf/users");
        const items = Array.isArray(res) ? res : res?.items || [];
        // So users com nf_role admin ou adm_campanha podem ser assignee
        setNfUsers(items.filter((u) => u.nf_role === "admin" || u.nf_role === "adm_campanha"));
      } catch {
        // silencioso — dropdown fica vazio
      }
    })();
  }, [showFilters]);

  // Sincroniza filtros com query string da URL (sem recarregar)
  useEffect(() => {
    const qs = new URLSearchParams();
    if (statusFilter !== "todos") qs.set("status", statusFilter);
    if (overdueOnly) qs.set("vencida", "1");
    if (dueDateStart) qs.set("due_date_start", dueDateStart);
    if (dueDateEnd) qs.set("due_date_end", dueDateEnd);
    if (referenceMonth) qs.set("reference_month", referenceMonth);
    if (assigneeId) qs.set("assignee_id", assigneeId);
    const next = qs.toString();
    const cur = searchParams?.toString() || "";
    if (next !== cur) {
      router.replace(`/${next ? `?${next}` : ""}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, overdueOnly, dueDateStart, dueDateEnd, referenceMonth, assigneeId]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const matchStatus = statusFilter === "todos" || inv.status === statusFilter;
      const q = search.trim().toLowerCase();
      const matchSearch = !q || inv.invoice_number.toLowerCase().includes(q);
      // mineOnly = "NFs em_analise onde MEU papel ainda precisa aprovar"
      let matchMine = true;
      if (mineOnly) {
        if (!user?.id || inv.status !== "em_analise") {
          matchMine = false;
        } else if (role === "adm_campanha") {
          matchMine = !inv.approved_by_adm_campanha_id && !inv.approved_by_adm_campanha_at;
        } else if (role === "admin") {
          matchMine = !inv.approved_by_admin_id && !inv.approved_by_admin_at;
        } else {
          matchMine = false;
        }
      }
      const matchOverdue = !overdueOnly || !!inv.is_vencida;
      return matchStatus && matchSearch && matchMine && matchOverdue;
    });
  }, [invoices, search, statusFilter, mineOnly, overdueOnly, user?.id, role]);

  const titlePt = role === "admin" ? "Painel admin" : "Notas fiscais";
  const subtitlePt =
    role === "admin"
      ? "Todas as notas"
      : role === "adm_campanha"
      ? "Notas das campanhas"
      : "Minhas notas";

  // Counts pros chips: prioriza valores agregados do backend (summary novo),
  // com fallback nas listas locais caso o backend ainda nao tenha esses campos.
  const localOverdueCount = invoices.filter((i) => i.is_vencida).length;
  const localPendingCount = invoices.filter((i) => i.status === "em_analise").length;
  const localToPayCount = invoices.filter((i) => i.status === "aprovada").length;

  const chipCounts = {
    pending: summary?.pending_approvals_count ?? localPendingCount,
    topay: summary?.to_pay_count ?? localToPayCount,
    overdue: summary?.overdue_count ?? localOverdueCount
  };

  const showDashboardChips = role === "admin" || role === "adm_campanha";

  const refMonthOptions = useMemo(() => makeRefMonthOptions(), []);

  // Reseta todos os filtros pro estado default
  const clearFilters = () => {
    setStatusFilter("todos");
    setOverdueOnly(false);
    setDueDateStart("");
    setDueDateEnd("");
    setReferenceMonth("");
    setAssigneeId("");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
            {lang === "pt" ? titlePt : "Invoices portal"}
          </h4>
          <h1 className="text-2xl font-semibold text-foreground">
            {lang === "pt" ? subtitlePt : "My invoices"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-border bg-surface p-2 text-muted transition-colors hover:bg-surface/80 disabled:opacity-50"
            title={lang === "pt" ? "Atualizar" : "Refresh"}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {role === "publisher" && (
            <Link
              href="/invoice/new"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              {tr("newInvoice", "en")}
            </Link>
          )}
          {role !== "publisher" && (
            <Link
              href="/invoice/new"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Nova NF
            </Link>
          )}
        </div>
      </div>

      {/* Linha de filtros (apenas para admin/adm_campanha) */}
      {showFilters && (
        <div className="mb-4 rounded-xl border border-border bg-surface px-4 py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Vencimento
              </label>
              <DateRangePicker
                startDate={dueDateStart}
                endDate={dueDateEnd}
                onChange={(s, e) => {
                  setDueDateStart(s);
                  setDueDateEnd(e);
                }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Mes de referencia
              </label>
              <select
                value={referenceMonth}
                onChange={(e) => setReferenceMonth(e.target.value)}
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

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Responsavel
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="h-9 min-w-[180px] rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary/50"
              >
                <option value="">Todos</option>
                {user?.id && <option value="me">Eu</option>}
                {nfUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as InvoiceStatus | "todos")
                }
                className="h-9 min-w-[140px] rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary/50"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.pt}
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
                Filtrado:
              </span>
              {(dueDateStart || dueDateEnd) && (
                <ActivePill
                  label={`Vencimento: ${dueDateStart || "..."} → ${dueDateEnd || "..."}`}
                  onClear={() => {
                    setDueDateStart("");
                    setDueDateEnd("");
                  }}
                />
              )}
              {referenceMonth && (
                <ActivePill
                  label={`Mes ref: ${referenceMonth}`}
                  onClear={() => setReferenceMonth("")}
                />
              )}
              {assigneeId && (
                <ActivePill
                  label={`Resp: ${
                    assigneeId === "me"
                      ? "Eu"
                      : nfUsers.find((u) => u.id === assigneeId)?.name || assigneeId.slice(0, 8)
                  }`}
                  onClear={() => setAssigneeId("")}
                />
              )}
              {statusFilter !== "todos" && (
                <ActivePill
                  label={`Status: ${
                    STATUS_OPTIONS.find((o) => o.value === statusFilter)?.pt || statusFilter
                  }`}
                  onClear={() => setStatusFilter("todos")}
                />
              )}
              {overdueOnly && (
                <ActivePill
                  label="Apenas vencidas"
                  onClear={() => setOverdueOnly(false)}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Chips de status do dashboard */}
      {showDashboardChips && (
        <DashboardChips counts={chipCounts} queryString={serverQuery} />
      )}

      {showAssignedBanner && (
        <button
          type="button"
          onClick={() => setMineOnly((v) => !v)}
          className={`group mb-6 flex w-full items-center gap-3 rounded-xl border px-5 py-4 text-left transition-colors ${
            mineOnly
              ? "border-primary/60 bg-primary/20"
              : "border-primary/30 bg-primary/10 hover:bg-primary/15"
          }`}
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
            <Inbox className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            {mineOnly ? (
              <p className="text-sm font-medium text-foreground">
                Filtrando NFs aguardando sua aprovacao ·{" "}
                <span className="font-semibold text-primary">
                  {pendingAssignedCount}
                </span>
              </p>
            ) : (
              <p className="text-sm text-foreground">
                Voce tem{" "}
                <span className="font-semibold text-primary">
                  {pendingAssignedCount}{" "}
                  {pendingAssignedCount === 1 ? "NF" : "NFs"}
                </span>{" "}
                aguardando sua aprovacao
              </p>
            )}
            <p className="mt-0.5 text-xs text-muted">
              {mineOnly
                ? "Clique pra remover o filtro"
                : "Clique pra ver so essas"}
            </p>
          </div>
          {mineOnly ? (
            <X className="h-4 w-4 flex-shrink-0 text-muted transition-colors group-hover:text-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted transition-colors group-hover:text-foreground" />
          )}
        </button>
      )}

      {role === "admin" && summary && (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            icon={Clock}
            label="Em analise"
            value={String(summary.pending_review?.count ?? 0)}
            sub={`${fmtCurrency(summary.pending_review?.total_amount || 0, "BRL", "pt")} em valor`}
          />
          <DualCurrencyStatCard
            icon={DollarSign}
            label="A pagar"
            brl={summary.to_pay_brl ?? summary.to_pay?.total_amount ?? 0}
            usd={summary.to_pay_usd ?? 0}
            sub={`${summary.to_pay?.count ?? 0} aprovadas pendentes`}
          />
          <DualCurrencyStatCard
            icon={CheckCircle}
            label="Pagas (30d)"
            brl={summary.paid_last_30d_brl ?? summary.paid_last_30d?.total_amount ?? 0}
            usd={summary.paid_last_30d_usd ?? 0}
            sub={`${summary.paid_last_30d?.count ?? 0} ultimos 30 dias`}
          />
        </div>
      )}

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
              placeholder={tr("search", lang)}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary/50"
            />
          </div>
          {/* Quick filters (status pills) — apenas pra publisher (que nao ve a barra de filtros completa) */}
          {!showFilters && (
            <div className="flex flex-wrap items-center gap-1">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === opt.value
                      ? "bg-primary text-black"
                      : "bg-background text-muted hover:text-foreground"
                  }`}
                >
                  {opt[lang]}
                </button>
              ))}
            </div>
          )}
          {showFilters && (
            <button
              onClick={() => setOverdueOnly((v) => !v)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                overdueOnly
                  ? "bg-red-500/30 text-red-100"
                  : "bg-background text-muted hover:text-foreground"
              }`}
              title="Apenas vencidas"
            >
              Vencidas
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {headersFor(role).map((h) => (
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
                  <td colSpan={12} className="py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center">
                    <FileText className="mx-auto mb-3 h-8 w-8 opacity-20" />
                    <p className="text-sm text-muted">
                      {invoices.length === 0
                        ? lang === "pt"
                          ? "Nenhuma NF cadastrada."
                          : "No invoices yet."
                        : lang === "pt"
                        ? "Nenhuma NF para esse filtro."
                        : "No invoices match this filter."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((inv, i) => (
                  <InvoiceRow
                    key={inv.id}
                    invoice={inv}
                    role={role}
                    isLast={i === filtered.length - 1}
                    onClick={() => router.push(`/invoice/${inv.id}`)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <p className="text-xs text-muted">
              {filtered.length}{" "}
              {lang === "pt"
                ? filtered.length === 1
                  ? "NF"
                  : "NFs"
                : filtered.length === 1
                ? "invoice"
                : "invoices"}
            </p>
            <div className="flex flex-col items-end gap-0.5 text-xs font-medium text-foreground">
              {(() => {
                const totalBrl = filtered
                  .filter((i) => (i.moeda || "BRL") === "BRL")
                  .reduce((s, i) => s + (i.amount || 0), 0);
                const totalUsd = filtered
                  .filter((i) => i.moeda === "USD")
                  .reduce((s, i) => s + (i.amount || 0), 0);
                const showUsd = totalUsd > 0;
                return (
                  <>
                    <p>
                      {lang === "pt" ? "Total" : "Total"}:{" "}
                      {fmtCurrency(totalBrl, "BRL", lang)}
                    </p>
                    {showUsd && (
                      <p className="text-muted">
                        {fmtCurrency(totalUsd, "USD", lang)}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivePill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
      {label}
      <button
        type="button"
        onClick={onClear}
        className="rounded p-0.5 hover:bg-primary/20"
        title="Remover"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

function headersFor(role: string): string[] {
  if (role === "publisher") {
    return [
      "Invoice #",
      "Amount",
      "Due Date",
      "Reference Month",
      "Campaign",
      "Status",
      "PDF",
      ""
    ];
  }
  return [
    "NF",
    "Valor",
    "Vencimento",
    "Mes Ref",
    "Campanha",
    "Status",
    "Aprovacoes",
    "Publisher",
    "Responsavel",
    "PDF",
    ""
  ];
}

function InvoiceRow({
  invoice,
  role,
  isLast,
  onClick
}: {
  invoice: Invoice;
  role: string;
  isLast: boolean;
  onClick: () => void;
}) {
  const lang = role === "publisher" ? "en" : "pt";

  const handlePdf = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res: { url: string } = await apiFetch(`/nf/invoices/${invoice.id}/pdf`);
      if (res?.url) window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      alert(err?.message || (lang === "pt" ? "Falha ao gerar link" : "Failed to generate link"));
    }
  };

  return (
    <tr
      onClick={onClick}
      className={`group cursor-pointer transition-colors hover:bg-background ${
        !isLast ? "border-b border-border" : ""
      }`}
    >
      <td className="whitespace-nowrap px-5 py-4 font-medium text-foreground">
        {invoice.invoice_number}
      </td>
      <td className="whitespace-nowrap px-5 py-4 font-medium text-foreground">
        {fmtCurrency(invoice.amount || 0, invoice.moeda || "BRL", lang)}
      </td>
      <td className="whitespace-nowrap px-5 py-4">
        <div className="flex flex-col gap-1">
          <span className="text-muted">{fmtDate(invoice.due_date, lang)}</span>
          {invoice.is_vencida && invoice.status !== "paga" && (
            <OverdueBadge invoice={invoice} />
          )}
        </div>
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-muted">
        {fmtRefMonth(invoice.reference_month, lang)}
      </td>
      <td className="max-w-[200px] truncate px-5 py-4 text-foreground" title={invoice.campaign_name || invoice.campaign || undefined}>
        {invoice.campaign_name || invoice.campaign || "—"}
      </td>
      <td className="whitespace-nowrap px-5 py-4">
        <StatusBadge status={invoice.status} lang={lang} />
      </td>
      {role !== "publisher" && (
        <td className="whitespace-nowrap px-5 py-4">
          <ApprovalBadge invoice={invoice} />
        </td>
      )}
      {role !== "publisher" && (
        <td className="px-5 py-4">
          <p className="text-xs text-foreground">{invoice.publisher_name || "—"}</p>
          <p className="text-[11px] text-muted">{invoice.publisher_email || ""}</p>
        </td>
      )}
      {role !== "publisher" && (
        <td className="px-5 py-4">
          <p className="text-xs text-foreground">
            {invoice.assignee_name || (
              <span className="text-muted">—</span>
            )}
          </p>
        </td>
      )}
      <td className="px-5 py-4">
        {invoice.pdf_path ? (
          <button
            onClick={handlePdf}
            className="inline-flex items-center gap-1 rounded p-1.5 text-primary hover:bg-background"
            title={lang === "pt" ? "Baixar PDF" : "Download PDF"}
          >
            <Download className="h-4 w-4" />
          </button>
        ) : (
          <span className="text-xs text-muted">—</span>
        )}
      </td>
      <td className="px-5 py-4">
        <Eye className="h-4 w-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
      </td>
    </tr>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="mb-0.5 text-xs font-medium text-muted">{label}</p>
        <p className="text-xl font-semibold text-foreground">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
    </div>
  );
}

// Variante que mostra BRL + USD em 2 linhas, conforme spec do nf-moeda-ui.
function DualCurrencyStatCard({
  icon: Icon,
  label,
  brl,
  usd,
  sub
}: {
  icon: React.ElementType;
  label: string;
  brl: number;
  usd: number;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="mb-0.5 text-xs font-medium text-muted">{label}</p>
        <p className="text-lg font-semibold leading-tight text-foreground">
          {fmtCurrency(brl, "BRL", "pt")}
        </p>
        <p className="text-sm font-medium leading-tight text-foreground/80">
          {fmtCurrency(usd, "USD", "pt")}
        </p>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
    </div>
  );
}
