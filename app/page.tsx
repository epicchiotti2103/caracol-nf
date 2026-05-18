"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  DollarSign
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { useAuth } from "@/lib/auth-context";
import { useNfRole, langForRole } from "@/lib/nf-role-context";
import { apiFetch } from "@/lib/api";
import { fmtCurrency, fmtDate, fmtRefMonth, i18n, tr } from "@/lib/i18n";
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
      <HomeContent />
    </AppShell>
  );
}

function HomeContent() {
  const role = useNfRole();
  const lang = langForRole(role);
  const router = useRouter();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "todos">("todos");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const list: Invoice[] = await apiFetch("/nf/invoices");
      setInvoices(Array.isArray(list) ? list : []);
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

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const matchStatus = statusFilter === "todos" || inv.status === statusFilter;
      const q = search.trim().toLowerCase();
      const matchSearch = !q || inv.invoice_number.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [invoices, search, statusFilter]);

  const titlePt = role === "admin" ? "Painel admin" : "Notas fiscais";
  const subtitlePt =
    role === "admin"
      ? "Todas as notas"
      : role === "adm_campanha"
      ? "Notas das campanhas"
      : "Minhas notas";

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

      {role === "admin" && summary && (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            icon={Clock}
            label="Em analise"
            value={String(summary.em_analise_count)}
            sub="aguardando aprovacao"
          />
          <StatCard
            icon={DollarSign}
            label="A pagar"
            value={fmtCurrency(summary.a_pagar_amount || 0, "pt")}
            sub="aprovadas pendentes"
          />
          <StatCard
            icon={CheckCircle}
            label="Pagas (30d)"
            value={fmtCurrency(summary.pagas_30d_amount || 0, "pt")}
            sub="ultimos 30 dias"
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
                  <td colSpan={10} className="py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
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
            <p className="text-xs font-medium text-foreground">
              {lang === "pt" ? "Total" : "Total"}:{" "}
              {fmtCurrency(
                filtered.reduce((s, i) => s + (i.amount || 0), 0),
                lang
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function headersFor(role: string): string[] {
  if (role === "publisher") {
    return ["Invoice #", "Amount", "Due Date", "Reference Month", "Campaign", "Status", "PDF", ""];
  }
  if (role === "adm_campanha") {
    return [
      "NF",
      "Valor",
      "Vencimento",
      "Mes Ref",
      "Campanha",
      "Status",
      "Publisher",
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
    "Publisher",
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
        {fmtCurrency(invoice.amount || 0, lang)}
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-muted">
        {fmtDate(invoice.due_date, lang)}
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
        <td className="px-5 py-4">
          <p className="text-xs text-foreground">{invoice.publisher_name || "—"}</p>
          <p className="text-[11px] text-muted">{invoice.publisher_email || ""}</p>
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
