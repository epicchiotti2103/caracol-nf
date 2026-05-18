import type { InvoiceStatus } from "@/types";

type Lang = "pt" | "en";

const labels: Record<InvoiceStatus, Record<Lang, string>> = {
  em_analise: { pt: "Em analise", en: "Under review" },
  aprovada: { pt: "Aprovada", en: "Approved" },
  paga: { pt: "Paga", en: "Paid" },
  recusada: { pt: "Recusada", en: "Rejected" }
};

const classes: Record<InvoiceStatus, string> = {
  em_analise: "border border-blue-500/30 bg-blue-500/10 text-blue-300",
  aprovada: "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  paga: "border border-emerald-400/40 bg-emerald-400/15 text-emerald-200",
  recusada: "border border-red-500/30 bg-red-500/10 text-red-300"
};

export function StatusBadge({ status, lang = "pt" }: { status: InvoiceStatus; lang?: Lang }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes[status]}`}
    >
      {labels[status][lang]}
    </span>
  );
}
