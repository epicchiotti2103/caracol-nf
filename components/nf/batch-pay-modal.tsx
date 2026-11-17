"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Loader2, Upload, AlertCircle, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { fetchAllInvoices } from "@/lib/fetch-all-invoices";
import { parseBrNumberOr0 } from "@/lib/number";
import {
  apiFetchStrict,
  duplicateDetail,
  readableError,
  type DuplicateDetail
} from "@/lib/api-error";
import { DuplicateConfirmModal } from "@/components/nf/duplicate-confirm-modal";
import { useToast } from "@/lib/toast-context";
import { fmtCurrency } from "@/lib/i18n";
import { CONTAS_POR_MOEDA, CONTA_DEFAULT } from "@/lib/contas";
import type { Invoice, Moeda } from "@/types";

const PROOF_MAX_MB = 10;
const PROOF_TYPES = ["image/png", "image/jpeg", "application/pdf"];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Pre-check de duplicidade (GET /nf/payment-batches/duplicate-check).
// `no_lote: true` = duas selecionadas do mesmo fornecedor cobrem o mesmo mes
// (invoice_id = a selecionada). Sem `no_lote` = NF JA PAGA (invoice_id/number
// = a paga) cobrindo a competencia de uma selecionada (`conflita_com`).
interface DupOverlap {
  invoice_id: string;
  invoice_number?: string | null;
  competencia?: string | null;
  valor?: number | null;
  amount?: number | null;
  status?: string | null;
  no_lote?: boolean;
  conflita_com?: string | null;
}

interface DupWarning {
  key: string;
  text: string;
}

function fmtComp(c?: string | null): string {
  if (!c) return "?";
  const m = /^(\d{4})-(\d{2})/.exec(c);
  return m ? `${m[2]}/${m[1]}` : c;
}

function moedaOf(inv: Invoice): Moeda {
  return (inv.moeda || "BRL").toString().toUpperCase() === "USD" ? "USD" : "BRL";
}

