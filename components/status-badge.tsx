import type { InvoiceStatus } from "@/types";

const config: Record<InvoiceStatus, { label: string; className: string }> = {
  pendente: {
    label: "Pendente",
    className: "border border-amber-500/30 bg-amber-500/10 text-amber-300"
  },
  em_analise: {
    label: "Em analise",
    className: "border border-blue-500/30 bg-blue-500/10 text-blue-300"
  },
  aprovada: {
    label: "Aprovada",
    className: "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
  },
  paga: {
    label: "Paga",
    className: "border border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
  },
  rejeitada: {
    label: "Rejeitada",
    className: "border border-red-500/30 bg-red-500/10 text-red-300"
  }
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const { label, className } = config[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
