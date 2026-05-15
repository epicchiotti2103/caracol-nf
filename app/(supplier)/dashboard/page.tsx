"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Clock,
  CheckCircle,
  DollarSign,
  Search,
  Eye,
  Plus,
  RefreshCw,
  X
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { getInvoicesForSupplier, MOCK_CURRENT_SUPPLIER_ID } from "@/lib/mock";
import type { Invoice, InvoiceStatus } from "@/types";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("pt-BR");

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

const STATUS_FILTERS: { value: InvoiceStatus | "todos"; label: string }[] = [
  { value: "todos", label: "Todas" },
  { value: "pendente", label: "Pendente" },
  { value: "em_analise", label: "Em analise" },
  { value: "aprovada", label: "Aprovada" },
  { value: "paga", label: "Paga" },
  { value: "rejeitada", label: "Rejeitada" }
];

export default function SupplierDashboardPage() {
  const router = useRouter();
  const [invoices] = useState<Invoice[]>(() => getInvoicesForSupplier(MOCK_CURRENT_SUPPLIER_ID));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "todos">("todos");
  const [selected, setSelected] = useState<Invoice | null>(null);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const matchStatus = statusFilter === "todos" || inv.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch =
        inv.numero_nota.toLowerCase().includes(q) || inv.descricao.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [invoices, search, statusFilter]);

  const totalLiquido = invoices.reduce((s, i) => s + i.valor_liquido, 0);
  const pendentes = invoices.filter((i) => i.status === "pendente").length;
  const pagas = invoices.filter((i) => i.status === "paga").length;
  const totalPago = invoices
    .filter((i) => i.status === "paga")
    .reduce((s, i) => s + i.valor_liquido, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
            Painel de notas fiscais
          </h4>
          <h1 className="text-2xl font-semibold text-foreground">Minhas Notas</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-border bg-surface p-2 text-muted transition-colors hover:bg-surface/80"
            title="Atualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => router.push("/nova-nota")}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Nova nota
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={FileText} label="Total de notas" value={String(invoices.length)} sub="enviadas ao portal" />
        <StatCard icon={Clock} label="Pendentes" value={String(pendentes)} sub="aguardando analise" />
        <StatCard icon={CheckCircle} label="Pagas" value={String(pagas)} />
        <StatCard icon={DollarSign} label="Total liquido" value={fmt(totalLiquido)} sub={`${fmt(totalPago)} ja pagos`} />
      </div>

      <div className="rounded-xl border border-border bg-surface">
        <div className="flex flex-col items-start gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
          <div className="relative w-full flex-1 sm:w-auto">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Buscar por numero ou descricao..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {STATUS_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === value
                    ? "bg-primary text-black"
                    : "bg-background text-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["No da Nota", "Descricao", "Vencimento", "Valor Bruto", "Valor Liquido", "Status", ""].map((h) => (
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <FileText className="mx-auto mb-3 h-8 w-8 opacity-20" />
                    <p className="text-sm text-muted">
                      {invoices.length === 0
                        ? "Nenhuma nota enviada ainda."
                        : "Nenhuma nota encontrada para esse filtro."}
                    </p>
                    {invoices.length === 0 && (
                      <button
                        onClick={() => router.push("/nova-nota")}
                        className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black"
                      >
                        Enviar primeira nota
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((inv, i) => (
                  <tr
                    key={inv.id}
                    onClick={() => setSelected(inv)}
                    className={`group cursor-pointer transition-colors hover:bg-background ${
                      i < filtered.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-5 py-4 font-medium text-foreground">{inv.numero_nota}</td>
                    <td className="max-w-[240px] px-5 py-4">
                      <span className="block truncate text-muted" title={inv.descricao}>
                        {inv.descricao}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-muted">{fmtDate(inv.data_vencimento)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-foreground">{fmt(inv.valor_bruto)}</td>
                    <td className="whitespace-nowrap px-5 py-4 font-medium text-foreground">{fmt(inv.valor_liquido)}</td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-5 py-4">
                      <button className="rounded p-1.5 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100">
                        <Eye className="h-4 w-4 text-muted" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <p className="text-xs text-muted">
              {filtered.length} {filtered.length === 1 ? "nota" : "notas"}
            </p>
            <p className="text-xs font-medium text-foreground">
              Total liquido: {fmt(filtered.reduce((s, i) => s + i.valor_liquido, 0))}
            </p>
          </div>
        )}
      </div>

      {selected && <InvoiceDetailModal invoice={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function InvoiceDetailModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const desconto = invoice.valor_bruto - invoice.valor_liquido;
  const pct = ((desconto / invoice.valor_bruto) * 100).toFixed(1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-black px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Nota Fiscal
            </p>
            <p className="text-lg font-semibold text-orange-50">{invoice.numero_nota}</p>
          </div>
          <button onClick={onClose} className="text-orange-100/40 transition-colors hover:text-orange-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-xs uppercase tracking-wider text-muted">Status</p>
              <StatusBadge status={invoice.status} />
            </div>
            <div className="text-right">
              <p className="mb-1 text-xs uppercase tracking-wider text-muted">Vencimento</p>
              <p className="font-medium text-foreground">{fmtDate(invoice.data_vencimento)}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 rounded-xl bg-background p-4 text-center">
            <div>
              <p className="text-xs text-muted">Valor bruto</p>
              <p className="mt-0.5 text-base font-semibold text-foreground">{fmt(invoice.valor_bruto)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Desconto ({pct}%)</p>
              <p className="mt-0.5 text-base font-semibold text-danger">- {fmt(desconto)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Valor liquido</p>
              <p className="mt-0.5 text-base font-semibold text-primary">{fmt(invoice.valor_liquido)}</p>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs uppercase tracking-wider text-muted">Descricao do servico</p>
            <p className="text-sm leading-relaxed text-foreground">{invoice.descricao}</p>
          </div>

          {invoice.arquivo_url && (
            <a
              href={invoice.arquivo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              Baixar arquivo da NF
            </a>
          )}

          {invoice.observacao && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="mb-0.5 text-xs font-semibold text-amber-300">Observacao do financeiro</p>
              <p className="text-sm text-amber-100/80">{invoice.observacao}</p>
            </div>
          )}

          <p className="text-xs text-muted">
            Enviada em{" "}
            {new Date(invoice.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric"
            })}
          </p>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-black py-2.5 text-sm font-semibold text-primary transition-opacity hover:opacity-90"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
