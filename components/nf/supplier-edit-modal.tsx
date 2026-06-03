"use client";

import { useState } from "react";
import { ChevronDown, Loader2, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type {
  Supplier,
  SupplierCreatePayload,
  ClientEntity,
  SupplierUpdatePayload,
  Moeda,
  PayWireType
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
  const [legalName, setLegalName] = useState(supplier?.legal_name ?? "");
  const [taxId, setTaxId] = useState(supplier?.tax_id ?? "");
  const [entity, setEntity] = useState<ClientEntity>(supplier?.default_entity ?? "BR");
  const [moeda, setMoeda] = useState<Moeda>(supplier?.default_moeda ?? "BRL");
  const [contactName, setContactName] = useState(supplier?.contact_name ?? "");
  const [contactEmail, setContactEmail] = useState(supplier?.contact_email ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");

  // Dados de pagamento (HelmBank) — todos opcionais
  const [payWireType, setPayWireType] = useState<PayWireType>(
    (supplier?.pay_wire_type as PayWireType) ?? "international"
  );
  const [payAccountNumber, setPayAccountNumber] = useState(
    supplier?.pay_account_number ?? ""
  );
  const [payBeneficiaryBankName, setPayBeneficiaryBankName] = useState(
    supplier?.pay_beneficiary_bank_name ?? ""
  );
  const [payBeneficiaryBankCode, setPayBeneficiaryBankCode] = useState(
    supplier?.pay_beneficiary_bank_code ?? ""
  );
  const [payCorrespondentBankName, setPayCorrespondentBankName] = useState(
    supplier?.pay_correspondent_bank_name ?? ""
  );
  const [payCorrespondentBankSwift, setPayCorrespondentBankSwift] = useState(
    supplier?.pay_correspondent_bank_swift ?? ""
  );
  const [payCreditorCountry, setPayCreditorCountry] = useState(
    supplier?.pay_creditor_country ?? ""
  );
  const [payCreditorCity, setPayCreditorCity] = useState(
    supplier?.pay_creditor_city ?? ""
  );
  const [payCreditorAddress, setPayCreditorAddress] = useState(
    supplier?.pay_creditor_address ?? ""
  );
  const [payCreditorPhone, setPayCreditorPhone] = useState(
    supplier?.pay_creditor_phone ?? ""
  );
  const [payInstructions, setPayInstructions] = useState(
    supplier?.pay_instructions ?? ""
  );

  // Abre a secao ja expandida se o fornecedor existente tem algum dado de pagamento
  const hasPayData = !!(
    supplier?.pay_account_number ||
    supplier?.pay_beneficiary_bank_name ||
    supplier?.pay_beneficiary_bank_code ||
    supplier?.pay_instructions ||
    supplier?.pay_correspondent_bank_swift
  );
  const [payOpen, setPayOpen] = useState(hasPayData);

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
      legal_name: legalName.trim() || null,
      tax_id: taxId.trim() || null,
      default_entity: entity,
      default_moeda: moeda,
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim() || null,
      notes: notes.trim() || null,
      // Dados de pagamento (HelmBank) — todos opcionais
      pay_wire_type: payWireType,
      pay_account_number: payAccountNumber.trim() || null,
      pay_beneficiary_bank_name: payBeneficiaryBankName.trim() || null,
      pay_beneficiary_bank_code: payBeneficiaryBankCode.trim() || null,
      // Banco correspondente so faz sentido em transferencia internacional
      pay_correspondent_bank_name:
        payWireType === "international"
          ? payCorrespondentBankName.trim() || null
          : null,
      pay_correspondent_bank_swift:
        payWireType === "international"
          ? payCorrespondentBankSwift.trim() || null
          : null,
      pay_creditor_country: payCreditorCountry.trim() || null,
      pay_creditor_city: payCreditorCity.trim() || null,
      pay_creditor_address: payCreditorAddress.trim() || null,
      pay_creditor_phone: payCreditorPhone.trim() || null,
      pay_instructions: payInstructions.trim() || null
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
                Nome fantasia <span className="text-primary">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="Nome de exibicao (ex: Talent.com)"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Razao social / Nome real
              </label>
              <input
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className={inputCls}
                placeholder="Nome completo pra pagamento (ex: Talent.com Europe Sarl)"
              />
              <p className="mt-1 text-xs text-muted">usado na hora de pagar</p>
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

            {/* Dados de pagamento (HelmBank) — secao colapsavel, tudo opcional */}
            <div className="rounded-xl border border-border bg-background/40">
              <button
                type="button"
                onClick={() => setPayOpen((o) => !o)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-sm font-semibold text-foreground">
                  Dados de pagamento (HelmBank)
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted transition-transform ${
                    payOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {payOpen && (
                <div className="space-y-4 border-t border-border px-4 py-4">
                  {/* Tipo de transferencia */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Tipo de transferencia
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                      <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground">
                        <input
                          type="radio"
                          name="pay_wire_type"
                          value="international"
                          checked={payWireType === "international"}
                          onChange={() => setPayWireType("international")}
                          className="accent-primary"
                        />
                        Internacional (SWIFT)
                      </label>
                      <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground">
                        <input
                          type="radio"
                          name="pay_wire_type"
                          value="domestic"
                          checked={payWireType === "domestic"}
                          onChange={() => setPayWireType("domestic")}
                          className="accent-primary"
                        />
                        Domestica (Routing/ABA)
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      No da conta / IBAN
                    </label>
                    <input
                      value={payAccountNumber}
                      onChange={(e) => setPayAccountNumber(e.target.value)}
                      className={inputCls}
                      placeholder="Conta ou IBAN"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        Banco beneficiario
                      </label>
                      <input
                        value={payBeneficiaryBankName}
                        onChange={(e) => setPayBeneficiaryBankName(e.target.value)}
                        className={inputCls}
                        placeholder="Nome do banco"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        {payWireType === "international"
                          ? "SWIFT do banco beneficiario"
                          : "Routing/ABA do banco beneficiario"}
                      </label>
                      <input
                        value={payBeneficiaryBankCode}
                        onChange={(e) => setPayBeneficiaryBankCode(e.target.value)}
                        className={inputCls}
                        placeholder={
                          payWireType === "international" ? "Ex: BOFAUS3N" : "Ex: 026009593"
                        }
                      />
                    </div>
                  </div>

                  {/* Banco correspondente — so internacional */}
                  {payWireType === "international" && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-foreground">
                          Banco correspondente
                        </label>
                        <input
                          value={payCorrespondentBankName}
                          onChange={(e) =>
                            setPayCorrespondentBankName(e.target.value)
                          }
                          className={inputCls}
                          placeholder="Banco intermediario (opcional)"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-foreground">
                          SWIFT correspondente
                        </label>
                        <input
                          value={payCorrespondentBankSwift}
                          onChange={(e) =>
                            setPayCorrespondentBankSwift(e.target.value)
                          }
                          className={inputCls}
                          placeholder="SWIFT do correspondente"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        Pais do beneficiario
                      </label>
                      <input
                        value={payCreditorCountry}
                        onChange={(e) => setPayCreditorCountry(e.target.value)}
                        className={inputCls}
                        placeholder="Ex: United States"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        Cidade do beneficiario
                      </label>
                      <input
                        value={payCreditorCity}
                        onChange={(e) => setPayCreditorCity(e.target.value)}
                        className={inputCls}
                        placeholder="Ex: New York"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        Endereco do beneficiario
                      </label>
                      <input
                        value={payCreditorAddress}
                        onChange={(e) => setPayCreditorAddress(e.target.value)}
                        className={inputCls}
                        placeholder="Rua, numero..."
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        Telefone do beneficiario
                      </label>
                      <input
                        value={payCreditorPhone}
                        onChange={(e) => setPayCreditorPhone(e.target.value)}
                        className={inputCls}
                        placeholder="+1 ..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Instrucoes de pagamento
                    </label>
                    <textarea
                      value={payInstructions}
                      onChange={(e) => setPayInstructions(e.target.value)}
                      rows={4}
                      className={inputCls + " resize-y"}
                      placeholder="Cole aqui os dados de remessa do email do fornecedor"
                    />
                  </div>
                </div>
              )}
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
