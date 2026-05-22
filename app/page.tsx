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
  X
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { ApprovalBadge, OverdueBadge } from "@/components/nf/approval-badge";
import { DashboardChips } from "@/components/nf/dashboard-chips";
import { useAuth } from "@/lib/auth-context";
import {
  useNfRole,
  langForRole,
  usePendingAssignedCount
} from "@/lib/nf-role-context";
import { apiFetch } from "@/lib/api";
import { fmtCurrency, fmtDate, fmtRefMonth, tr } from "@/lib/i18n";
import type { DashboardSummary, Invoice, InvoiceStatus } from "@/types";

const STATUS_OPTIONS: { value: InvoiceStatus | "todos"; pt: string; en: string }[] = [
  { value: "todos", pt: "Todos", en: "All" },
  { value: "em_analise", pt: "Em analise", en: "Under review" },
  { value: "aprovada", pt: "Aprovada", en: "Approved" },
  { value: "paga", pt: "Paga", en: "Paid" },
  { value: "recusada", pt: "Recusada", en: "Rejected" }
];

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

  // Filtros (com deep-link via querystring)
  const initialStatus = (searchParams?.get("status") as InvoiceStatus | "todos") || "todos";
  const initialVencida = searchParams?.get("vencida") === "1";
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "todos">(initialStatus);
  const [overdueOnly, setOverdueOnly] = useState<boolean>(initialVencida);
  const [mineOnly, setMineOnly] = useState(false);

  const showAssignedBanner =
    (role === "admin" || role === "adm_campanha") && pendingAssignedCount > 0;

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const list: { items: Invoice[]; total: number } | Invoice[] = await apiFetch("/nf/invoices");
      const items = Array.isArray(list) ? list : list?.items || [];
      setInvoices(items);
      if (role === "admin") {
        try {
          const s: DashboardSummary = await apiFetch("/nf/dashboard/summary");
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
  }, [role]);

  // Sincroniza filtro com query string (sem recarregar pagina)
  useEffect(() => {
    const qs = new URLSearchParams();
    if (statusFilter !== "todos") qs.set("status", statusFilter);
    if (overdueOnly) qs.set("vencida", "1");
    const next = qs.toString();
    const cur = (searchParams?.toString() || "");
    if (next !== cur) {
      router.replace(`/${next ? `?${next}` : ""}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, overdueOnly]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const matchStatus = statusFilter === "todos" || inv.status === statusFilter;
      const q = search.trim().toLowerCase();
      const matchSearch = !q || inv.invoice_number.toLowerCase().includes(q);
      // mineOnly agora = "NFs em_analise onde MEU papel ainda precisa aprovar"
      // (alinhado com `pending_my_approval_count` do banner). Bug 3.
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

      {/* Chips de status do dashboard */}
      {showDashboardChips && <DashboardChips counts={chipCounts} />}

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
            {role !== "publisher" && (
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
      <td className="max-w-[200px] truncate px-5 py-4 text-foreground" title={invoice.campaign}>
        {invoice.campaign || "—"}
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
