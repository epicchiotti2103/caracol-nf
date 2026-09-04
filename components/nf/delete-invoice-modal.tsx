"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { apiFetchStrict, ApiHttpError, readableError } from "@/lib/api-error";
import { fmtCurrency, type Lang } from "@/lib/i18n";
import type { Invoice } from "@/types";

/**
 * Modal de confirmacao do soft delete de NF a pagar.
 *
 * Contrato do backend: `DELETE /nf/invoices/{id}` -> 204. Body opcional
 * `{"reason": "..."}` (mandamos sempre um objeto JSON, com `reason` so quando
 * preenchido — funciona tanto se o backend declarar o body opcional quanto
 * como model). Erros tratados: 403 (sem permissao), 409 (NF ja paga — mostra
 * o `detail` do backend), 404 (ja apagada -> trata como sucesso, so some da
 * lista).
 *
 * A acao so chega aqui quando `can_delete_invoices` do GET /nf/me/role e true
 * (ver `useCanDeleteInvoices`), entao nao ha gating por email no front.
 */
export function DeleteInvoiceModal({
  invoice,
  lang = "pt",
  onClose,
  onDeleted
}: {
  invoice: Invoice;
  lang?: Lang;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const t = {
    title: lang === "pt" ? "Apagar NF" : "Delete invoice",
    warn:
      lang === "pt"
        ? "A NF sai das listas e dos totais. Confira os dados antes de confirmar."
        : "The invoice leaves every list and total. Double-check before confirming.",
    supplier: lang === "pt" ? "Fornecedor" : "Supplier",
    amount: lang === "pt" ? "Valor" : "Amount",
    number: lang === "pt" ? "Numero da NF" : "Invoice number",
    reasonLabel: lang === "pt" ? "Motivo (opcional)" : "Reason (optional)",
    reasonPlaceholder:
      lang === "pt" ? "Ex: cadastrada em duplicidade" : "e.g. duplicated entry",
    cancel: lang === "pt" ? "Cancelar" : "Cancel",
    confirm: lang === "pt" ? "Apagar" : "Delete",
    deleting: lang === "pt" ? "Apagando..." : "Deleting...",
    forbidden:
      lang === "pt"
        ? "Voce nao tem permissao pra apagar NF."
        : "You are not allowed to delete invoices.",
    fail: lang === "pt" ? "Falha ao apagar a NF." : "Failed to delete the invoice."
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    const trimmed = reason.trim();
    try {
      await apiFetchStrict(`/nf/invoices/${invoice.id}`, {
        method: "DELETE",
        body: JSON.stringify(trimmed ? { reason: trimmed } : {})
      });
      onDeleted();
      return;
    } catch (err: any) {
      const status = err instanceof ApiHttpError ? err.status : 0;
      // 404 = ja nao existe. Do ponto de vista do usuario o efeito e o mesmo.
      if (status === 404) {
        onDeleted();
        return;
      }
      if (status === 403) {
        setError(t.forbidden);
      } else if (status === 409) {
        // NF ja paga (ou outro conflito): o backend explica no detail.
        const detail = (err as ApiHttpError).detail;
        const msg =
          typeof detail === "string"
            ? detail
            : typeof (detail as any)?.message === "string"
              ? (detail as any).message
              : readableError(err, t.fail);
        setError(msg);
      } else {
        setError(readableError(err, t.fail));
      }
    } finally {
      setBusy(false);
    }
  };

  const supplierName = invoice.supplier_name ?? invoice.publisher_name ?? "—";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-zinc-950 px-6 py-4">
          <p className="text-base font-semibold text-orange-50">{t.title}</p>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-orange-100/40 hover:text-orange-50 disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
            <p className="text-sm text-danger">{t.warn}</p>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-background p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">{t.number}</span>
              <span className="font-medium text-foreground">
                {invoice.invoice_number}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">{t.supplier}</span>
              <span className="truncate font-medium text-foreground">
                {supplierName}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">{t.amount}</span>
              <span className="font-medium text-foreground">
                {fmtCurrency(invoice.amount || 0, invoice.moeda || "BRL", lang)}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              {t.reasonLabel}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder={t.reasonPlaceholder}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary/60"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground hover:bg-background disabled:opacity-50"
            >
              {t.cancel}
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-danger py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.deleting}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  {t.confirm}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
