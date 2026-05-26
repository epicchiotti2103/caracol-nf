"use client";

import { useEffect, useMemo, useState } from "react";
import { FileUp, Loader2, Upload, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type {
  Client,
  ClientEntity,
  Moeda,
  NfReceivable
} from "@/types";

const MAX_PDF_MB = 10;

// Mes de referencia: 12 passados + atual + 3 futuros (mesma logica do form de NF a Pagar).
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
  // Quando `null`, modo "criar". Quando objeto, modo "editar" (so funciona se status=pendente).
  receivable: NfReceivable | null;
  onClose: () => void;
  onSaved: (saved: NfReceivable) => void;
}

/**
 * Modal de criar/editar NF a Receber.
 *
 * Backend:
 * - POST /api/v1/nf/receivables (multipart obrigatorio se has_invoice=true)
 * - PATCH /api/v1/nf/receivables/{id} (JSON; so funciona se status=pendente)
 *
 * Sempre manda multipart no POST por simplicidade — backend ignora pdf
 * quando has_invoice=false.
 */
export function ReceivableEditModal({ receivable, onClose, onSaved }: Props) {
  const isEdit = !!receivable;

  // ----- Estado dos campos -----
  const initialRef = (receivable?.reference_month || "").slice(0, 7);
  const initialMoeda = (receivable?.moeda || "BRL") as Moeda;
  const initialEntity = (receivable?.caracol_entity || "BR") as ClientEntity;
  const initialAmount =
    receivable?.amount != null ? String(receivable.amount) : "";

  const [clientId, setClientId] = useState(receivable?.client_id || "");
  const [invoiceNumber, setInvoiceNumber] = useState(receivable?.invoice_number || "");
  const [hasInvoice, setHasInvoice] = useState<boolean>(
    receivable?.has_invoice ?? true
  );
  const [pdf, setPdf] = useState<File | null>(null);
  const [amount, setAmount] = useState(initialAmount);
  const [moeda, setMoeda] = useState<Moeda>(initialMoeda);
  const [caracolEntity, setCaracolEntity] = useState<ClientEntity>(initialEntity);
  const [issueDate, setIssueDate] = useState((receivable?.issue_date || "").slice(0, 10));
  const [dueDate, setDueDate] = useState((receivable?.due_date || "").slice(0, 10));
  const [refMonth, setRefMonth] = useState(initialRef);
  const [description, setDescription] = useState(receivable?.description || "");
  const [notesInternal, setNotesInternal] = useState(
    receivable?.notes_internal || ""
  );

  // ----- Clientes (dropdown) -----
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientsError, setClientsError] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [debouncedClientSearch, setDebouncedClientSearch] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

  // Debounce da busca
  useEffect(() => {
    const id = setTimeout(() => setDebouncedClientSearch(clientSearch.trim()), 250);
    return () => clearTimeout(id);
  }, [clientSearch]);

  // Carrega clientes (filtra ativos + busca)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingClients(true);
      setClientsError("");
      try {
        const params = new URLSearchParams({ active: "true" });
        if (debouncedClientSearch) params.set("q", debouncedClientSearch);
        const res: { items: Client[] } | Client[] = await apiFetch(
          `/clients?${params.toString()}`
        );
        const items = Array.isArray(res) ? res : res?.items || [];
        if (cancelled) return;
        // Se ja temos um cliente selecionado que nao apareceu na busca, garante que ele aparece
        if (clientId && !items.find((c) => c.id === clientId) && receivable) {
          // mantem so o que carregou — opcao "atual" e renderizada inline
        }
        setClients(items);
      } catch (err: any) {
        if (cancelled) return;
        setClientsError(err?.message || "Falha ao carregar clientes.");
      } finally {
        if (!cancelled) setLoadingClients(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedClientSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Quando muda o cliente, pega defaults (moeda + entity) dele — so na CRIACAO.
  useEffect(() => {
    if (isEdit) return;
    if (!clientId) return;
    const c = clients.find((x) => x.id === clientId);
    if (!c) return;
    // Sobrescreve so se o user nao mexeu manualmente nesses campos.
    if (!touched) {
      setMoeda(c.default_moeda);
      setCaracolEntity(c.default_entity);
    }
  }, [clientId, clients, isEdit, touched]);

  const selectedClient = clients.find((c) => c.id === clientId);

  // ----- Validacao -----
  const validate = (): string | null => {
    if (!clientId) return "Selecione um cliente.";
    const amt = parseFloat((amount || "").replace(",", "."));
    if (isNaN(amt) || amt <= 0) return "Valor deve ser maior que zero.";
    if (!dueDate) return "Vencimento obrigatorio.";
    if (!refMonth) return "Mes de referencia obrigatorio.";
    if (hasInvoice && !isEdit && !pdf) {
      return "Selecione o PDF da NF (obrigatorio quando 'tem nota emitida').";
    }
    if (pdf && pdf.size > MAX_PDF_MB * 1024 * 1024) {
      return `PDF excede ${MAX_PDF_MB}MB.`;
    }
    return null;
  };

  // ----- Submit -----
  // No modo CRIAR: POST multipart. No modo EDITAR: PATCH JSON com apenas o diff.
  const diff = useMemo<Record<string, any>>(() => {
    if (!isEdit || !receivable) return {};
    const out: Record<string, any> = {};
    if (clientId && clientId !== receivable.client_id) out.client_id = clientId;
    const trimmedInv = (invoiceNumber || "").trim();
    if (trimmedInv !== (receivable.invoice_number || "")) {
      out.invoice_number = trimmedInv || null;
    }
    const parsed = parseFloat((amount || "").replace(",", "."));
    const origAmount = receivable.amount != null ? Number(receivable.amount) : NaN;
    if (!isNaN(parsed) && parsed !== origAmount) {
      out.amount = String(parsed);
    }
    if (moeda !== (receivable.moeda || "BRL")) {
      out.moeda = moeda;
    }
    if (caracolEntity !== (receivable.caracol_entity || "BR")) {
      out.caracol_entity = caracolEntity;
    }
    const origIssue = (receivable.issue_date || "").slice(0, 10);
    if ((issueDate || "") !== origIssue) {
      out.issue_date = issueDate || null;
    }
    const origDue = (receivable.due_date || "").slice(0, 10);
    if (dueDate && dueDate !== origDue) {
      out.due_date = dueDate;
    }
    const origRef = (receivable.reference_month || "").slice(0, 7);
    if (refMonth && refMonth !== origRef) {
      out.reference_month = refMonth;
    }
    if (Boolean(hasInvoice) !== Boolean(receivable.has_invoice)) {
      out.has_invoice = hasInvoice;
    }
    if ((description || "") !== (receivable.description || "")) {
      out.description = description || null;
    }
    if ((notesInternal || "") !== (receivable.notes_internal || "")) {
      out.notes_internal = notesInternal || null;
    }
    return out;
  }, [
    isEdit,
    receivable,
    clientId,
    invoiceNumber,
    amount,
    moeda,
    caracolEntity,
    issueDate,
    dueDate,
    refMonth,
    hasInvoice,
    description,
    notesInternal
  ]);

  const hasChanges = isEdit ? Object.keys(diff).length > 0 : true;

  const onSubmit = async () => {
    setError("");
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    if (isEdit && !hasChanges) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const refIso = refMonth.length === 10 ? refMonth.slice(0, 7) : refMonth;
      let saved: NfReceivable;
      if (isEdit && receivable) {
        // PATCH JSON
        saved = await apiFetch(`/nf/receivables/${receivable.id}`, {
          method: "PATCH",
          body: JSON.stringify(diff)
        });
      } else {
        // POST multipart
        const fd = new FormData();
        fd.append("client_id", clientId);
        fd.append("amount", String(parseFloat(amount.replace(",", "."))));
        fd.append("due_date", dueDate);
        fd.append("reference_month", refIso);
        fd.append("moeda", moeda);
        fd.append("caracol_entity", caracolEntity);
        fd.append("has_invoice", String(hasInvoice));
        if (invoiceNumber.trim()) fd.append("invoice_number", invoiceNumber.trim());
        if (issueDate) fd.append("issue_date", issueDate);
        if (description.trim()) fd.append("description", description.trim());
        if (notesInternal.trim()) fd.append("notes_internal", notesInternal.trim());
        if (hasInvoice && pdf) fd.append("pdf", pdf);
        saved = await apiFetch(`/nf/receivables`, { method: "POST", body: fd });
      }
      onSaved(saved);
    } catch (err: any) {
      setError(err?.message || "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/60";

  const refMonthOptions = useMemo(() => buildRefMonthOptions(), []);

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
            {isEdit
              ? `Editar NF a receber${
                  receivable?.invoice_number ? ` #${receivable.invoice_number}` : ""
                }`
              : "Nova NF a Receber"}
          </p>
          <button
            onClick={onClose}
            className="text-orange-100/40 hover:text-orange-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Cliente */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Cliente <span className="text-primary">*</span>
              </label>
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Buscar cliente por nome..."
                className={inputCls + " mb-2"}
                aria-label="Buscar cliente"
              />
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={loadingClients}
                className={inputCls + " disabled:opacity-60"}
              >
                <option value="">
                  {loadingClients ? "Carregando..." : "Selecione um cliente"}
                </option>
                {isEdit &&
                  clientId &&
                  !clients.find((c) => c.id === clientId) &&
                  receivable?.client_name && (
                    <option value={clientId}>
                      {receivable.client_name} (atual)
                    </option>
                  )}
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.tax_id ? ` — ${c.tax_id}` : ""}
                  </option>
                ))}
              </select>
              {clientsError && (
                <p className="mt-1 text-xs text-danger">{clientsError}</p>
              )}
              {selectedClient && (
                <p className="mt-1 text-[11px] text-muted">
                  Default: {selectedClient.default_entity === "BR" ? "Brasil" : "Exterior"} ·{" "}
                  {selectedClient.default_moeda}
                </p>
              )}
            </div>

            {/* Tem nota emitida + numero */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto,1fr]">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Nota emitida?
                </label>
                <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3.5">
                  <input
                    type="checkbox"
                    checked={hasInvoice}
                    onChange={(e) => setHasInvoice(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm text-foreground">
                    {hasInvoice ? "Sim, tem NF" : "Sem NF emitida"}
                  </span>
                </label>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Numero da NF
                </label>
                <input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className={inputCls}
                  placeholder="Opcional. Ex: NF-000142"
                />
              </div>
            </div>

            {/* PDF (so se has_invoice e modo criar) */}
            {hasInvoice && !isEdit && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  PDF da NF <span className="text-primary">*</span>
                </label>
                <label
                  htmlFor="receivable-pdf"
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 transition-colors hover:bg-background ${
                    pdf ? "border-primary/50" : "border-border"
                  }`}
                >
                  {pdf ? (
                    <>
                      <FileUp className="h-5 w-5 text-primary" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground">{pdf.name}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {(pdf.size / 1024 / 1024).toFixed(2)} MB
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
                          PDF da nota fiscal — max. {MAX_PDF_MB} MB
                        </p>
                      </div>
                    </>
                  )}
                  <input
                    id="receivable-pdf"
                    type="file"
                    accept=".pdf,application/pdf"
                    className="sr-only"
                    onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            )}
            {hasInvoice && isEdit && (
              <p className="text-xs text-muted">
                PDF da NF nao e editavel por aqui. Para trocar, cancele e crie nova.
              </p>
            )}

            {/* Valor + moeda + vencimento */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Valor <span className="text-primary">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    value={amount}
                    onChange={(e) => {
                      setTouched(true);
                      setAmount(e.target.value);
                    }}
                    inputMode="decimal"
                    placeholder="0,00"
                    className={inputCls + " flex-1"}
                  />
                  <select
                    value={moeda}
                    onChange={(e) => {
                      setTouched(true);
                      setMoeda(e.target.value as Moeda);
                    }}
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

            {/* Pais + mes ref */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Pais
                </label>
                <select
                  value={caracolEntity}
                  onChange={(e) => {
                    setTouched(true);
                    setCaracolEntity(e.target.value as ClientEntity);
                  }}
                  className={inputCls}
                >
                  <option value="BR">Brasil</option>
                  <option value="LLC">Exterior</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Mes de referencia <span className="text-primary">*</span>
                </label>
                <select
                  value={refMonth}
                  onChange={(e) => setRefMonth(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Selecione o mes</option>
                  {refMonthOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Data emissao */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Data de emissao
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className={inputCls + " sm:max-w-[240px]"}
                style={{ colorScheme: "dark" }}
              />
            </div>

            {/* Descricao */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Descricao
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className={inputCls + " resize-y"}
                placeholder="Ex: Fechamento Lalamove USR 2026-05"
              />
            </div>

            {/* Notas internas */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Notas internas
              </label>
              <textarea
                value={notesInternal}
                onChange={(e) => setNotesInternal(e.target.value)}
                rows={2}
                className={inputCls + " resize-y"}
                placeholder="Observacoes internas (opcional)"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
          </div>
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
            disabled={saving || (isEdit && !hasChanges)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : isEdit ? (
              "Salvar"
            ) : (
              "Criar"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
