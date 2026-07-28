"use client";

import { useState } from "react";
import { FileUp, Loader2, Upload, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { NfReceivable } from "@/types";

const MAX_PROOF_MB = 10;
const ALLOWED_MIME = ["image/png", "image/jpeg", "application/pdf"];

interface Props {
  receivable: NfReceivable;
  onClose: () => void;
  onSaved: (saved: NfReceivable) => void;
}

/**
 * Modal de marcar NF a Receber como recebida.
 *
 * Backend: POST /api/v1/nf/receivables/{id}/receive (multipart, campo `proof`
 * PNG/JPEG/PDF max 10MB **opcional**). So funciona em status=pendente.
 * Diferente da NF a pagar, onde o comprovante continua obrigatorio.
 */
export function ReceivableReceiveModal({ receivable, onClose, onSaved }: Props) {
  const [proof, setProof] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const validate = (): string | null => {
    // Comprovante e opcional — so valida se o usuario anexou algo.
    if (proof) {
      if (!ALLOWED_MIME.includes(proof.type)) {
        return "Formato invalido (aceitos: PNG, JPEG, PDF).";
      }
      if (proof.size > MAX_PROOF_MB * 1024 * 1024) {
        return `Arquivo excede ${MAX_PROOF_MB}MB.`;
      }
    }
    return null;
  };

  const onSubmit = async () => {
    setError("");
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      if (proof) fd.append("proof", proof);
      const saved: NfReceivable = await apiFetch(
        `/nf/receivables/${receivable.id}/receive`,
        { method: "POST", body: fd }
      );
      onSaved(saved);
    } catch (err: any) {
      // Backend antigo (ainda sem restart) devolve 422 com `detail` em array —
      // `err.message` vira "[object Object]". Cai no fallback legivel.
      const raw = typeof err?.message === "string" ? err.message : "";
      setError(
        raw && !raw.includes("[object Object]")
          ? raw
          : "Falha ao marcar como recebida. Tente novamente ou anexe o comprovante."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-zinc-950 px-6 py-4">
          <p className="text-base font-semibold text-orange-50">
            Marcar como recebida
            {receivable.invoice_number ? ` — #${receivable.invoice_number}` : ""}
          </p>
          <button
            onClick={onClose}
            className="text-orange-100/40 hover:text-orange-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-sm text-muted">
            Se quiser, anexe o comprovante de pagamento (PIX/TED/PDF) — e{" "}
            <span className="text-foreground">opcional</span>. Aceita PNG, JPEG
            ou PDF, max {MAX_PROOF_MB}MB.
          </p>

          <label
            htmlFor="receivable-proof"
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 transition-colors hover:bg-background ${
              proof ? "border-primary/50" : "border-border"
            }`}
          >
            {proof ? (
              <>
                <FileUp className="h-5 w-5 text-primary" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">{proof.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {(proof.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background">
                  <Upload className="h-4 w-4 text-muted" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    Clique para selecionar
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Comprovante (opcional) — max. {MAX_PROOF_MB} MB
                  </p>
                </div>
              </>
            )}
            <input
              // remonta o input ao limpar, senao re-selecionar o mesmo arquivo
              // nao dispara onChange (value do input fica preso)
              key={proof ? proof.name : "empty"}
              id="receivable-proof"
              type="file"
              accept="image/png,image/jpeg,application/pdf"
              className="sr-only"
              onChange={(e) => setProof(e.target.files?.[0] ?? null)}
            />
          </label>

          {proof && (
            <button
              type="button"
              onClick={() => setProof(null)}
              className="text-xs font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
            >
              Remover anexo
            </button>
          )}

          {error && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-3 border-t border-border bg-surface px-6 py-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground hover:bg-background disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Confirmando...
              </>
            ) : (
              "Confirmar recebimento"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
