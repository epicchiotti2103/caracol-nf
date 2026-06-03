"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type {
  Supplier,
  SupplierCreatePayload,
  ClientEntity,
  SupplierUpdatePayload,
  Moeda
} from "@/types";

interface Props {
  // Quando `null`, modo "criar". Quando objeto, modo "editar".
  supplier: Supplier | null;
  onClose: () => void;
  onSaved: (saved: Supplier) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SupplierEditModal({ supplier, onClose, onSaved }: Props) {
  const isEdit = !!supplier;

  const [name, setName] = useState(supplier?.name ?? "");
  const [taxId, setTaxId] = useState(supplier?.tax_id ?? "");
  const [entity, setEntity] = useState<ClientEntity>(supplier?.default_entity ?? "BR");
  const [moeda, setMoeda] = useState<Moeda>(supplier?.default_moeda ?? "BRL");
  const [contactName, setContactName] = useState(supplier?.contact_name ?? "");
  const [contactEmail, setContactEmail] = useState(supplier?.contact_email ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const validate = (): string | null => {
    if (!name.trim()) return "Nome obrigatorio";
    if (contactEmail.trim() && !EMAIL_RE.test(contactEmail.trim())) {
      return "Email de contato invalido";
    }
    return null;
  };

  const buildPayload = (): SupplierCreatePayload | SupplierUpdatePayload => {
    const out: any = {
      name: name.trim(),
      tax_id: taxId.trim() || null,
      default_entity: entity,
      default_moeda: moeda,
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim() || null,
      notes: notes.trim() || null
    };
    return out;
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
      const payload = buildPayload();
      const saved: Supplier = isEdit
        ? await apiFetch(`/suppliers/${supplier!.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload)
          })
        : await apiFetch(`/suppliers`, {
            method: "POST",
            body: JSON.stringify(payload)
          });
      onSaved(saved);
    } catch (err: any) {
      setError(err?.message || "Falha ao salvar fornecedor");
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
            {isEdit ? `Editar fornecedor` : "Novo fornecedor"}
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
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Nome <span className="text-primary">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="Ex: Acme Inc"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Tax ID
              </label>
              <input
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className={inputCls}
                placeholder="CNPJ (Brasil) ou EIN (Exterior)"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Pais
                </label>
                <select
                  value={entity}
                  onChange={(e) => setEntity(e.target.value as ClientEntity)}
                  className={inputCls}
                >
                  <option value="BR">Brasil</option>
                  <option value="LLC">Exterior</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Moeda
                </label>
                <select
                  value={moeda}
                  onChange={(e) => setMoeda(e.target.value as Moeda)}
                  className={inputCls}
                >
                  <option value="BRL">BRL</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Nome do contato
                </label>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className={inputCls}
                  placeholder="Ex: Joao Silva"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Email do contato
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className={inputCls}
                  placeholder="contato@exemplo.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Notas
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
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
            disabled={saving}
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
