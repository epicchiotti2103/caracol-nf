"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Upload, X } from "lucide-react";
import { apiFetchStrict } from "@/lib/api-error";
import { parseBrNumberOr0 } from "@/lib/number";
import { useToast } from "@/lib/toast-context";
import { fmtCurrency, fmtRefMonth } from "@/lib/i18n";
import { CONTAS_POR_MOEDA, CONTA_DEFAULT } from "@/lib/contas";
import {
  STALE_CODES,
  agingClass,
  ajustesPayload,
  campanhaLabel,
  parseRecebimentoError,
  residuoClass,
  somaAjustes,
  todayISO,
  type AjusteDraft
} from "@/lib/fechamento-recebimentos";
import { AjustesEditor } from "@/components/nf/ajustes-editor";
import type { FechamentoPendencia, Moeda } from "@/types";

const PROOF_MAX_MB = 10;
const PROOF_TYPES = ["image/png", "image/jpeg", "application/pdf"];

/**
 * Registrar um deposito do parceiro (Wave) quitando N fechamentos.
 *
 * So `selecionavel` (pendente + travado, decidido pelo backend) ganha
 * checkbox. O lote e de 1 cliente e 1 moeda: o primeiro marcado trava
 * cliente+moeda e desabilita o resto. Esperado x recebido e informativo —
 * diferenca = recebido - esperado (mesmo sinal do backend).
 */
