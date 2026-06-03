"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Invoice, NfUser, Supplier } from "@/types";

const MAX_BR_DATE_LEN = 10;

// Opcoes do dropdown Mes de referencia (mesma logica do /invoice/new).
function buildRefMonthOptions(): Array<{ value: string; label: string }> {
  const opts: Array<{ value: string; label: string }> = [];
  const today = new Date();
  today.setDate(1);
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  });
  for (let i = 12; i >= -3; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const value = `${y}-${m}`;
    const raw = formatter.format(d);
    const label = raw.charAt(0).toUpperCase() + raw.slice(1);
    opts.push({ value, label });
  }
  return opts.reverse();
}

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
 * {invoice_number, amount, moeda, due_date, reference_month, campaign_name,
 * publisher_id}. Grava 1 evento `invoice_edited` com o diff.
 *
 * Frontend manda **so o diff** (campos cujo valor mudou) pra evitar
 * eventos ruidosos. Backend faz double-check do diff antes de gravar.
 */
export function InvoiceEditModal({ invoice, onClose, onSaved }: Props) {
  // Valores normalizados pra comparacao. Backend devolve `campaign_name`,
  // mas legacy ja teve `campaign` em algumas respostas — leu de ambos.
  const initialCampaign =
    invoice.campaign_name ?? invoice.campaign ?? "";
  const initialMoeda = (invoice.moeda || "BRL") as "BRL" | "USD";
  const initialRef = (invoice.reference_month || "").slice(0, 7);

  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoice_number || "");
  const [amount, setAmount] = useState(
    invoice.amount != null ? String(invoice.amount) : ""
  );
  const [moeda, setMoeda] = useState<"BRL" | "USD">(initialMoeda);
  const [dueDate, setDueDate] = useState((invoice.due_date || "").slice(0, 10));
  const [refMonth, setRefMonth] = useState(initialRef);
  const [campaign, setCampaign] = useState(initialCampaign);
  const [publisherId, setPublisherId] = useState(invoice.publisher_id || "");

  // Toggle Publisher (usuario) | Fornecedor cadastrado. Inicializa pela fonte
  // atual da NF (se tem supplier_id, ja vem como fornecedor).
  const [sourceKind, setSourceKind] = useState<"publisher" | "supplier">(
    invoice.supplier_id ? "supplier" : "publisher"
  );
  const [supplierId, setSupplierId] = useState(invoice.supplier_id || "");

  const [publishers, setPublishers] = useState<NfUser[]>([]);
  const [loadingPublishers, setLoadingPublishers] = useState(false);
  const [publishersError, setPublishersError] = useState("");

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [suppliersError, setSuppliersError] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Carrega publishers (precisa pro dropdown — admin/adm_campanha podem mudar)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPublishers(true);
      setPublishersError("");
      try {
        const res: { items: NfUser[]; total: number } | NfUser[] =
          await apiFetch("/nf/users");
        const items = Array.isArray(res) ? res : res?.items || [];
        if (cancelled) return;
        setPublishers(items.filter((u) => u.nf_role === "publisher"));
      } catch (err: any) {
        if (cancelled) return;
        setPublishersError(err?.message || "Falha ao carregar publishers");
      } finally {
        if (!cancelled) setLoadingPublishers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (refMonth && refMonth !== initialRef) {
      // backend aceita date (primeiro dia do mes)
      out.reference_month = `${refMonth}-01`;
    }
    const trimmedCampaign = campaign.trim();
    if (trimmedCampaign !== (initialCampaign || "")) {
      out.campaign_name = trimmedCampaign || null;
    }
    // Fonte (publisher OU fornecedor). Envia somente quando muda de fato:
    // troca de fonte, ou troca o valor dentro da mesma fonte.
    const origKind = invoice.supplier_id ? "supplier" : "publisher";
    if (sourceKind === "supplier") {
      if (supplierId && (origKind !== "supplier" || supplierId !== invoice.supplier_id)) {
        out.supplier_id = supplierId;
      }
    } else {
      if (publisherId && (origKind !== "publisher" || publisherId !== invoice.publisher_id)) {
        out.publisher_id = publisherId;
      }
    }
    return out;
  }, [
    invoiceNumber,
    amount,
    moeda,
    dueDate,
    refMonth,
    campaign,
    publisherId,
    sourceKind,
    supplierId,
    invoice,
    initialCampaign,
    initialMoeda,
    initialRef
  ]);

  const hasChanges = Object.keys(diff).length > 0;

  const validate = (): string | null => {
    if (!invoiceNumber.trim()) return "Numero da NF obrigatorio";
    const parsed = parseFloat(amount.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0)
      return "Valor deve ser maior que zero";
    if (!dueDate || dueDate.length !== MAX_BR_DATE_LEN)
      return "Vencimento obrigatorio";
    if (!refMonth) return "Mes de referencia obrigatorio";
    if (sourceKind === "supplier") {
      if (!supplierId) return "Fornecedor obrigatorio";
    } else {
      if (!publisherId) return "Publisher obrigatorio";
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
      setError(err?.message || "Falha ao atualizar");
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
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Vincular a <span className="text-primary">*</span>
                </label>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
                  {(
                    [
                      { v: "publisher", l: "Publisher (usuario)" },
                      { v: "supplier", l: "Fornecedor cadastrado" }
                    ] as Array<{ v: "publisher" | "supplier"; l: string }>
                  ).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setSourceKind(opt.v)}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        sourceKind === opt.v
                          ? "bg-primary text-black"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              {sourceKind === "publisher" ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Publisher <span className="text-primary">*</span>
                  </label>
                  <select
                    value={publisherId}
                    onChange={(e) => setPublisherId(e.target.value)}
                    disabled={loadingPublishers}
                    className={inputCls + " disabled:opacity-60"}
                  >
                    {loadingPublishers && <option value="">Carregando...</option>}
                    {!loadingPublishers && (
                      <option value="">Selecione um publisher</option>
                    )}
                    {!loadingPublishers && publisherId && !publishers.find((p) => p.id === publisherId) && (
                      // Publisher atual pode nao estar mais com nf_role=publisher;
                      // mantem visivel pra nao perder selecao.
                      <option value={publisherId}>
                        {invoice.publisher_name || invoice.publisher_email || publisherId.slice(0, 8)} (atual)
                      </option>
                    )}
                    {publishers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name ? `${u.name} (${u.email})` : u.email}
                      </option>
                    ))}
                  </select>
                  {publishersError && (
                    <p className="mt-1 text-xs text-danger">{publishersError}</p>
                  )}
                </div>
              ) : (
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Mes de referencia <span className="text-primary">*</span>
                </label>
                <select
                  value={refMonth}
                  onChange={(e) => setRefMonth(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Selecione</option>
                  {buildRefMonthOptions().map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Campanha
                </label>
                <input
                  value={campaign}
                  onChange={(e) => setCampaign(e.target.value)}
                  className={inputCls}
                  placeholder="Ex: Campanha XYZ"
                />
              </div>
            </div>

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
