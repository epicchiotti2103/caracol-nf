"use client";

import { useMemo, useState } from "react";
import {
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  Search,
  ChevronDown,
  RefreshCw,
  Eye,
  X
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { getAllInvoicesWithSupplier, MOCK_SUPPLIERS } from "@/lib/mock";
import type { Invoice, InvoiceStatus } from "@/types";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("pt-BR");

const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "em_analise", label: "Em analise" },
  { value: "aprovada", label: "Aprovada" },
  { value: "paga", label: "Paga" },
  { value: "rejeitada", label: "Rejeitada" }
];

const STATUS_FILTERS: { value: InvoiceStatus | "todos"; label: string }[] = [
  { value: "todos", label: "Todas" },
  ...STATUS_OPTIONS
];

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

export default function AdminPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(() => getAllInvoicesWithSupplier());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "todos">("todos");
  const [supplierFilter, setSupplierFilter] = useState("todos");
  const [selected, setSelected] = useState<Invoice | null>(null);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const matchStatus = statusFilter === "todos" || inv.status === statusFilter;
      const matchSupplier = supplierFilter === "todos" || inv.supplier_id === supplierFilter;
      const q = search.toLowerCase();
      const matchSearch =
        inv.numero_nota.toLowerCase().includes(q) ||
        inv.descricao.toLowerCase().includes(q) ||
        (inv.supplier?.razao_social ?? "").toLowerCase().includes(q);
      return matchStatus && matchSupplier && matchSearch;
    });
  }, [invoices, search, statusFilter, supplierFilter]);

  const totalBruto = invoices.reduce((s, i) => s + i.valor_bruto, 0);
  const totalLiquido = invoices.reduce((s, i) => s + i.valor_liquido, 0);
  const pendentes = invoices.filter(
    (i) => i.status === "pendente" || i.status === "em_analise"
  ).length;
  const pagas = invoices.filter((i) => i.status === "paga").length;

  const handleUpdated = (updated: Partial<Invoice> & { id: string }) => {
    setInvoices((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
    setSelected(null);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
            Painel administrativo
          </h4>
          <h1 className="text-2xl font-semibold text-foreground">Notas Fiscais Recebidas</h1>
        </div>
        <button
          onClick={() => setInvoices(getAllInvoicesWithSupplier())}
          className="rounded-lg border border-border bg-surface p-2 text-muted transition-colors hover:bg-surface/80"
          title="Atualizar"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={FileText}
          label="Total de notas"
          value={String(invoices.length)}
          sub={`de ${MOCK_SUPPLIERS.length} fornecedores`}
        />
        <StatCard icon={Clock} label="Pendentes / Analise" value={String(pendentes)} sub="aguardando acao" />
        <StatCard icon={CheckCircle} label="Pagas" value={String(pagas)} />
        <StatCard icon={DollarSign} label="Total bruto" value={fmt(totalBruto)} sub={`${fmt(totalLiquido)} liquido`} />
      </div>

      <div className="rounded-xl border border-border bg-surface">
        <div className="flex flex-col flex-wrap items-start gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Buscar nota, descricao ou fornecedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary/50"
            />
          </div>

          <div className="relative">
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="cursor-pointer appearance-none rounded-lg border border-border bg-surface py-2 pl-3 pr-8 text-sm text-foreground outline-none focus:border-primary/50"
            >
              <option value="todos">Todos os fornecedores</option>
              {MOCK_SUPPLIERS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.razao_social}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
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
                {["Fornecedor", "No da nota", "Descricao", "Vencimento", "Valor bruto", "Valor liquido", "Status", ""].map((h) => (
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
                  <td colSpan={8} className="py-16 text-center">
                    <FileText className="mx-auto mb-3 h-8 w-8 opacity-20" />
                    <p className="text-sm text-muted">Nenhuma nota encontrada.</p>
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
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-foreground">
                        {inv.supplier?.razao_social || "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{inv.supplier?.cnpj || inv.supplier?.email || ""}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-medium text-foreground">{inv.numero_nota}</td>
                    <td className="max-w-[200px] px-5 py-4">
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
              Liquido filtrado: {fmt(filtered.reduce((s, i) => s + i.valor_liquido, 0))}
            </p>
          </div>
        )}
      </div>

      {selected && (
        <AdminInvoiceModal invoice={selected} onClose={() => setSelected(null)} onUpdated={handleUpdated} />
      )}
    </div>
  );
}

function AdminInvoiceModal({
  invoice,
  onClose,
  onUpdated
}: {
  invoice: Invoice;
  onClose: () => void;
  onUpdated: (updated: Partial<Invoice> & { id: string }) => void;
}) {
  const [status, setStatus] = useState<InvoiceStatus>(invoice.status);
  const [observacao, setObservacao] = useState(invoice.observacao ?? "");
  const [saving, setSaving] = useState(false);

  const changed = status !== invoice.status || observacao !== (invoice.observacao ?? "");

  const handleSave = async () => {
    setSaving(true);
    // MOCK: simula save. Quando integrar Supabase, faz update aqui.
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    onUpdated({ id: invoice.id, status, observacao });
  };

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
        <div className="flex items-center justify-between border-b border-border bg-zinc-950 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {invoice.supplier?.razao_social || "Fornecedor"}
            </p>
            <p className="text-lg font-semibold text-orange-50">{invoice.numero_nota}</p>
          </div>
          <button onClick={onClose} className="text-orange-100/40 transition-colors hover:text-orange-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
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
            <p className="mb-1 text-xs uppercase tracking-wider text-muted">Descricao</p>
            <p className="text-sm text-foreground">{invoice.descricao}</p>
          </div>

          <div className="flex gap-4">
            <div>
              <p className="mb-1 text-xs uppercase tracking-wider text-muted">Vencimento</p>
              <p className="text-sm font-medium text-foreground">{fmtDate(invoice.data_vencimento)}</p>
            </div>
            {invoice.arquivo_url && (
              <div>
                <p className="mb-1 text-xs uppercase tracking-wider text-muted">Arquivo</p>
                <a
                  href={invoice.arquivo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Baixar NF
                </a>
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-muted">Alterar status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStatus(value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                    status === value
                      ? "border-primary bg-primary text-black"
                      : "border-border bg-background text-muted hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-wider text-muted">
              Observacao para o fornecedor
            </label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Ex: Dados incorretos, favor reenviar..."
              className="w-full resize-none rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/60"
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-background"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!changed || saving}
            className="flex-1 rounded-lg bg-zinc-950 py-2.5 text-sm font-semibold text-primary transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "Salvando..." : "Salvar alteracoes"}
          </button>
        </div>
      </div>
    </div>
  );
}
