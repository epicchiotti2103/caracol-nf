"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Users, Plus, X, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff } from "lucide-react";
import { MOCK_SUPPLIERS } from "@/lib/mock";
import type { Supplier, SupplierFormData } from "@/types";

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(MOCK_SUPPLIERS);
  const [modalOpen, setModalOpen] = useState(false);

  const handleCreated = (s: Supplier) => {
    setSuppliers((prev) => [s, ...prev]);
    setModalOpen(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
            Gestao de fornecedores
          </h4>
          <h1 className="text-2xl font-semibold text-foreground">Fornecedores cadastrados</h1>
          <p className="mt-1 text-sm text-muted">
            Empresas autorizadas a enviar notas fiscais pelo portal.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Novo fornecedor
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Razao social", "CNPJ", "E-mail", "Cadastrado em"].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-16 text-center">
                  <Users className="mx-auto mb-3 h-8 w-8 opacity-20" />
                  <p className="text-sm text-muted">Nenhum fornecedor cadastrado ainda.</p>
                </td>
              </tr>
            ) : (
              suppliers.map((s, i) => (
                <tr
                  key={s.id}
                  className={`transition-colors hover:bg-background ${
                    i < suppliers.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <td className="px-5 py-4 font-medium text-foreground">{s.razao_social}</td>
                  <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-muted">{s.cnpj}</td>
                  <td className="px-5 py-4 text-muted">{s.email}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-muted">{fmtDate(s.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && <NewSupplierModal onClose={() => setModalOpen(false)} onCreated={handleCreated} />}
    </div>
  );
}

function NewSupplierModal({
  onClose,
  onCreated
}: {
  onClose: () => void;
  onCreated: (supplier: Supplier) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<SupplierFormData>();

  const onSubmit = async (data: SupplierFormData) => {
    setSubmitError("");
    // MOCK: simula criacao. Quando integrar Supabase, fazer chamada ao backend (POST /api/v1/nf/suppliers).
    await new Promise((r) => setTimeout(r, 700));

    const newSupplier: Supplier = {
      id: `sup-${Date.now()}`,
      razao_social: data.razao_social,
      cnpj: data.cnpj,
      email: data.email,
      created_at: new Date().toISOString()
    };
    setSuccess(true);
    setTimeout(() => onCreated(newSupplier), 1200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-zinc-950 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Cadastrar fornecedor
            </p>
            <p className="text-base font-semibold text-orange-50">Conta de acesso ao portal</p>
          </div>
          <button onClick={onClose} className="text-orange-100/40 transition-colors hover:text-orange-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-10 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-primary" />
            <p className="text-base font-semibold text-foreground">Fornecedor cadastrado!</p>
            <p className="mt-1 text-sm text-muted">
              Envie as credenciais por e-mail ou WhatsApp para o fornecedor logar.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
            {submitError && (
              <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/10 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
                <p className="text-sm text-danger">{submitError}</p>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Razao social <span className="text-primary">*</span>
              </label>
              <input
                {...register("razao_social", { required: "Informe a razao social." })}
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary/60"
                placeholder="Empresa LTDA"
              />
              {errors.razao_social && (
                <p className="mt-1 text-xs text-danger">{errors.razao_social.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                CNPJ <span className="text-primary">*</span>
              </label>
              <input
                {...register("cnpj", {
                  required: "Informe o CNPJ.",
                  pattern: {
                    value: /^[0-9./-]{14,18}$/,
                    message: "Use formato XX.XXX.XXX/XXXX-XX"
                  }
                })}
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm font-mono text-foreground outline-none focus:border-primary/60"
                placeholder="00.000.000/0000-00"
              />
              {errors.cnpj && <p className="mt-1 text-xs text-danger">{errors.cnpj.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                E-mail de acesso <span className="text-primary">*</span>
              </label>
              <input
                type="email"
                {...register("email", {
                  required: "Informe o e-mail.",
                  pattern: { value: /^[^@\s]+@[^@\s]+\.[^@\s]+$/, message: "E-mail invalido." }
                })}
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary/60"
                placeholder="contato@empresa.com.br"
              />
              {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Senha inicial <span className="text-primary">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  {...register("password", {
                    required: "Defina uma senha.",
                    minLength: { value: 6, message: "Min. 6 caracteres." }
                  })}
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground outline-none focus:border-primary/60"
                  placeholder="Minimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-danger">{errors.password.message}</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground hover:bg-background"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cadastrar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
