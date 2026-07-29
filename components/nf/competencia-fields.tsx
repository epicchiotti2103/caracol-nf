"use client";

import { Plus, X } from "lucide-react";
import { fmtCurrency } from "@/lib/i18n";
import type { NfCompetencia } from "@/types";

/**
 * Editor das competencias da NF a pagar.
 *
 * Caso comum (1 competencia) = exatamente a UX de antes: um unico dropdown de
 * mes, sem campo de valor. O valor da linha unica **e derivado** do valor da NF
 * (nunca fica em estado proprio, senao ficaria stale quando o usuario edita o
 * valor depois).
 *
 * Com 2+ competencias aparece o campo de valor por linha, o total alocado, o
 * valor da NF e a diferenca em tempo real.
 */

export interface CompetenciaDraft {
  competencia: string; // YYYY-MM
  valor: string;       // texto (aceita virgula); ignorado quando ha 1 so linha
}

const TOLERANCIA = 0.01;

// Dropdown de meses: 12 passados + atual + 3 futuros (mesma janela do filtro do
// dashboard). Safari/Firefox nao suportam <input type="month"> nativamente.
export function buildCompetenciaOptions(
  lang: "pt" | "en"
): Array<{ value: string; label: string }> {
  const opts: Array<{ value: string; label: string }> = [];
  const today = new Date();
  today.setDate(1);
  const locale = lang === "pt" ? "pt-BR" : "en-US";
  const formatter = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  for (let i = 12; i >= -3; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const labelRaw = formatter.format(d);
    opts.push({
      value: `${y}-${m}`,
      label: labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1)
    });
  }
  return opts.reverse(); // mais recente primeiro
}

