"use client";

import type { ApprovalSlot, Invoice } from "@/types";

/**
 * Conta quantas das 2 aprovacoes (adm_campanha + admin) ja foram registradas
 * com base nos campos da invoice. Faz fallback razoavel usando `approvals_pending`
 * (vindo do backend), depois aos campos approval_*_at, e por ultimo ao status.
 */
function computeApprovalState(invoice: Invoice): {
  done: number;
  total: number;
  pendingSlots: ApprovalSlot[];
} {
  const total = 2;

  if (invoice.status === "aprovada" || invoice.status === "paga") {
    return { done: 2, total, pendingSlots: [] };
  }

  if (invoice.status === "recusada") {
    return { done: 0, total, pendingSlots: [] };
  }

  // status === em_analise
  if (Array.isArray(invoice.approvals_pending)) {
    const pending = invoice.approvals_pending;
    return {
      done: total - pending.length,
      total,
      pendingSlots: pending
    };
  }

  // Fallback derivado dos campos approval_*
  const admDone = !!invoice.approved_by_adm_campanha_at;
  const adminDone = !!invoice.approved_by_admin_at;
  const done = (admDone ? 1 : 0) + (adminDone ? 1 : 0);
  const pendingSlots: ApprovalSlot[] = [];
  if (!admDone) pendingSlots.push("adm_campanha");
  if (!adminDone) pendingSlots.push("admin");
  return { done, total, pendingSlots };
}

export function ApprovalBadge({
  invoice,
  className = ""
}: {
  invoice: Invoice;
  className?: string;
}) {
  const { done, total, pendingSlots } = computeApprovalState(invoice);

  let tone =
    "border border-zinc-500/30 bg-zinc-500/10 text-zinc-300"; // 0/2
  if (done === total) {
    tone = "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  } else if (done > 0) {
    tone = "border border-amber-500/40 bg-amber-500/10 text-amber-300";
  }

  const tooltipText =
    done === total
      ? "Aprovacoes completas"
      : pendingSlots.length === 0
      ? "Aguardando aprovacao"
      : `aguarda: ${pendingSlots
          .map((s) => (s === "adm_campanha" ? "adm. campanha" : "admin"))
          .join(" + ")}`;

  return (
    <span
      title={tooltipText}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone} ${className}`}
    >
      {done}/{total}
      {done === total && <span aria-hidden>✓</span>}
    </span>
  );
}

export function OverdueBadge({
  invoice,
  className = ""
}: {
  invoice: Invoice;
  className?: string;
}) {
  if (!invoice.is_vencida) return null;
  const days = invoice.days_overdue ?? null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-300 ${className}`}
    >
      {days != null
        ? `Vencida ha ${days} ${days === 1 ? "dia" : "dias"}`
        : "Vencida"}
    </span>
  );
}
