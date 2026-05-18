"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Download,
  Loader2,
  X
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { useNfRole, langForRole } from "@/lib/nf-role-context";
import { useToast } from "@/lib/toast-context";
import { apiFetch } from "@/lib/api";
import { fmtCurrency, fmtDate, fmtDateTime, fmtRefMonth } from "@/lib/i18n";
import type { Invoice, InvoiceStatus } from "@/types";

type Action = "approve" | "reject" | "pay";

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <InvoiceDetail id={params.id} />
    </AppShell>
  );
}

function InvoiceDetail({ id }: { id: string }) {
  const role = useNfRole();
  const lang = langForRole(role);
  const router = useRouter();
  const toast = useToast();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [acting, setActing] = useState(false);

  const t = {
    back: lang === "pt" ? "Voltar" : "Back",
    invoice: lang === "pt" ? "Nota fiscal" : "Invoice",
    amount: lang === "pt" ? "Valor" : "Amount",
    dueDate: lang === "pt" ? "Vencimento" : "Due date",
    refMonth: lang === "pt" ? "Mes de referencia" : "Reference month",
    campaign: lang === "pt" ? "Campanha" : "Campaign",
    publisher: "Publisher",
    status: "Status",
    createdAt: lang === "pt" ? "Enviada em" : "Sent at",
    downloadPdf: lang === "pt" ? "Baixar PDF" : "Download PDF",
    approve: lang === "pt" ? "Aprovar" : "Approve",
    reject: lang === "pt" ? "Recusar" : "Reject",
    markPaid: lang === "pt" ? "Marcar como paga" : "Mark as paid",
    rejectionReason: lang === "pt" ? "Motivo da recusa" : "Rejection reason",
    confirmApprove:
      lang === "pt" ? "Confirmar aprovacao?" : "Confirm approval?",
    confirmPay:
      lang === "pt" ? "Confirmar pagamento?" : "Confirm payment?",
    confirmReject:
      lang === "pt" ? "Confirmar recusa" : "Confirm rejection",
    cancel: lang === "pt" ? "Cancelar" : "Cancel",
    confirm: lang === "pt" ? "Confirmar" : "Confirm",
    saving: lang === "pt" ? "Salvando..." : "Saving...",
    approvedBy: lang === "pt" ? "Aprovada por" : "Approved by",
    paidBy: lang === "pt" ? "Paga por" : "Paid by",
    rejectedNotes: lang === "pt" ? "Motivo" : "Notes",
    notFound: lang === "pt" ? "NF nao encontrada." : "Invoice not found.",
    reasonRequired:
      lang === "pt" ? "Informe o motivo da recusa." : "Enter the rejection reason.",
    approvedOk: lang === "pt" ? "NF aprovada" : "Invoice approved",
    rejectedOk: lang === "pt" ? "NF recusada" : "Invoice rejected",
    paidOk: lang === "pt" ? "NF marcada como paga" : "Invoice marked as paid"
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const inv: Invoice = await apiFetch(`/nf/invoices/${id}`);
      setInvoice(inv);
    } catch (err: any) {
      setError(err?.message || t.notFound);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const downloadPdf = async () => {
    try {
      const res: { url: string } = await apiFetch(`/nf/invoices/${id}/pdf`);
      if (res?.url) window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast.error(err?.message || (lang === "pt" ? "Falha ao gerar link" : "Failed"));
    }
  };

  const executeAction = async () => {
    if (!invoice || !pendingAction) return;
    let newStatus: InvoiceStatus;
    let body: Record<string, any> = {};
    if (pendingAction === "approve") {
      newStatus = "aprovada";
    } else if (pendingAction === "pay") {
      newStatus = "paga";
    } else {
      newStatus = "recusada";
      if (!rejectNotes.trim()) {
        toast.error(t.reasonRequired);
        return;
      }
      body.notes = rejectNotes.trim();
    }
    body.status = newStatus;
    setActing(true);
    try {
      const updated: Invoice = await apiFetch(`/nf/invoices/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      setInvoice(updated);
      toast.success(
        pendingAction === "approve"
          ? t.approvedOk
          : pendingAction === "pay"
          ? t.paidOk
          : t.rejectedOk
      );
      setPendingAction(null);
      setRejectNotes("");
    } catch (err: any) {
      toast.error(err?.message || (lang === "pt" ? "Falha." : "Failed."));
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-danger" />
        <p className="text-sm text-muted">{error || t.notFound}</p>
        <button
          onClick={() => router.push("/")}
          className="mt-6 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
        >
          {t.back}
        </button>
      </div>
    );
  }

  // Acoes disponiveis por papel
  const canApprove =
    (role === "adm_campanha" || role === "admin") && invoice.status === "em_analise";
  const canReject =
    (role === "adm_campanha" || role === "admin") &&
    (invoice.status === "em_analise" || invoice.status === "aprovada");
  const canPay = role === "admin" && invoice.status === "aprovada";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        onClick={() => router.push("/")}
        className="mb-6 flex items-center gap-1.5 text-sm text-muted transition-opacity hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {t.back}
      </button>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t.invoice}</p>
          <h1 className="text-2xl font-semibold text-foreground">{invoice.invoice_number}</h1>
        </div>
        <StatusBadge status={invoice.status} lang={lang} />
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
        <Row label={t.amount} value={fmtCurrency(invoice.amount || 0, lang)} bold />
        <Row label={t.dueDate} value={fmtDate(invoice.due_date, lang)} />
        <Row label={t.refMonth} value={fmtRefMonth(invoice.reference_month, lang)} />
        <Row label={t.campaign} value={invoice.campaign || "—"} />
        {role !== "publisher" && (
          <Row
            label={t.publisher}
            value={
              invoice.publisher_name
                ? `${invoice.publisher_name}${
                    invoice.publisher_email ? ` (${invoice.publisher_email})` : ""
                  }`
                : invoice.publisher_email || invoice.publisher_id
            }
          />
        )}
        <Row label={t.createdAt} value={fmtDateTime(invoice.created_at, lang)} />

        {invoice.pdf_path && (
          <div className="border-t border-border pt-4">
            <button
              onClick={downloadPdf}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              <Download className="h-4 w-4" />
              {t.downloadPdf}
            </button>
          </div>
        )}

        {/* Auditoria de aprovacao/pagamento */}
        {(invoice.approved_by || invoice.paid_by) && (
          <div className="space-y-2 border-t border-border pt-4">
            {invoice.approved_by && (
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" />
                <p className="text-muted">
                  {t.approvedBy}:{" "}
                  <span className="font-medium text-foreground">
                    {invoice.approved_by_name || invoice.approved_by}
                  </span>{" "}
                  {invoice.approved_at && (
                    <span className="text-xs">— {fmtDateTime(invoice.approved_at, lang)}</span>
                  )}
                </p>
              </div>
            )}
            {invoice.paid_by && (
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                <p className="text-muted">
                  {t.paidBy}:{" "}
                  <span className="font-medium text-foreground">
                    {invoice.paid_by_name || invoice.paid_by}
                  </span>{" "}
                  {invoice.paid_at && (
                    <span className="text-xs">— {fmtDateTime(invoice.paid_at, lang)}</span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Motivo de recusa */}
        {invoice.status === "recusada" && invoice.notes && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-red-300">
              {t.rejectedNotes}
            </p>
            <p className="text-sm text-red-100/80">{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* Acoes */}
      {(canApprove || canReject || canPay) && (
        <div className="mt-6 flex flex-wrap gap-3">
          {canApprove && (
            <button
              onClick={() => setPendingAction("approve")}
              className="flex items-center gap-2 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25"
            >
              <CheckCircle2 className="h-4 w-4" />
              {t.approve}
            </button>
          )}
          {canPay && (
            <button
              onClick={() => setPendingAction("pay")}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              {t.markPaid}
            </button>
          )}
          {canReject && (
            <button
              onClick={() => setPendingAction("reject")}
              className="flex items-center gap-2 rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/25"
            >
              {t.reject}
            </button>
          )}
        </div>
      )}

      {pendingAction && (
        <ActionModal
          action={pendingAction}
          t={t}
          rejectNotes={rejectNotes}
          setRejectNotes={setRejectNotes}
          loading={acting}
          onCancel={() => {
            setPendingAction(null);
            setRejectNotes("");
          }}
          onConfirm={executeAction}
        />
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className={`text-right text-sm ${bold ? "font-semibold text-foreground" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function ActionModal({
  action,
  t,
  rejectNotes,
  setRejectNotes,
  loading,
  onCancel,
  onConfirm
}: {
  action: Action;
  t: any;
  rejectNotes: string;
  setRejectNotes: (v: string) => void;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const title =
    action === "approve" ? t.confirmApprove : action === "pay" ? t.confirmPay : t.confirmReject;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-zinc-950 px-6 py-4">
          <p className="text-base font-semibold text-orange-50">{title}</p>
          <button onClick={onCancel} className="text-orange-100/40 hover:text-orange-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          {action === "reject" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t.rejectionReason} <span className="text-primary">*</span>
              </label>
              <textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary/60"
              />
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground hover:bg-background"
            >
              {t.cancel}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading || (action === "reject" && !rejectNotes.trim())}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.saving}
                </>
              ) : (
                t.confirm
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
