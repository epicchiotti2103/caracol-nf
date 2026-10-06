"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Undo2, X } from "lucide-react";
import { apiFetchStrict, ApiHttpError, readableError } from "@/lib/api-error";
import { fmtCurrency, fmtDateOnly } from "@/lib/i18n";
import { contaLabel } from "@/lib/contas";
import type { FechamentoRecebimento } from "@/types";

/**
 * Confirmacao in-app do "desfazer" de um lote de recebimento Wave.
 * DELETE /nf/fechamento-recebimentos/{id} -> 204 (soft delete; fechamentos
 * voltam a pendente). 404 = ja desfeito -> trata como sucesso.
 */
export function UndoRecebimentoModal({
  lote,
  onClose,
  onDone
}: {
  lote: FechamentoRecebimento;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const n = lote.fechamentos?.length || 0;

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await apiFetchStrict(`/nf/fechamento-recebimentos/${lote.id}`, { method: "DELETE" });
      onDone();
    } catch (err) {
      if ((err as ApiHttpError)?.status === 404) {
        onDone();
        return;
      }
      setError(readableError(err, "Falha ao desfazer o pagamento."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Desfazer pagamento</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-background hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm">
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
            <p className="text-xs text-amber-200">
              O lote some do historico e {n === 1 ? "o fechamento volta" : `os ${n} fechamentos voltam`} a
              ficar pendente{n === 1 ? "" : "s"}. O Gerencial deixa de contar esse recebimento no caixa.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-y-1 text-xs">
            <dt className="text-muted">Cliente</dt>
            <dd className="text-right text-foreground">{lote.client_name || "—"}</dd>
            <dt className="text-muted">Data</dt>
            <dd className="text-right text-foreground">{fmtDateOnly(lote.received_at, "pt")}</dd>
            <dt className="text-muted">Valor</dt>
            <dd className="text-right font-mono text-foreground">
              {fmtCurrency(lote.amount, lote.moeda, "pt")}
            </dd>
            <dt className="text-muted">Conta</dt>
            <dd className="text-right text-foreground">{contaLabel(lote.moeda, lote.conta)}</dd>
          </dl>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
            {busy ? "Desfazendo…" : "Desfazer"}
          </button>
        </div>
      </div>
    </div>
  );
}
