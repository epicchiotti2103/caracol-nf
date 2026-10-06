"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetchStrict, ApiHttpError } from "@/lib/api-error";
import { fmtCurrency, fmtDateOnly } from "@/lib/i18n";
import {
  AJUSTE_STATUS,
  AJUSTE_TIPO_LABEL,
  ajustesPayload,
  novoAjusteDraft,
  parseRecebimentoError,
  residuoClass,
  somaAjustes,
  todayISO,
  type AjusteDraft
} from "@/lib/fechamento-recebimentos";
import { AjustesEditor } from "@/components/nf/ajustes-editor";
import type { FechamentoRecebimento, FechamentoRecebimentoAjuste } from "@/types";

/**
 * Bloco de ajustes de um lote no historico: lista (tipo, descricao, valor,
 * status), deveria cair / residuo e as acoes (+ ajuste, remover, marcar
 * provisionado recebido). As acoes abrem modais in-app; o pai so recarrega.
 */
export function LoteAjustes({
  lote,
  onChanged
}: {
  lote: FechamentoRecebimento;
  onChanged: (msg: string) => void;
}) {
  const { isAdmin } = useAuth();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<FechamentoRecebimentoAjuste | null>(null);
  const [marking, setMarking] = useState<FechamentoRecebimentoAjuste | null>(null);
  const ajustes = lote.ajustes || [];
  const temAjuste = ajustes.length > 0;

  return (
    <div className="mt-2 space-y-1">
      {temAjuste && (
        <ul className="space-y-1 rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 text-xs">
          {ajustes.map((a) => {
            const st = AJUSTE_STATUS[a.status] || AJUSTE_STATUS.pendente;
            const podeMarcar = a.tipo === "provisionado" && a.status === "pendente" && !!a.gerencial_transaction_id;
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-muted">{AJUSTE_TIPO_LABEL[a.tipo]}:</span>
                <span className="min-w-0 flex-1 truncate text-foreground" title={a.descricao}>
                  {a.descricao}
                </span>
                <span className="font-mono text-foreground">{fmtCurrency(a.valor, lote.moeda, "pt")}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${st.cls}`}>
                  {st.label}
                  {a.status === "recebido" && a.recebido_em ? ` ${fmtDateOnly(a.recebido_em, "pt")}` : ""}
                </span>
                {podeMarcar && (
                  <button
                    onClick={() => isAdmin && setMarking(a)}
                    disabled={!isAdmin}
                    title={
                      isAdmin
                        ? "Marcar o provisionado como recebido (Gerencial)"
                        : "So admin do hub pode marcar recebido (lancamento do Gerencial)"
                    }
                    className="flex items-center gap-0.5 text-[11px] text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Marcar recebido
                  </button>
                )}
                <button
                  onClick={() => setRemoving(a)}
                  className="rounded p-0.5 text-muted hover:text-danger"
                  title="Remover ajuste"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            );
          })}
          {lote.deveria_cair != null && (
            <li className="flex justify-between border-t border-border/60 pt-1 text-muted">
              <span>
                Deveria cair{" "}
                <span className="font-mono text-foreground">
                  {fmtCurrency(lote.deveria_cair, lote.moeda, "pt")}
                </span>
              </span>
              <span>
                Residuo{" "}
                <span className={`font-mono ${residuoClass(lote.residuo)}`}>
                  {fmtCurrency(lote.residuo || 0, lote.moeda, "pt")}
                </span>
              </span>
            </li>
          )}
        </ul>
      )}
      <button
        onClick={() => setAdding(true)}
        className="flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
      >
        <Plus className="h-3 w-3" />
        ajuste
      </button>

      {adding && (
        <AddAjusteModal
          lote={lote}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            onChanged("Ajuste adicionado.");
          }}
        />
      )}
      {removing && (
        <RemoveAjusteModal
          lote={lote}
          ajuste={removing}
          onClose={() => setRemoving(null)}
          onDone={() => {
            setRemoving(null);
            onChanged("Ajuste removido.");
          }}
        />
      )}
      {marking && (
        <MarkRecebidoModal
          lote={lote}
          ajuste={marking}
          onClose={() => setMarking(null)}
          onDone={() => {
            setMarking(null);
            onChanged("Provisionado marcado como recebido.");
          }}
        />
      )}
    </div>
  );
}

function Shell({
  title,
  onClose,
  children,
  footer,
  wide
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className={`w-full ${wide ? "max-w-xl" : "max-w-md"} rounded-xl border border-border bg-surface shadow-xl`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-background hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm">{children}</div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
      </div>
    </div>
  );
}

function ErrorLine({ error }: { error: string }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/10 p-2">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-danger" />
      <p className="text-xs text-danger">{error}</p>
    </div>
  );
}

function CancelBtn({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground disabled:opacity-50"
    >
      Cancelar
    </button>
  );
}

function AddAjusteModal({
  lote,
  onClose,
  onDone
}: {
  lote: FechamentoRecebimento;
  onClose: () => void;
  onDone: () => void;
}) {
  const [rows, setRows] = useState<AjusteDraft[]>(() => [novoAjusteDraft()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sym = lote.moeda === "BRL" ? "R$" : "US$";

  const { custos, provisionados } = somaAjustes(rows);
  const deveriaAtual = lote.deveria_cair ?? lote.esperado;
  const deveriaNovo = deveriaAtual - custos - provisionados;
  const residuoNovo = (lote.amount || 0) - deveriaNovo;

  const submit = async () => {
    setError("");
    const aj = ajustesPayload(rows);
    if (!aj.ok) return setError(aj.error);
    if (aj.ajustes.length === 0) return setError("Preencha ao menos um ajuste.");
    setBusy(true);
    try {
      await apiFetchStrict(`/nf/fechamento-recebimentos/${lote.id}/ajustes`, {
        method: "POST",
        body: JSON.stringify({ ajustes: aj.ajustes })
      });
      onDone();
    } catch (err) {
      setError(parseRecebimentoError(err, "Falha ao adicionar ajuste.").message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      title="Adicionar ajuste ao lote"
      onClose={onClose}
      wide
      footer={
        <>
          <CancelBtn onClick={onClose} disabled={busy} />
          <button
            onClick={submit}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-black hover:bg-primary/90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Salvando…" : "Adicionar"}
          </button>
        </>
      }
    >
      <p className="text-xs text-muted">
        Lote de {lote.client_name || "cliente"} em {fmtDateOnly(lote.received_at, "pt")} ·{" "}
        {fmtCurrency(lote.amount, lote.moeda, "pt")}
      </p>
      <AjustesEditor value={rows} onChange={setRows} sym={sym} disabled={busy} />
      <div className="space-y-1 rounded-lg bg-background px-3 py-2 text-xs">
        <div className="flex justify-between text-muted">
          <span>Deveria cair (atual)</span>
          <span className="font-mono">{fmtCurrency(deveriaAtual, lote.moeda, "pt")}</span>
        </div>
        <div className="flex justify-between text-foreground">
          <span>Deveria cair (com os novos)</span>
          <span className="font-mono">{fmtCurrency(deveriaNovo, lote.moeda, "pt")}</span>
        </div>
        <div className="flex justify-between font-semibold text-foreground">
          <span>Residuo (recebido − deveria cair)</span>
          <span className={`font-mono ${residuoClass(residuoNovo)}`}>
            {fmtCurrency(residuoNovo, lote.moeda, "pt")}
          </span>
        </div>
      </div>
      <ErrorLine error={error} />
    </Shell>
  );
}

function RemoveAjusteModal({
  lote,
  ajuste,
  onClose,
  onDone
}: {
  lote: FechamentoRecebimento;
  ajuste: FechamentoRecebimentoAjuste;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await apiFetchStrict(`/nf/fechamento-recebimentos/${lote.id}/ajustes/${ajuste.id}`, {
        method: "DELETE"
      });
      onDone();
    } catch (err) {
      // 404 = ajuste ja nao existe nesse lote -> trata como removido.
      if ((err as ApiHttpError)?.status === 404) return onDone();
      setError(parseRecebimentoError(err, "Falha ao remover ajuste.").message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      title="Remover ajuste"
      onClose={onClose}
      footer={
        <>
          <CancelBtn onClick={onClose} disabled={busy} />
          <button
            onClick={submit}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {busy ? "Removendo…" : "Remover"}
          </button>
        </>
      }
    >
      <p className="text-xs text-muted">
        O ajuste sai do lote e o lancamento correspondente e apagado do Gerencial.
      </p>
      <dl className="grid grid-cols-2 gap-y-1 text-xs">
        <dt className="text-muted">Tipo</dt>
        <dd className="text-right text-foreground">{AJUSTE_TIPO_LABEL[ajuste.tipo]}</dd>
        <dt className="text-muted">Descricao</dt>
        <dd className="text-right text-foreground">{ajuste.descricao}</dd>
        <dt className="text-muted">Valor</dt>
        <dd className="text-right font-mono text-foreground">
          {fmtCurrency(ajuste.valor, lote.moeda, "pt")}
        </dd>
      </dl>
      <ErrorLine error={error} />
    </Shell>
  );
}

function MarkRecebidoModal({
  lote,
  ajuste,
  onClose,
  onDone
}: {
  lote: FechamentoRecebimento;
  ajuste: FechamentoRecebimentoAjuste;
  onClose: () => void;
  onDone: () => void;
}) {
  const [data, setData] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!ajuste.gerencial_transaction_id) return;
    setBusy(true);
    setError("");
    const fd = new FormData();
    // Meio-dia UTC pra data nao escorregar de dia no fuso.
    if (data) fd.append("paid_at", `${data}T12:00:00+00:00`);
    try {
      await apiFetchStrict(
        `/gerencial/transactions/${ajuste.gerencial_transaction_id}/mark-paid`,
        { method: "POST", body: fd }
      );
      onDone();
    } catch (err) {
      const status = (err as ApiHttpError)?.status;
      setError(
        status === 403
          ? "So admin do hub pode marcar recebido."
          : status === 404
            ? "O lancamento desse provisionado nao existe mais no Gerencial."
            : parseRecebimentoError(err, "Falha ao marcar como recebido.").message
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      title="Marcar provisionado recebido"
      onClose={onClose}
      footer={
        <>
          <CancelBtn onClick={onClose} disabled={busy} />
          <button
            onClick={submit}
            disabled={busy || !data}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-black hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {busy ? "Salvando…" : "Marcar recebido"}
          </button>
        </>
      }
    >
      <p className="text-xs text-muted">
        {ajuste.descricao} · {fmtCurrency(ajuste.valor, lote.moeda, "pt")} ({lote.client_name || "cliente"})
      </p>
      <label className="block text-xs text-muted">
        Data do recebimento
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary/50"
        />
      </label>
      <p className="text-[11px] text-muted">
        Para desfazer, use "desmarcar pago" no lancamento do Gerencial.
      </p>
      <ErrorLine error={error} />
    </Shell>
  );
}