export function parseValor(v: string | number | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** "YYYY-MM-01" | "YYYY-MM" -> "YYYY-MM" */
export function toYearMonth(s: string | null | undefined): string {
  if (!s) return "";
  return s.length >= 7 ? s.slice(0, 7) : s;
}

/** Rascunhos a partir de uma NF ja existente (GET). Sempre >= 1 linha. */
export function competenciasToDrafts(
  competencias: NfCompetencia[] | null | undefined,
  referenceMonth: string | null | undefined
): CompetenciaDraft[] {
  if (competencias && competencias.length > 0) {
    return competencias.map((c) => ({
      competencia: toYearMonth(c.competencia),
      valor: c.valor != null && c.valor !== "" ? String(c.valor) : ""
    }));
  }
  return [{ competencia: toYearMonth(referenceMonth), valor: "" }];
}

/** Soma alocada. Com 1 linha, a alocacao e o proprio valor da NF. */
export function sumCompetencias(
  drafts: CompetenciaDraft[],
  totalNf: number
): number {
  if (drafts.length <= 1) return totalNf;
  return drafts.reduce((s, d) => s + parseValor(d.valor), 0);
}

/** Menor competencia declarada — vira o `reference_month` ancora (compat). */
export function anchorCompetencia(drafts: CompetenciaDraft[]): string {
  const meses = drafts.map((d) => d.competencia).filter(Boolean).sort();
  return meses[0] || "";
}

/**
 * Payload do backend: [{competencia:"YYYY-MM", valor:"3000.00"}].
 * Com 1 linha o valor e o total da NF (derivado, nunca digitado).
 */
export function competenciasToPayload(
  drafts: CompetenciaDraft[],
  totalNf: number
): Array<{ competencia: string; valor: string }> {
  const rows = drafts.filter((d) => d.competencia);
  if (rows.length === 0) return [];
  if (rows.length === 1) {
    return [{ competencia: rows[0].competencia, valor: totalNf.toFixed(2) }];
  }
  return rows.map((d) => ({
    competencia: d.competencia,
    valor: parseValor(d.valor).toFixed(2)
  }));
}

/** Validacao. Devolve mensagem de erro ou null. */
export function validateCompetencias(
  drafts: CompetenciaDraft[],
  totalNf: number,
  lang: "pt" | "en",
  moeda: "BRL" | "USD" = "BRL"
): string | null {
  if (drafts.length === 0 || drafts.some((d) => !d.competencia)) {
    return lang === "pt"
      ? "Selecione o mes de competencia em todas as linhas."
      : "Select the competence month on every row.";
  }
  const meses = drafts.map((d) => d.competencia);
  if (new Set(meses).size !== meses.length) {
    return lang === "pt"
      ? "Ha meses de competencia repetidos."
      : "Duplicated competence months.";
  }
  if (drafts.length === 1) return null;
  if (drafts.some((d) => parseValor(d.valor) <= 0)) {
    return lang === "pt"
      ? "Informe um valor maior que zero em cada competencia."
      : "Enter an amount greater than zero for each competence.";
  }
  const soma = sumCompetencias(drafts, totalNf);
  const diff = totalNf - soma;
  if (Math.abs(diff) > TOLERANCIA) {
    const abs = fmtCurrency(Math.abs(diff), moeda, lang);
    if (diff > 0) {
      return lang === "pt"
        ? `Faltam ${abs} pra fechar o valor da nota.`
        : `${abs} missing to match the invoice amount.`;
    }
    return lang === "pt"
      ? `Sobram ${abs} — a soma das competencias passou do valor da nota.`
      : `${abs} over — the competences sum exceeds the invoice amount.`;
  }
  return null;
}

interface Props {
  drafts: CompetenciaDraft[];
  onChange: (next: CompetenciaDraft[]) => void;
  /** Valor total da NF (numero). 0/NaN quando o usuario ainda nao digitou. */
  totalNf: number;
  moeda: "BRL" | "USD";
  lang: "pt" | "en";
  /** Classe do input/select pra casar com o form hospedeiro. */
  inputCls: string;
}

export function CompetenciaFields({
  drafts,
  onChange,
  totalNf,
  moeda,
  lang,
  inputCls
}: Props) {
  const options = buildCompetenciaOptions(lang);
  const multi = drafts.length > 1;
  const soma = sumCompetencias(drafts, totalNf);
  const diff = totalNf - soma;

  const t = {
    label: lang === "pt" ? "Mes de competencia da NF" : "Invoice competence month",
    hint:
      lang === "pt"
        ? "Nao limita as campanhas — voce pode vincular campanhas de meses diferentes abaixo."
        : "Does not limit campaigns — you can link campaigns from different months below.",
    hintMulti:
      lang === "pt"
        ? "A NF cobre mais de um mes: distribua o valor entre as competencias."
        : "This invoice covers more than one month: split the amount across competences.",
    select: lang === "pt" ? "Selecione o mes" : "Select a month",
    add: lang === "pt" ? "+ adicionar mes" : "+ add month",
    remove: lang === "pt" ? "Remover" : "Remove",
    allocated: lang === "pt" ? "Alocado" : "Allocated",
    invoiceTotal: lang === "pt" ? "Valor da NF" : "Invoice amount",
    diff: lang === "pt" ? "Diferenca" : "Difference",
    missing: lang === "pt" ? "faltam" : "missing",
    over: lang === "pt" ? "sobram" : "over",
    ok: lang === "pt" ? "Fecha com o valor da nota." : "Matches the invoice amount."
  };

  const setRow = (idx: number, patch: Partial<CompetenciaDraft>) => {
    onChange(drafts.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const addRow = () => {
    // Ao sair de 1 -> 2 linhas, a primeira deixa de ser derivada: semeia com o
    // valor total da NF pro usuario so ajustar pra baixo.
    if (drafts.length === 1) {
      const seed = totalNf > 0 ? totalNf.toFixed(2) : "";
      onChange([
        { ...drafts[0], valor: drafts[0].valor || seed },
        { competencia: "", valor: "" }
      ]);
      return;
    }
    onChange([...drafts, { competencia: "", valor: "" }]);
  };

  const removeRow = (idx: number) => {
    const next = drafts.filter((_, i) => i !== idx);
    onChange(next.length > 0 ? next : [{ competencia: "", valor: "" }]);
  };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {t.label} <span className="text-primary">*</span>
      </label>

      <div className="space-y-2">
        {drafts.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={d.competencia}
              onChange={(e) => setRow(i, { competencia: e.target.value })}
              className={inputCls + " flex-1"}
            >
              <option value="">{t.select}</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              {/* Competencia fora da janela de 12m (NF antiga sendo editada) */}
              {d.competencia && !options.some((o) => o.value === d.competencia) && (
                <option value={d.competencia}>{d.competencia}</option>
              )}
            </select>

            {multi && (
              <input
                value={d.valor}
                onChange={(e) => setRow(i, { valor: e.target.value })}
                inputMode="decimal"
                placeholder="0,00"
                aria-label={`${t.label} — ${t.allocated}`}
                className={inputCls + " w-32 flex-shrink-0"}
              />
            )}

            {multi && (
              <button
                type="button"
                onClick={() => removeRow(i)}
                aria-label={t.remove}
                title={t.remove}
                className="flex-shrink-0 rounded-lg border border-border p-2 text-muted transition-colors hover:text-danger"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <Plus className="h-3.5 w-3.5" />
        {t.add}
      </button>

      {multi && (
        <div className="mt-2 rounded-lg border border-border bg-background px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 text-muted">
            <span>
              {t.allocated}: {fmtCurrency(soma, moeda, lang)}
              {" · "}
              {t.invoiceTotal}: {fmtCurrency(totalNf, moeda, lang)}
            </span>
            <span
              className={
                Math.abs(diff) > TOLERANCIA
                  ? "font-semibold text-danger"
                  : "font-semibold text-emerald-400"
              }
            >
              {Math.abs(diff) <= TOLERANCIA
                ? t.ok
                : `${diff > 0 ? t.missing : t.over} ${fmtCurrency(
                    Math.abs(diff),
                    moeda,
                    lang
                  )}`}
            </span>
          </div>
        </div>
      )}

      <p className="mt-1.5 text-xs text-muted">{multi ? t.hintMulti : t.hint}</p>
    </div>
  );
}