export function BatchPayModal({ onClose, onPaid }: { onClose: () => void; onPaid: () => void }) {
  const toast = useToast();
  const [aprovadas, setAprovadas] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [moeda, setMoeda] = useState<Moeda>("BRL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fee, setFee] = useState("40,00");
  const [data, setData] = useState(todayISO());
  // De qual conta saiu o dinheiro — opcoes dependem da moeda do lote
  const [conta, setConta] = useState<string>(CONTA_DEFAULT.BRL);
  const [file, setFile] = useState<File | null>(null);
  // Contador so pra remontar o <input type="file"> quando o usuario REMOVE o
  // anexo — sem isso, re-selecionar o mesmo arquivo nao dispara onChange.
  // Nao pode depender do nome: o input e visivel (`file:hidden` deixa so o
  // texto nativo), e remontar ao SELECIONAR apagaria o nome da tela.
  const [fileInputKey, setFileInputKey] = useState(0);
  const [saving, setSaving] = useState(false);
  // 409 `duplicate_payment_warning` do lote (competencia ja paga).
  const [dupDetail, setDupDetail] = useState<DuplicateDetail | null>(null);
  // Aviso antecipado: conflitos detectados assim que a selecao muda (antes
  // de transferir/anexar). Nao bloqueia — o 409 no POST segue como 2a barreira.
  const [overlaps, setOverlaps] = useState<DupOverlap[]>([]);
  const [checking, setChecking] = useState(false);
  const checkSeq = useRef(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        // Todas as aprovadas (paginando) — "selecionar todas" cobre o conjunto completo.
        const items = await fetchAllInvoices("status=aprovada");
        setAprovadas(items.filter((i) => i.status === "aprovada"));
      } catch (err: any) {
        setError(readableError(err, "Falha ao carregar NFs aprovadas."));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const doMoeda = aprovadas.filter((i) => moedaOf(i) === moeda);
  const selectedInvoices = doMoeda.filter((i) => selected.has(i.id));
  const somaNfs = selectedInvoices.reduce((s, i) => s + (i.amount || 0), 0);
  const feeNum = useMemo(() => {
    return parseBrNumberOr0(fee);
  }, [fee]);
  const totalSaida = somaNfs + feeNum;

  // Chave estavel da selecao (so ids da moeda atual, ordenados).
  const selKey = useMemo(
    () => selectedInvoices.map((i) => i.id).sort().join(","),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, aprovadas, moeda]
  );

  useEffect(() => {
    const seq = ++checkSeq.current;
    if (!selKey) {
      setOverlaps([]);
      setChecking(false);
      return;
    }
    const ctrl = new AbortController();
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const res: { overlaps?: DupOverlap[] } | null = await apiFetch(
          `/nf/payment-batches/duplicate-check?invoice_ids=${encodeURIComponent(selKey)}`,
          { signal: ctrl.signal }
        );
        if (seq !== checkSeq.current) return;
        setOverlaps(Array.isArray(res?.overlaps) ? res!.overlaps : []);
      } catch {
        // Backend ainda sem o endpoint / erro de rede: falha em silencio.
        if (seq !== checkSeq.current) return;
        setOverlaps([]);
      } finally {
        if (seq === checkSeq.current) setChecking(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [selKey]);

  // Avisos legiveis + ids das selecionadas em conflito (pra badge na lista).
  const { warnings, conflictIds } = useMemo(() => {
    const byId = new Map(aprovadas.map((i) => [i.id, i]));
    const selIds = new Set(selKey ? selKey.split(",") : []);
    const ids = new Set<string>();
    const out: DupWarning[] = [];
    const numOf = (id: string) => byId.get(id)?.invoice_number || id.slice(0, 8);

    // Ja pagas
    for (const o of overlaps) {
      if (o.no_lote || !o.conflita_com || !selIds.has(o.conflita_com)) continue;
      ids.add(o.conflita_com);
      const v = o.valor ?? o.amount;
      out.push({
        key: `pago:${o.conflita_com}:${o.invoice_id}:${o.competencia}`,
        text: `NF ${numOf(o.conflita_com)} — competência ${fmtComp(o.competencia)} já paga na NF ${
          o.invoice_number || o.invoice_id.slice(0, 8)
        }${v != null ? ` (${fmtCurrency(v, moeda, "pt")})` : ""}`
      });
    }

    // Dentro do proprio lote: agrupa por fornecedor + competencia
    const grupos = new Map<string, { comp: string; nums: string[] }>();
    for (const o of overlaps) {
      if (!o.no_lote || !selIds.has(o.invoice_id)) continue;
      ids.add(o.invoice_id);
      const inv = byId.get(o.invoice_id);
      const forn = inv?.supplier_id || inv?.supplier_name || "?";
      const k = `${forn}|${(o.competencia || "").slice(0, 7)}`;
      const g = grupos.get(k) || { comp: fmtComp(o.competencia), nums: [] };
      const n = numOf(o.invoice_id);
      if (!g.nums.includes(n)) g.nums.push(n);
      grupos.set(k, g);
    }
    for (const [k, g] of Array.from(grupos.entries())) {
      const lista =
        g.nums.length > 1
          ? `NF ${g.nums.slice(0, -1).join(", NF ")} e NF ${g.nums[g.nums.length - 1]}`
          : `NF ${g.nums[0]}`;
      out.push({ key: `lote:${k}`, text: `${lista} cobrem ${g.comp} no mesmo lote` });
    }
    return { warnings: out, conflictIds: ids };
  }, [overlaps, aprovadas, selKey, moeda]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Trocar de moeda zera a seleção (lote é de moeda única) e reseta a conta
  const switchMoeda = (m: Moeda) => {
    setMoeda(m);
    setSelected(new Set());
    setConta(CONTA_DEFAULT[m]);
  };

  const allSelected = doMoeda.length > 0 && doMoeda.every((i) => selected.has(i.id));
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(doMoeda.map((i) => i.id)));
  };

  // FormData montada do zero a cada tentativa (evita duplicar
  // `confirm_duplicate` num reenvio).
  const buildFormData = (confirmDuplicate: boolean): FormData => {
    const fd = new FormData();
    fd.append("invoice_ids", selectedInvoices.map((i) => i.id).join(","));
    fd.append("fee", String(feeNum));
    fd.append("data", data);
    // De qual conta saiu o dinheiro (backend antigo ignora; novo grava)
    fd.append("conta", conta);
    // Um comprovante para TODAS as NFs do lote. Sendo opcional, ou todas
    // recebem o mesmo path ou nenhuma recebe — nunca um subconjunto.
    if (file) fd.append("proof", file);
    if (confirmDuplicate) fd.append("confirm_duplicate", "true");
    return fd;
  };

  const doPay = async (confirmDuplicate: boolean) => {
    setSaving(true);
    setError("");
    try {
      await apiFetchStrict("/nf/payment-batches", {
        method: "POST",
        body: buildFormData(confirmDuplicate)
      });
      toast.success(`${selectedInvoices.length} NF(s) paga(s) em lote.`);
      setDupDetail(null);
      onPaid();
      onClose();
    } catch (err: any) {
      const dup = duplicateDetail(err);
      if (dup) {
        // 409: alguma NF do lote sobrepoe competencia ja paga. Confirma no modal.
        setDupDetail(dup);
        return;
      }
      // 422 do FastAPI devolve `detail` como array de objetos — coage pra algo
      // legivel (backend antigo, ainda sem restart, exige o comprovante).
      setError(
        readableError(err, "Falha ao pagar em lote. Tente novamente ou anexe o comprovante.")
      );
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (selectedInvoices.length === 0) return setError("Selecione ao menos uma NF.");
    // Comprovante e OPCIONAL — so valida formato/tamanho se anexaram algo.
    if (file && !PROOF_TYPES.includes(file.type))
      return setError("Comprovante deve ser PNG, JPEG ou PDF.");
    if (file && file.size > PROOF_MAX_MB * 1024 * 1024)
      return setError("Comprovante excede 10MB.");
    if (feeNum < 0) return setError("Taxa inválida.");
    await doPay(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Pagar em lote</h2>
            <p className="text-xs text-muted">
              Quita várias NFs numa transferência: 1 comprovante (opcional) para todas + a taxa.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-background hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Moeda toggle */}
        <div className="flex items-center gap-1 border-b border-border px-5 py-3">
          <span className="mr-2 text-xs text-muted">Moeda do lote:</span>
          {(["BRL", "USD"] as Moeda[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMoeda(m)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                moeda === m ? "bg-primary text-black" : "bg-background text-muted hover:text-foreground"
              }`}
            >
              {m === "BRL" ? "R$" : "US$"}
            </button>
          ))}
        </div>

        {/* Aviso antecipado de pagamento duplicado — antes do comprovante/Pagar */}
        {warnings.length > 0 && (
          <div
            role="alert"
            className="border-b border-danger/30 bg-danger/10 px-5 py-3"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-danger">
                  Possível pagamento duplicado ({conflictIds.size} NF{conflictIds.size === 1 ? "" : "s"})
                </p>
                <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto text-xs text-foreground">
                  {warnings.map((w) => (
                    <li key={w.key}>• {w.text}</li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[11px] text-muted">
                  Confira antes de transferir. Dá pra pagar mesmo assim — o sistema pede confirmação de novo no Pagar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Lista de aprovadas */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : doMoeda.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              Nenhuma NF aprovada em {moeda === "BRL" ? "R$" : "US$"} para pagar.
            </p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <button onClick={toggleAll} className="text-xs text-primary hover:underline">
                  {allSelected ? "Desmarcar todas" : "Selecionar todas"}
                </button>
                {checking && (
                  <span className="flex items-center gap-1 text-[11px] text-muted">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    verificando duplicidade…
                  </span>
                )}
              </div>
              <ul className="space-y-1.5">
                {doMoeda.map((inv) => {
                  const conflito = selected.has(inv.id) && conflictIds.has(inv.id);
                  return (
                  <li key={inv.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ${
                        conflito
                          ? "border-danger/60 bg-danger/10 hover:border-danger"
                          : "border-border bg-background hover:border-primary/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(inv.id)}
                        onChange={() => toggle(inv.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm text-foreground">
                          {conflito && (
                            <span className="inline-flex flex-shrink-0 items-center gap-0.5 rounded bg-danger px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                              <AlertTriangle className="h-3 w-3" />
                              duplicada?
                            </span>
                          )}
                          {inv.invoice_number}
                          {inv.supplier_name ? ` · ${inv.supplier_name}` : ""}
                        </p>
                        <p className="text-xs text-muted">
                          vence {inv.due_date}
                        </p>
                      </div>
                      <span className="flex-shrink-0 font-mono text-sm text-foreground">
                        {fmtCurrency(inv.amount, moeda, "pt")}
                      </span>
                    </label>
                  </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* Form + resumo */}
        <div className="border-t border-border px-5 py-4">
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="text-xs text-muted">
              Data da transferência
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary/50"
              />
            </label>
            <label className="text-xs text-muted">
              Taxa ({moeda === "BRL" ? "R$" : "US$"})
              <input
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                inputMode="decimal"
                className="mt-1 block w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary/50"
              />
            </label>
            <label className="text-xs text-muted">
              Saiu de qual conta?
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
            <label className="col-span-2 text-xs text-muted sm:col-span-1">
              Comprovante (1 p/ todas, opcional)
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

          <div className="mb-3 space-y-1 rounded-lg bg-background px-3 py-2 text-sm">
            <div className="flex justify-between text-muted">
              <span>{selectedInvoices.length} NF(s) selecionada(s)</span>
              <span className="font-mono">{fmtCurrency(somaNfs, moeda, "pt")}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Taxa</span>
              <span className="font-mono">{fmtCurrency(feeNum, moeda, "pt")}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1 font-semibold text-foreground">
              <span>Total que sai do caixa</span>
              <span className="font-mono text-danger">{fmtCurrency(totalSaida, moeda, "pt")}</span>
            </div>
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
              disabled={saving || selectedInvoices.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-black hover:bg-primary/90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {!saving && warnings.length > 0 && <AlertTriangle className="h-4 w-4" />}
              {saving ? "Pagando…" : `Pagar ${selectedInvoices.length || ""} em lote`}
            </button>
          </div>
        </div>
      </div>

      {dupDetail && (
        <DuplicateConfirmModal
          detail={dupDetail}
          moeda={moeda}
          loading={saving}
          onCancel={() => setDupDetail(null)}
          onConfirm={() => doPay(true)}
        />
      )}
    </div>
  );
}
