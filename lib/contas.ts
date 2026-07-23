// Contas onde o dinheiro fica, por moeda. Espelha o lib/contas.ts do
// caracol-gerencial e os valores canonicos do backend. value = guardado no
// banco; label = exibido; a 1a de cada moeda = default.
import type { Moeda } from "@/types";

export interface ContaOption {
  value: string;
  label: string;
}

export const CONTAS_POR_MOEDA: Record<Moeda, ContaOption[]> = {
  BRL: [
    { value: "conta_corrente", label: "Conta Corrente" },
    { value: "investimento", label: "Investimento" }
  ],
  USD: [
    { value: "helmbank", label: "HelmBank" },
    { value: "tronlink", label: "Tronlink (USDT)" }
  ]
};

export const CONTA_DEFAULT: Record<Moeda, string> = {
  BRL: "conta_corrente",
  USD: "helmbank"
};

export function contasOf(moeda: Moeda): ContaOption[] {
  return CONTAS_POR_MOEDA[moeda] ?? [];
}

export function contaLabel(moeda: Moeda, value: string | null | undefined): string {
  if (!value) return "—";
  const found = CONTAS_POR_MOEDA[moeda]?.find((c) => c.value === value);
  return found?.label ?? value;
}

// Conta valida pra moeda? Usado pra resetar seletor quando a moeda muda.
export function isContaValid(moeda: Moeda, value: string | null | undefined): boolean {
  return !!value && (CONTAS_POR_MOEDA[moeda]?.some((c) => c.value === value) ?? false);
}
