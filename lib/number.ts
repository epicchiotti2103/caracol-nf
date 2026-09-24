/**
 * Parser unico de numero digitado em PT-BR (ou com ponto decimal).
 *
 * - "1.234,56" -> 1234.56   (com virgula: pontos sao milhar, virgula e decimal)
 * - "1234,56"  -> 1234.56
 * - "1234.56"  -> 1234.56   (sem virgula e um ponto seguido de 1-2 digitos: decimal)
 * - "1.500"    -> 1500      (ponto seguido de exatamente 3 digitos: milhar)
 * - "1.234.567"-> 1234567   (varios pontos: milhar)
 * - number passa direto.
 *
 * Retorna NaN quando vazio/invalido — o chamador decide o fallback
 * (`|| 0`, `|| undefined`, validacao de "valor invalido").
 */
export function parseBrNumber(v: string | number | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  let s = String(v ?? "").trim().replace(/\s/g, "");
  if (!s) return NaN;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    const dots = (s.match(/\./g) || []).length;
    if (dots > 1 || /^-?\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Igual a `parseBrNumber`, mas devolve 0 no lugar de NaN. */
export function parseBrNumberOr0(v: string | number | null | undefined): number {
  const n = parseBrNumber(v);
  return Number.isFinite(n) ? n : 0;
}
