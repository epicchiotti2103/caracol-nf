"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  NfTagCampanhaFields,
  campanhaLinksToDrafts,
  draftsToPayload,
  type CampanhaLinkDraft
} from "@/components/nf/nf-tag-campanha-fields";
import { ConciliacaoPanel } from "@/components/nf/conciliacao-panel";
import {
  CompetenciaFields,
  anchorCompetencia,
  competenciasToDrafts,
  competenciasToPayload,
  validateCompetencias,
  type CompetenciaDraft
} from "@/components/nf/competencia-fields";
import { DuplicidadePanel } from "@/components/nf/duplicidade-panel";
import { readableError } from "@/lib/api-error";
import type { Invoice, Supplier } from "@/types";

const MAX_BR_DATE_LEN = 10;

interface Props {
  invoice: Invoice;
  onClose: () => void;
  onSaved: (updated: Invoice) => void;
}

/**
 * Modal de edicao de NF.
 *
 * Backend: PATCH /api/v1/nf/invoices/{id} (apenas em em_analise, admin ou
 * adm_campanha). Aceita JSON com qualquer subset de
 * {invoice_number, amount, moeda, due_date, reference_month, supplier_id}.
 * Grava 1 evento `invoice_edited` com o diff.
 *
 * Frontend manda **so o diff** (campos cujo valor mudou) pra evitar
 * eventos ruidosos. Backend faz double-check do diff antes de gravar.
 */
