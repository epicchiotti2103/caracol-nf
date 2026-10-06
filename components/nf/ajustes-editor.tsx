"use client";

import { Plus, Trash2 } from "lucide-react";
import { AJUSTE_TIPO_LABEL, novoAjusteDraft, type AjusteDraft } from "@/lib/fechamento-recebimentos";
import type { AjusteTipo } from "@/types";

/**
 * Editor de N linhas de ajuste (tipo, descricao, valor) de um lote de
 * recebimento Wave. Custo = descontado do deposito (ja pago); Provisionado =
 * parte que o parceiro reteve e ainda vai cair (vira receita pendente no
 * Gerencial).
 */
export function AjustesEditor({
  value,
  onChange,
  sym,
  disabled
}: {
  value: AjusteDraft[];
  onChange: (next: AjusteDraft[]) => void;
  sym: string;
  disabled?: boolean;
}) {
  const patch = (key: number, p: Partial<AjusteDraft>) =>
    onChange(value.map((a) => (a.key === key ? { ...a, ...p } : a)));

  return (
    <div className="space-y-2">
      {value.map((a) => (
        <div key={a.key} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <select
            value={a.tipo}
            disabled={disabled}
            onChange={(e) => patch(a.key, { tipo: e.target.value as AjusteTipo })}
            className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary/50"
          >
            {(Object.keys(AJUSTE_TIPO_LABEL) as AjusteTipo[]).map((t) => (
              <option key={t} value={t}>
                {AJUSTE_TIPO_LABEL[t]}
              </option>
            ))}
          </select>
          <input
            value={a.descricao}
            disabled={disabled}
            onChange={(e) => patch(a.key, { descricao: e.target.value })}
            placeholder={a.tipo === "custo" ? "Ex: taxa de remessa" : "Ex: retido ate validacao"}
            className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary/50"
          />
          <div className="flex h-8 w-32 items-center rounded-lg border border-border bg-background px-2 focus-within:border-primary/50">
            <span className="mr-1 text-[11px] text-muted">{sym}</span>
            <input
              value={a.valor}
              disabled={disabled}
              onChange={(e) => patch(a.key, { valor: e.target.value })}
              inputMode="decimal"
              placeholder="0,00"
              className="min-w-0 flex-1 bg-transparent text-right text-xs text-foreground outline-none"
            />
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(value.filter((x) => x.key !== a.key))}
            className="rounded-lg p-1.5 text-muted hover:bg-background hover:text-danger disabled:opacity-50"
            title="Remover linha"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...value, novoAjusteDraft()])}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" />
        ajuste
      </button>
    </div>
  );
}
