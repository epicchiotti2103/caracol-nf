"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Upload, CheckCircle2, AlertCircle, ChevronLeft, FileUp, Loader2 } from "lucide-react";
import type { InvoiceFormData } from "@/types";

const parseBRL = (v: string) => parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;

function makeCurrencyHandler(rhfOnChange: (e: React.ChangeEvent<HTMLInputElement>) => void) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (raw) {
      const num = parseFloat(raw) / 100;
      e.target.value = num.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }
    rhfOnChange(e);
  };
}

function Field({
  label,
  required,
  hint,
  error,
  children
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {label} {required && <span className="text-primary">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-danger">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}

function SectionHeader({ label, bordered }: { label: string; bordered?: boolean }) {
  return (
    <div
      className={`bg-background px-6 py-3 ${
        bordered ? "border-t border-b border-border" : "border-b border-border"
      }`}
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/60";

export default function NewInvoicePage() {
  const router = useRouter();
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [fileName, setFileName] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<InvoiceFormData>();
  const valorBruto = watch("valor_bruto");

  const onSubmit = async (_data: InvoiceFormData) => {
    setSubmitError("");
    setLoading(true);
    // MOCK: simula envio. Quando integrar Supabase, fazer upload + insert aqui.
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h2 className="mb-2 text-2xl font-semibold text-foreground">Nota enviada!</h2>
        <p className="mb-8 text-sm text-muted">
          Sua nota fiscal foi registrada. A equipe Caracol vai analisar em breve e voce pode acompanhar o status pelo painel.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setSuccess(false)}
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
          >
            Enviar outra
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            Ver minhas notas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        onClick={() => router.push("/dashboard")}
        className="mb-6 flex items-center gap-1.5 text-sm text-muted transition-opacity hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar ao painel
      </button>

      <div className="mb-8">
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
          Envio de nota fiscal
        </h4>
        <h1 className="text-2xl font-semibold text-foreground">Nova nota fiscal</h1>
        <p className="mt-1 text-sm text-muted">Preencha os dados da NF emitida para a Caracol.</p>
      </div>

      {submitError && (
        <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
          <p className="text-sm text-danger">{submitError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="mb-4 overflow-hidden rounded-xl border border-border bg-surface">
          <SectionHeader label="Identificacao" />
          <div className="space-y-5 px-6 py-6">
            <Field
              label="Numero da nota fiscal"
              required
              error={errors.numero_nota?.message}
              hint="Ex: NF-000142 ou 142"
            >
              <input
                {...register("numero_nota", { required: "Informe o numero da nota." })}
                className={inputCls}
                placeholder="NF-000142"
              />
            </Field>
            <Field
              label="Descricao do servico"
              required
              error={errors.descricao?.message}
              hint="Descreva os servicos prestados conforme consta na nota."
            >
              <textarea
                {...register("descricao", {
                  required: "Informe a descricao do servico.",
                  minLength: { value: 10, message: "Min. 10 caracteres." }
                })}
                rows={3}
                className={inputCls}
                placeholder="Ex: Consultoria em tecnologia da informacao — Abril/2026"
              />
            </Field>
          </div>

          <SectionHeader label="Valores" bordered />
          <div className="px-6 py-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label="Valor bruto (R$)"
                required
                error={errors.valor_bruto?.message}
                hint="Valor total sem deducoes"
              >
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted">
                    R$
                  </span>
                  {(() => {
                    const { onChange, ...rest } = register("valor_bruto", {
                      required: "Informe o valor bruto.",
                      validate: (v) => parseBRL(v) > 0 || "Valor deve ser maior que zero."
                    });
                    return (
                      <input
                        {...rest}
                        onChange={makeCurrencyHandler(onChange)}
                        className={inputCls + " pl-10"}
                        placeholder="0,00"
                      />
                    );
                  })()}
                </div>
              </Field>
              <Field
                label="Valor liquido (R$)"
                required
                error={errors.valor_liquido?.message}
                hint="Apos impostos e deducoes"
              >
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted">
                    R$
                  </span>
                  {(() => {
                    const { onChange, ...rest } = register("valor_liquido", {
                      required: "Informe o valor liquido.",
                      validate: (v) => {
                        const liq = parseBRL(v);
                        const bruto = parseBRL(valorBruto);
                        if (liq <= 0) return "Valor deve ser maior que zero.";
                        if (bruto > 0 && liq > bruto)
                          return "Liquido nao pode ser maior que o bruto.";
                        return true;
                      }
                    });
                    return (
                      <input
                        {...rest}
                        onChange={makeCurrencyHandler(onChange)}
                        className={inputCls + " pl-10"}
                        placeholder="0,00"
                      />
                    );
                  })()}
                </div>
              </Field>
            </div>
            {valorBruto && parseBRL(valorBruto) > 0 && (
              <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-background p-3 text-sm">
                <span className="text-muted">Desconto / impostos</span>
                <span className="font-medium text-foreground">
                  {(() => {
                    const liq = parseBRL(watch("valor_liquido") || "0");
                    const bruto = parseBRL(valorBruto);
                    const diff = bruto - liq;
                    if (diff <= 0 || isNaN(diff)) return "—";
                    return `- ${diff.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL"
                    })} (${((diff / bruto) * 100).toFixed(1)}%)`;
                  })()}
                </span>
              </div>
            )}
          </div>

          <SectionHeader label="Prazo" bordered />
          <div className="px-6 py-6">
            <div className="max-w-xs">
              <Field label="Data de vencimento" required error={errors.data_vencimento?.message}>
                <input
                  type="date"
                  {...register("data_vencimento", { required: "Informe a data de vencimento." })}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>

          <SectionHeader label="Arquivo da NF" bordered />
          <div className="px-6 py-6">
            <label
              htmlFor="arquivo"
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-8 transition-colors hover:bg-background ${
                fileName ? "border-primary/50" : "border-border"
              }`}
            >
              {fileName ? (
                <>
                  <FileUp className="h-6 w-6 text-primary" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">{fileName}</p>
                    <p className="mt-0.5 text-xs text-muted">Clique para trocar o arquivo</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background">
                    <Upload className="h-4 w-4 text-muted" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Clique para fazer upload</p>
                    <p className="mt-0.5 text-xs text-muted">PDF ou XML da NF-e — max. 10 MB</p>
                  </div>
                </>
              )}
              <input
                id="arquivo"
                type="file"
                accept=".pdf,.xml"
                className="sr-only"
                {...register("arquivo")}
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar nota fiscal"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