export function InvoiceEditModal({ invoice, onClose, onSaved }: Props) {
  const initialMoeda = (invoice.moeda || "BRL") as "BRL" | "USD";

  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoice_number || "");
  const [amount, setAmount] = useState(
    invoice.amount != null ? String(invoice.amount) : ""
  );
  const [moeda, setMoeda] = useState<"BRL" | "USD">(initialMoeda);
  const [dueDate, setDueDate] = useState((invoice.due_date || "").slice(0, 10));

  // Competencias (>=1). NF antiga (sem `competencias`) cai no reference_month.
  const initialAmount = invoice.amount != null ? Number(invoice.amount) : 0;
  const initialCompetencias = useMemo(
    () => competenciasToDrafts(invoice.competencias, invoice.reference_month),
    [invoice.competencias, invoice.reference_month]
  );
  // Assinatura pra detectar mudanca real de competencia. Com 1 linha o valor e
  // derivado do total da NF, entao so o mes conta — assim editar so o valor de
  // uma NF de 1 competencia continua mandando exatamente o PATCH de antes.
  const competenciaSignature = (drafts: CompetenciaDraft[], total: number) =>
    drafts.length <= 1
      ? JSON.stringify(drafts.map((d) => d.competencia))
      : JSON.stringify(competenciasToPayload(drafts, total));
  const initialCompetenciaSignature = useMemo(
    () => competenciaSignature(initialCompetencias, initialAmount),
    [initialCompetencias, initialAmount]
  );
  const [competencias, setCompetencias] = useState<CompetenciaDraft[]>(
    () => initialCompetencias
  );
  // NF que ja tem competencias declaradas: mudar o valor exige re-declarar a
  // distribuicao — com 2+ o backend 400 se vier `amount` sozinho, e com 1 o
  // valor da competencia ficaria desatualizado em silencio (soma != amount).
  // NF antiga (backend sem o campo) => false => PATCH identico ao de antes.
  const hasDeclaredCompetencias = (invoice.competencias?.length ?? 0) >= 1;

  // NF a Pagar sempre aponta pra um fornecedor cadastrado (supplier_id).
  const [supplierId, setSupplierId] = useState(invoice.supplier_id || "");

  // Tag + campanhas. Snapshot inicial pra detectar mudanca relacional.
  const initialTagId = invoice.tag_id || "";
  const [tagId, setTagId] = useState(initialTagId);
  const initialCampanhaPayload = useMemo(
    () => JSON.stringify(draftsToPayload(campanhaLinksToDrafts(invoice.campanhas))),
    [invoice.campanhas]
  );
  const [campanhaLinks, setCampanhaLinks] = useState<CampanhaLinkDraft[]>(() =>
    campanhaLinksToDrafts(invoice.campanhas)
  );

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [suppliersError, setSuppliersError] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Carrega fornecedores ativos pro dropdown
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSuppliers(true);
      setSuppliersError("");
      try {
        const res: { items: Supplier[] } | Supplier[] =
          await apiFetch("/suppliers?active=true");
        const items = Array.isArray(res) ? res : res?.items || [];
        if (cancelled) return;
        setSuppliers(items);
      } catch (err: any) {
        if (cancelled) return;
        setSuppliersError(err?.message || "Falha ao carregar fornecedores");
      } finally {
        if (!cancelled) setLoadingSuppliers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Diff entre estado atual e original — usado tanto pra mostrar "Salvar"
  // habilitado quanto pra montar o body do PATCH.
  const diff = useMemo<Record<string, any>>(() => {
    const out: Record<string, any> = {};
    const trimmedNumber = invoiceNumber.trim();
    if (trimmedNumber !== (invoice.invoice_number || "")) {
      out.invoice_number = trimmedNumber;
    }
    const parsed = parseFloat(amount.replace(",", "."));
    const origAmount =
      invoice.amount != null ? Number(invoice.amount) : NaN;
    if (!isNaN(parsed) && parsed !== origAmount) {
      out.amount = String(parsed);
    }
    if (moeda !== initialMoeda) {
      out.moeda = moeda;
    }
    if (dueDate && dueDate !== (invoice.due_date || "").slice(0, 10)) {
      out.due_date = dueDate;
    }
    // Competencias — REPLACE do conjunto. Vai no PATCH quando muda, e TAMBEM
    // quando so o valor mudou numa NF multi-competencia (senao o backend 400).
    const parsedAmount = !isNaN(parsed) ? parsed : initialAmount;
    const competenciaChanged =
      competenciaSignature(competencias, parsedAmount) !== initialCompetenciaSignature;
    if (competenciaChanged || (hasDeclaredCompetencias && out.amount != null)) {
      out.competencias = competenciasToPayload(competencias, parsedAmount);
    }
    // Ancora de compat (menor competencia) acompanha a lista.
    const anchor = anchorCompetencia(competencias);
    if (anchor && anchor !== (invoice.reference_month || "").slice(0, 7)) {
      out.reference_month = `${anchor}-01`;
    }
    // Fornecedor — envia so quando muda.
    if (supplierId && supplierId !== invoice.supplier_id) {
      out.supplier_id = supplierId;
    }
    // Tag — envia so quando muda (string vazia => desvincula => null).
    if (tagId !== initialTagId) {
      out.tag_id = tagId || null;
    }
    // Campanhas — relacional (REPLACE total). Envia so quando o conjunto muda.
    const campanhaPayload = draftsToPayload(campanhaLinks);
    if (JSON.stringify(campanhaPayload) !== initialCampanhaPayload) {
      out.campanhas = campanhaPayload;
    }
    return out;
  }, [
    invoiceNumber,
    amount,
    moeda,
    dueDate,
    competencias,
    supplierId,
    tagId,
    campanhaLinks,
    initialTagId,
    initialCampanhaPayload,
    initialCompetenciaSignature,
    initialAmount,
    hasDeclaredCompetencias,
    invoice,
    initialMoeda
  ]);

  const hasChanges = Object.keys(diff).length > 0;

  const validate = (): string | null => {
    if (!invoiceNumber.trim()) return "Numero da NF obrigatorio";
    const parsed = parseFloat(amount.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0)
      return "Valor deve ser maior que zero";
    if (!dueDate || dueDate.length !== MAX_BR_DATE_LEN)
      return "Vencimento obrigatorio";
    const compErr = validateCompetencias(competencias, parsed, "pt", moeda);
    if (compErr) return compErr;
    if (!supplierId) return "Fornecedor obrigatorio";
    return null;
  };

  const onSubmit = async () => {
    setError("");
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    if (!hasChanges) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const updated: Invoice = await apiFetch(`/nf/invoices/${invoice.id}`, {
        method: "PATCH",
        body: JSON.stringify(diff)
      });
      onSaved(updated);
    } catch (err: any) {
      // PATCH pode voltar erro estruturado (duplicidade / soma das competencias
      // != valor). O contrato NAO tem `confirm_duplicate` no PATCH, entao aqui
      // so mostramos mensagem legivel — sem botao de forcar.
      setError(readableError(err, "Falha ao atualizar"));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/60";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-zinc-950 px-6 py-4">
          <p className="text-base font-semibold text-orange-50">
            Editar NF #{invoice.invoice_number}
          </p>
          <button
            onClick={onClose}
            className="text-orange-100/40 hover:text-orange-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Fornecedor <span className="text-primary">*</span>
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                disabled={loadingSuppliers}
                className={inputCls + " disabled:opacity-60"}
              >
                {loadingSuppliers && <option value="">Carregando...</option>}
                {!loadingSuppliers && (
                  <option value="">Selecione um fornecedor</option>
                )}
                {!loadingSuppliers && supplierId && !suppliers.find((s) => s.id === supplierId) && (
                  // Fornecedor atual pode estar inativo (fora da lista active=true);
                  // mantem visivel pra nao perder selecao.
                  <option value={supplierId}>
                    {invoice.supplier_name || supplierId.slice(0, 8)} (atual)
                  </option>
                )}
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.tax_id ? `${s.name} (${s.tax_id})` : s.name}
                  </option>
                ))}
              </select>
              {suppliersError && (
                <p className="mt-1 text-xs text-danger">{suppliersError}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Numero da NF <span className="text-primary">*</span>
              </label>
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className={inputCls}
                placeholder="NF-000142"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Valor <span className="text-primary">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    className={inputCls + " flex-1"}
                  />
                  <select
                    value={moeda}
                    onChange={(e) => setMoeda(e.target.value as "BRL" | "USD")}
                    aria-label="Moeda"
                    className="w-24 flex-shrink-0 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/60"
                  >
                    <option value="BRL">BRL</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Vencimento <span className="text-primary">*</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={inputCls}
                  style={{ colorScheme: "dark" }}
                />
              </div>
            </div>

            <CompetenciaFields
              drafts={competencias}
              onChange={setCompetencias}
              totalNf={parseFloat((amount || "").replace(",", ".")) || 0}
              moeda={moeda}
              lang="pt"
              inputCls={inputCls}
            />

            <NfTagCampanhaFields
              tagId={tagId}
              onTagChange={setTagId}
              campanhas={campanhaLinks}
              onCampanhasChange={setCampanhaLinks}
              totalNf={parseFloat((amount || "").replace(",", ".")) || undefined}
              moeda={moeda}
              supplierId={supplierId || undefined}
            />

            <ConciliacaoPanel
              supplierId={supplierId}
              moeda={moeda}
              campanhas={campanhaLinks}
            />

            <DuplicidadePanel
              supplierId={supplierId}
              invoiceNumber={invoiceNumber}
              amount={parseFloat((amount || "").replace(",", ".")) || 0}
              competencias={competencias.map((c) => c.competencia)}
              moeda={moeda}
              excludeInvoiceId={invoice.id}
            />

            {error && (
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <p className="text-xs text-muted">
              PDF da NF nao e editavel por aqui. Se precisar trocar o arquivo,
              recuse a NF e peca pro publisher reenviar.
            </p>
          </div>
        </div>

        <div className="flex gap-3 border-t border-border bg-surface px-6 py-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground hover:bg-background"
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={saving || !hasChanges}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
