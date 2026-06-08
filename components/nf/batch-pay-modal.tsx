"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Loader2, Upload, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { fmtCurrency } from "@/lib/i18n";
import type { Invoice, Moeda } from "@/types";

const PROOF_MAX_MB = 10;
const PROOF_TYPES = ["image/png", "image/jpeg", "application/pdf"];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res: { items: Invoice[] } | Invoice[] = await apiFetch("/nf/invoices?status=aprovada");
        const items = Array.isArray(res) ? res : res.items;
        setAprovadas(items.filter((i) => i.status === "aprovada"));
      } catch (err: any) {
        setError(err?.message || "Falha ao carregar NFs aprovadas.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const doMoeda = aprovadas.filter((i) => moedaOf(i) === moeda);
  const selectedInvoices = doMoeda.filter((i) => selected.has(i.id));
  const somaNfs = selectedInvoices.reduce((s, i) => s + (i.amount || 0), 0);
  const feeNum = useMemo(() => {
    const n = parseFloat(fee.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }, [fee]);
  const totalSaida = somaNfs + feeNum;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Trocar de moeda zera a seleção (lote é de moeda única)
  const switchMoeda = (m: Moeda) => {
    setMoeda(m);
    setSelected(new Set());
  };

  const allSelected = doMoeda.length > 0 && doMoeda.every((i) => selected.has(i.id));
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(doMoeda.map((i) => i.id)));
  };

  const submit = async () => {
    if (selectedInvoices.length === 0) return setError("Selecione ao menos uma NF.");
    if (!file) return setError("Anexe o comprovante da transferência.");
    if (!PROOF_TYPES.includes(file.type)) return setError("Comprovante deve ser PNG, JPEG ou PDF.");
    if (file.size > PROOF_MAX_MB * 1024 * 1024) return setError("Comprovante excede 10MB.");
    if (feeNum < 0) return setError("Taxa inválida.");

    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("invoice_ids", selectedInvoices.map((i) => i.id).join(","));
      fd.append("fee", String(feeNum));
      fd.append("data", data);
      fd.append("proof", file);
      await apiFetch("/nf/payment-batches", { method: "POST", body: fd });
      toast.success(`${selectedInvoices.length} NF(s) paga(s) em lote.`);
      onPaid();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Falha ao pagar em lote.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Pagar em lote</h2>
            <p className="text-xs text-muted">
              Quita várias NFs numa transferência: 1 comprovante para todas + a taxa.
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
              <button onClick={toggleAll} className="mb-2 text-xs text-primary hover:underline">
                {allSelected ? "Desmarcar todas" : "Selecionar todas"}
              </button>
              <ul className="space-y-1.5">
                {doMoeda.map((inv) => (
                  <li key={inv.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 hover:border-primary/40">
                      <input
                        type="checkbox"
                        checked={selected.has(inv.id)}
                        onChange={() => toggle(inv.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">
                          {inv.invoice_number}
                          {inv.supplier_name ? ` · ${inv.supplier_name}` : ""}
                        </p>
                        <p className="text-xs text-muted">
                          vence {inv.due_date}
                          {inv.campaign_name ? ` · ${inv.campaign_name}` : ""}
                        </p>
                      </div>
                      <span className="flex-shrink-0 font-mono text-sm text-foreground">
                        {fmtCurrency(inv.amount, moeda, "pt")}
                      </span>
                    </label>
                  </li>
                ))}
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
            <label className="col-span-2 text-xs text-muted sm:col-span-1">
              Comprovante (1 p/ todas)
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
                <Upload className="h-3.5 w-3.5 flex-shrink-0 text-muted" />
                <input
                  type="file"
                  accept="image/png,image/jpeg,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="min-w-0 flex-1 text-xs text-foreground file:hidden"
                />
              </div>
            </label>
          </div>

          {file && <p className="mb-2 truncate text-xs text-muted">Arquivo: {file.name}</p>}

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
              disabled={saving || selectedInvoices.length === 0 || !file}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-black hover:bg-primary/90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Pagando…" : `Pagar ${selectedInvoices.length || ""} em lote`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
