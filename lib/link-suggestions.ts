import { ApiHttpError, apiFetchStrict } from "@/lib/api-error";
import type { LinkSuggestionsResponse } from "@/types";

/**
 * Cliente do GET /nf/link-suggestions (sugestoes de vinculo NF a pagar ->
 * campanha). Usa `apiFetchStrict` pra enxergar o status HTTP: 404/405 = rota
 * ainda nao publicada no backend -> "unavailable" (a UI degrada sem quebrar).
 */
export type LinkSuggestionsResult =
  | { status: "ok"; data: LinkSuggestionsResponse }
  | { status: "unavailable" };

export function isRouteMissing(err: unknown): boolean {
  const s = (err as ApiHttpError | undefined)?.status;
  return s === 404 || s === 405;
}

export async function fetchLinkSuggestions(month: string): Promise<LinkSuggestionsResult> {
  try {
    const res = await apiFetchStrict(
      `/nf/link-suggestions?month=${encodeURIComponent(month)}`
    );
    const suggestions = Array.isArray(res?.suggestions) ? res.suggestions : [];
    return { status: "ok", data: { month: res?.month || month, suggestions } };
  } catch (err) {
    if (isRouteMissing(err)) return { status: "unavailable" };
    throw err;
  }
}

/** Mes anterior ao corrente, "YYYY-MM" (default da tela). */
export function previousMonth(today: Date = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Ultimos 12 meses (inclui o corrente), mais recente primeiro. */
export function recentMonthOptions(today: Date = new Date()): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    opts.push({ value, label: d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }) });
  }
  return opts;
}

export function toNum(v: number | string | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
