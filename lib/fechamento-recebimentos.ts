import type { ApiHttpError } from "@/lib/api-error";
import type { AjusteStatus, AjusteTipo } from "@/types";
import { parseBrNumberOr0 } from "@/lib/number";
import { readableError } from "@/lib/api-error";

/**
 * Helpers da tela "Pagamentos Wave" (POST/DELETE /nf/fechamento-recebimentos).
 *
 * Os erros do POST vem com `detail` OBJETO `{code, message, fechamento_ids}`.
 * `readableError` so entende detail string/array, entao aqui lemos o objeto
 * direto. Esses codigos NUNCA ganham botao de "fazer mesmo assim" — por isso
 * nao entram no `duplicateDetail` do api-error.
 */
export type RecebimentoErrorCode =
  | "fechamento_nao_encontrado"
  | "outro_cliente"
  | "moedas_diferentes"
  | "moeda_divergente"
  | "nao_travado"
  | "ja_recebido"
  | "nf_vinculada"
  | "provisionado_recebido";

const CODE_MSG: Record<RecebimentoErrorCode, string> = {
  fechamento_nao_encontrado: "Algum fechamento selecionado nao existe mais. A lista foi atualizada.",
  outro_cliente: "Os fechamentos selecionados sao de clientes diferentes. Um pagamento cobre um cliente so.",
  moedas_diferentes: "Os fechamentos selecionados tem moedas diferentes. Um pagamento e de uma moeda so.",
  moeda_divergente: "A moeda do pagamento nao bate com a moeda dos fechamentos.",
  nao_travado: "Algum fechamento foi destravado no Campanhas. Trave de novo antes de registrar.",
  ja_recebido: "Algum fechamento ja foi quitado em outro pagamento (talvez agora mesmo). A lista foi atualizada.",
  nf_vinculada: "Algum fechamento ja esta coberto por NF a receber vinculada. A lista foi atualizada.",
  provisionado_recebido:
    "Um provisionado deste lote ja foi marcado como recebido. Desmarque o recebimento no Gerencial antes de remover."
};

// Codigos que indicam que a lista na tela esta velha -> recarregar.
export const STALE_CODES: RecebimentoErrorCode[] = [
  "fechamento_nao_encontrado",
  "nao_travado",
  "ja_recebido",
  "nf_vinculada"
];

export interface RecebimentoError {
  status: number | null;
  code: RecebimentoErrorCode | null;
  message: string;
  fechamentoIds: string[];
}

export function parseRecebimentoError(err: unknown, fallback: string): RecebimentoError {
  const status = (err as ApiHttpError | undefined)?.status ?? null;
  const detail = (err as ApiHttpError | undefined)?.detail as any;
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const code = typeof detail.code === "string" ? (detail.code as RecebimentoErrorCode) : null;
    const known = code && code in CODE_MSG ? CODE_MSG[code] : null;
    const backendMsg = typeof detail.message === "string" ? detail.message : "";
    const ids = Array.isArray(detail.fechamento_ids)
      ? detail.fechamento_ids.filter((x: unknown) => typeof x === "string")
      : [];
    return {
      status,
      code,
      // Mensagem nossa (clara) + a do backend como detalhe, quando houver.
      message: known
        ? backendMsg && backendMsg !== known
          ? `${known} (${backendMsg})`
          : known
        : backendMsg || fallback,
      fechamentoIds: ids
    };
  }
  return { status, code: null, message: readableError(err, fallback), fechamentoIds: [] };
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Faixa de "antiguidade" de um fechamento pendente (dias em aberto). */
export function agingClass(dias: number | null | undefined): string {
  if (dias == null) return "text-muted";
  if (dias > 60) return "text-danger font-semibold";
  if (dias > 30) return "text-amber-300";
  return "text-muted";
}

export function campanhaLabel(codigo: string | null | undefined, name: string | null | undefined): string {
  return [codigo, name].filter(Boolean).join(" — ") || "Campanha sem nome";
}

// ── Ajustes do lote (custo descontado / provisionado a receber) ────────────

export interface AjusteDraft {
  key: number;
  tipo: AjusteTipo;
  descricao: string;
  valor: string; // texto pt-BR
}

let ajusteSeq = 0;
export function novoAjusteDraft(tipo: AjusteTipo = "custo"): AjusteDraft {
  ajusteSeq += 1;
  return { key: ajusteSeq, tipo, descricao: "", valor: "" };
}

export const AJUSTE_TIPO_LABEL: Record<AjusteTipo, string> = {
  custo: "Custo",
  provisionado: "Provisionado"
};

export const AJUSTE_STATUS: Record<AjusteStatus, { label: string; cls: string }> = {
  pago: { label: "descontado", cls: "bg-zinc-700/40 text-zinc-300" },
  pendente: { label: "a receber", cls: "bg-amber-500/15 text-amber-300" },
  recebido: { label: "recebido", cls: "bg-emerald-500/15 text-emerald-300" },
  sem_transaction: { label: "sem lancamento", cls: "bg-danger/15 text-danger" }
};

export function somaAjustes(list: AjusteDraft[]): { custos: number; provisionados: number } {
  let custos = 0;
  let provisionados = 0;
  for (const a of list) {
    const v = parseBrNumberOr0(a.valor);
    if (!(v > 0)) continue;
    if (a.tipo === "custo") custos += v;
    else provisionados += v;
  }
  return { custos, provisionados };
}

/**
 * Valida os rascunhos e devolve o payload do backend. Linhas totalmente
 * vazias sao ignoradas; linha meio preenchida vira erro.
 */
export function ajustesPayload(
  list: AjusteDraft[]
): { ok: true; ajustes: { tipo: AjusteTipo; descricao: string; valor: number }[] } | { ok: false; error: string } {
  const out: { tipo: AjusteTipo; descricao: string; valor: number }[] = [];
  for (const a of list) {
    const desc = a.descricao.trim();
    const raw = a.valor.trim();
    if (!desc && !raw) continue;
    const v = parseBrNumberOr0(raw);
    if (!desc) return { ok: false, error: "Todo ajuste precisa de descricao." };
    if (!(v > 0)) return { ok: false, error: `Ajuste "${desc}": valor tem que ser maior que zero.` };
    out.push({ tipo: a.tipo, descricao: desc, valor: Math.round(v * 100) / 100 });
  }
  return { ok: true, ajustes: out };
}

/** Classe de cor do residuo (recebido - deveria cair). */
export function residuoClass(v: number | null | undefined): string {
  const x = v || 0;
  if (Math.abs(x) < 0.005) return "text-emerald-400";
  return x < 0 ? "text-danger" : "text-amber-300";
}