export function WaveReceiveModal({
  items,
  onClose,
  onSaved,
  onStale
}: {
  items: FechamentoPendencia[];
  onClose: () => void;
  onSaved: () => void;
  onStale: () => void;
}) {
  const toast = useToast();
  const selecionaveis = useMemo(() => items.filter((i) => i.selecionavel), [items]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [data, setData] = useState(todayISO());
  const [valor, setValor] = useState("");
  // Se o usuario nao mexeu no valor, ele acompanha a soma dos selecionados.
  const [valorTouched, setValorTouched] = useState(false);
  const [conta, setConta] = useState<string>(CONTA_DEFAULT.USD);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [ajustes, setAjustes] = useState<AjusteDraft[]>([]);

  const selectedItems = selecionaveis.filter((i) => selected.has(i.fechamento_id));
  const first = selectedItems[0];
  const lockClient = first?.client_id ?? null;
  const moeda: Moeda = first?.moeda ?? "USD";

  // Quando a lista recarrega (409 de lista velha), tira da selecao o que
  // deixou de ser selecionavel.
  useEffect(() => {
    setSelected((prev) => {
      const ok = new Set(selecionaveis.map((i) => i.fechamento_id));
      const next = new Set(Array.from(prev).filter((id) => ok.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [selecionaveis]);

  // Conta default acompanha a moeda do lote.
  useEffect(() => {
    if (!CONTAS_POR_MOEDA[moeda].some((c) => c.value === conta)) {
      setConta(CONTA_DEFAULT[moeda]);
    }
  }, [moeda, conta]);

  const esperado = selectedItems.reduce((s, i) => s + (i.a_receber || 0), 0);
  useEffect(() => {
    if (!valorTouched) {
      setValor(esperado > 0 ? esperado.toFixed(2).replace(".", ",") : "");
    }
  }, [esperado, valorTouched]);
  const recebido = parseBrNumberOr0(valor);
  const diferenca = recebido - esperado;
  const { custos, provisionados } = somaAjustes(ajustes);
  const temAjuste = custos > 0 || provisionados > 0;
  const deveriaCair = esperado - custos - provisionados;
  const residuo = recebido - deveriaCair;

  const isCompatible = (i: FechamentoPendencia) =>
    !first || (i.client_id === lockClient && i.moeda === moeda);

  const toggle = (i: FechamentoPendencia) => {
    if (!isCompatible(i) && !selected.has(i.fechamento_id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i.fechamento_id) ? next.delete(i.fechamento_id) : next.add(i.fechamento_id);
      return next;
    });
  };

  // Agrupado por mes (ordem do backend: mes, codigo)
  const grupos = useMemo(() => {
    const m = new Map<string, FechamentoPendencia[]>();
    for (const i of selecionaveis) {
      const k = (i.mes_referencia || "").slice(0, 7);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(i);
    }
    return Array.from(m.entries());
  }, [selecionaveis]);

  const toggleMes = (list: FechamentoPendencia[]) => {
    const elegiveis = list.filter(isCompatible);
    // Se nada estiver marcado ainda, o 1o item da lista define cliente/moeda.
    const base = first ?? elegiveis[0];
    const alvo = elegiveis.filter(
      (i) => !base || (i.client_id === base.client_id && i.moeda === base.moeda)
    );
    const todos = alvo.length > 0 && alvo.every((i) => selected.has(i.fechamento_id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of alvo) todos ? next.delete(i.fechamento_id) : next.add(i.fechamento_id);
      return next;
    });
  };

  const submit = async () => {
    setError("");
    if (selectedItems.length === 0) return setError("Selecione ao menos um fechamento.");
    if (!data) return setError("Informe a data do recebimento.");
    if (!(recebido > 0)) return setError("Informe o valor recebido (maior que zero).");
    if (file && !PROOF_TYPES.includes(file.type))
      return setError("Comprovante deve ser PNG, JPEG ou PDF.");
    if (file && file.size > PROOF_MAX_MB * 1024 * 1024)
      return setError("Comprovante excede 10MB.");
    const aj = ajustesPayload(ajustes);
    if (!aj.ok) return setError(aj.error);

    const fd = new FormData();
    fd.append("client_id", first!.client_id);
    fd.append("received_at", data);
    fd.append("amount", String(recebido));
    fd.append("fechamento_ids", selectedItems.map((i) => i.fechamento_id).join(","));
    fd.append("moeda", moeda);
    fd.append("conta", conta);
    if (notes.trim()) fd.append("notes", notes.trim());
    if (file) fd.append("proof", file);
    if (aj.ajustes.length > 0) fd.append("ajustes", JSON.stringify(aj.ajustes));

    setSaving(true);
    try {
      await apiFetchStrict("/nf/fechamento-recebimentos", { method: "POST", body: fd });
      toast.success(
        `Pagamento registrado: ${selectedItems.length} ${selectedItems.length === 1 ? "fechamento quitado" : "fechamentos quitados"}.`
      );
      onSaved();
      onClose();
    } catch (err) {
      const e = parseRecebimentoError(err, "Falha ao registrar o pagamento.");
      setError(e.message);
      setFlagged(new Set(e.fechamentoIds));
      if (e.code && STALE_CODES.includes(e.code)) onStale();
    } finally {
      setSaving(false);
    }
  };

  const sym = moeda === "BRL" ? "R$" : "US$";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Registrar pagamento</h2>
            <p className="text-xs text-muted">
              Marque os fechamentos que o deposito quita. Sem NF e sem pagamento parcial.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-background hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {selecionaveis.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              Nenhum fechamento pendente e travado para receber.
            </p>
          ) : (
            <div className="space-y-4">
              {first && (
                <p className="text-xs text-muted">
                  Lote de <span className="text-foreground">{first.client_name || "cliente"}</span> em{" "}
                  <span className="text-foreground">{moeda}</span>. Itens de outro cliente/moeda ficam
                  desabilitados.
                </p>
              )}
              {grupos.map(([mes, list]) => (
                <div key={mes}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {fmtRefMonth(mes, "pt")}
                    </p>
                    <button
                      onClick={() => toggleMes(list)}
                      className="text-xs text-primary hover:underline"
                    >
                      Marcar/desmarcar mes
                    </button>
                  </div>
                  <ul className="space-y-1.5">
                    {list.map((i) => {
                      const checked = selected.has(i.fechamento_id);
                      const disabled = !checked && !isCompatible(i);
                      const isFlagged = flagged.has(i.fechamento_id);
                      return (
                        <li key={i.fechamento_id}>
                          <label
                            className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                              disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
                            } ${
                              isFlagged
                                ? "border-danger/50 bg-danger/5"
                                : checked
                                  ? "border-primary/40 bg-primary/5"
                                  : "border-border bg-background hover:border-primary/40"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled || saving}
                              onChange={() => toggle(i)}
                              className="h-4 w-4 accent-primary"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-foreground">
                                {campanhaLabel(i.campanha_codigo, i.campanha_name)}
                              </p>
                              <p className="text-xs text-muted">
                                {i.client_name || "—"}
                                {i.dias_em_aberto != null && (
                                  <>
                                    {" · "}
                                    <span className={agingClass(i.dias_em_aberto)}>
                                      {i.dias_em_aberto} dias em aberto
                                    </span>
                                  </>
                                )}
                              </p>
                            </div>
                            <span className="flex-shrink-0 font-mono text-sm text-foreground">
                              {fmtCurrency(i.a_receber, i.moeda, "pt")}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border px-5 py-4">
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="text-xs text-muted">
              Data do recebimento
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary/50"
              />
            </label>
            <label className="text-xs text-muted">
              Valor recebido ({sym})
              <input
                value={valor}
                onChange={(e) => {
                  setValorTouched(true);
                  setValor(e.target.value);
                }}
                inputMode="decimal"
                placeholder="0,00"
                className="mt-1 block w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary/50"
              />
            </label>
            <label className="text-xs text-muted">
              Entrou em qual conta?
              <select
                value={conta}
                onChange={(e) => setConta(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary/50"
              >
                {CONTAS_POR_MOEDA[moeda].map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-2 text-xs text-muted">
              Notas (opcional)
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: deposito Wave ref. maio+junho"
                className="mt-1 block w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary/50"
              />
            </label>
            <label className="col-span-2 text-xs text-muted sm:col-span-1">
              Comprovante (opcional)
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
                <Upload className="h-3.5 w-3.5 flex-shrink-0 text-muted" />
                <input
                  key={fileInputKey}
                  type="file"
                  accept="image/png,image/jpeg,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="min-w-0 flex-1 text-xs text-foreground file:hidden"
                />
              </div>
            </label>
          </div>

          {file && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-xs text-muted">Arquivo: {file.name}</p>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setFileInputKey((k) => k + 1);
                }}
                className="flex-shrink-0 text-xs font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
              >
                Remover anexo
              </button>
            </div>
          )}

          {error && (
            <div className="mb-2 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/10 p-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-danger" />
              <p className="text-xs text-danger">{error}</p>
            </div>
          )}

          <div className="mb-3 rounded-lg border border-border px-3 py-2">
            <p className="mb-1.5 text-xs font-semibold text-muted">
              Ajustes (opcional){" "}
              <span className="font-normal">
                — custo descontado do deposito ou parte provisionada que ainda vai cair
              </span>
            </p>
            <AjustesEditor value={ajustes} onChange={setAjustes} sym={sym} disabled={saving} />
          </div>

          <div className="mb-3 space-y-1 rounded-lg bg-background px-3 py-2 text-sm">
            <div className="flex justify-between text-muted">
              <span>
                Esperado ({selectedItems.length}{" "}
                {selectedItems.length === 1 ? "fechamento" : "fechamentos"})
              </span>
              <span className="font-mono">{fmtCurrency(esperado, moeda, "pt")}</span>
            </div>
            {temAjuste && (
              <>
                {custos > 0 && (
                  <div className="flex justify-between text-muted">
                    <span>− Custos</span>
                    <span className="font-mono">{fmtCurrency(custos, moeda, "pt")}</span>
                  </div>
                )}
                {provisionados > 0 && (
                  <div className="flex justify-between text-muted">
                    <span>− Provisionados</span>
                    <span className="font-mono">{fmtCurrency(provisionados, moeda, "pt")}</span>
                  </div>
                )}
                <div className="flex justify-between text-foreground">
                  <span>Deveria cair</span>
                  <span className="font-mono">{fmtCurrency(deveriaCair, moeda, "pt")}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-muted">
              <span>Recebido</span>
              <span className="font-mono">{fmtCurrency(recebido, moeda, "pt")}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1 font-semibold text-foreground">
              <span>
                {temAjuste ? "Residuo (recebido − deveria cair)" : "Diferenca (recebido − esperado)"}
              </span>
              <span
                className={`font-mono ${
                  selectedItems.length === 0 ? "text-emerald-400" : residuoClass(temAjuste ? residuo : diferenca)
                }`}
              >
                {fmtCurrency(temAjuste ? residuo : diferenca, moeda, "pt")}
              </span>
            </div>
            {selectedItems.length > 0 && Math.abs(temAjuste ? residuo : diferenca) >= 0.005 && (
              <p className="pt-1 text-[11px] text-muted">
                {temAjuste ? "Residuo" : "Diferenca"} e so informativo (cambio/taxa). No caixa vale o
                valor recebido.
              </p>
            )}
            {provisionados > 0 && (
              <p className="pt-1 text-[11px] text-muted">
                Provisionado vira receita pendente no Gerencial ate ser marcado como recebido.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={saving || selectedItems.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-black hover:bg-primary/90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Registrando…" : `Registrar ${selectedItems.length || ""} recebido(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
