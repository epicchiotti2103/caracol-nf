"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Search, Sparkles, Tag as TagIcon, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { fmtCurrency } from "@/lib/i18n";
import type {
  CampanhaSearchItem,
  FechamentoSugestaoItem,
  NfCampanhaLink,
  NfTag
} from "@/types";

// Linha de vinculo no estado do form (valor como string pra mascara monetaria
// consistente com o resto do NF — vira number so no submit).
export interface CampanhaLinkDraft {
  campanha_id: string;
  // Label resolvido pra exibicao ("CMP-001 — nome — MM/YYYY"). Opcional;
  // quando ausente cai no campanha_id.
  label?: string;
  valor: string;
  // True quando a linha nasceu de uma sugestao do fechamento (marcar checkbox).
  // Usado pra (a) nao duplicar na lista manual e (b) limpar ao trocar fornecedor.
  from_suggestion?: boolean;
}

// Converte os links enriquecidos do GET (NfCampanhaLink) em rascunhos editaveis.
export function campanhaLinksToDrafts(
  links: NfCampanhaLink[] | undefined | null
): CampanhaLinkDraft[] {
  if (!links || links.length === 0) return [];
  return links.map((l) => ({
    campanha_id: l.campanha_id,
    label: formatCampanhaLabel(l),
    valor:
      l.valor_alocado != null && l.valor_alocado !== ""
        ? String(l.valor_alocado)
        : ""
  }));
}

// Serializa os rascunhos pro payload do backend: [{campanha_id, valor}].
// Ignora linhas sem campanha selecionada. Valor parseado (',' -> '.').
export function draftsToPayload(
  drafts: CampanhaLinkDraft[]
): { campanha_id: string; valor: number }[] {
  return drafts
    .filter((d) => d.campanha_id)
    .map((d) => ({
      campanha_id: d.campanha_id,
      valor: parseFloat((d.valor || "0").replace(",", ".")) || 0
    }));
}

export function formatCampanhaLabel(
  c: CampanhaSearchItem | NfCampanhaLink
): string {
  const parts: string[] = [];
  if (c.codigo) parts.push(String(c.codigo));
  if (c.name) parts.push(String(c.name));
  const mes = formatMesRef(c.mes_referencia);
  if (mes) parts.push(mes);
  return parts.join(" — ") || (c as any).campanha_id || "(campanha)";
}

function formatMesRef(s: string | null | undefined): string {
  if (!s) return "";
  const ym = s.length >= 7 ? s.slice(0, 7) : s;
  const [y, m] = ym.split("-");
  if (!y || !m) return s;
  return `${m}/${y}`;
}

interface Props {
  tagId: string;
  onTagChange: (id: string) => void;
  campanhas: CampanhaLinkDraft[];
  onCampanhasChange: (next: CampanhaLinkDraft[]) => void;
  // Total da NF (numero) pra comparar com a soma das alocacoes. Opcional.
  totalNf?: number;
  moeda?: string;
  // Fornecedor escolhido (so NF a PAGAR, admin/adm_campanha). Quando presente,
  // habilita o bloco de SUGESTOES do fechamento (campanhas a receber agrupadas
  // por mes). Ausente (NF a receber, ou sem fornecedor) => so modo manual.
  supplierId?: string;
}

/**
 * Bloco reutilizado nos 3 forms de NF (a pagar criar/editar, a receber
 * criar/editar). Renderiza:
 *  - Seletor de Tag (dropdown das tags ATIVAS, opcional "Sem tag").
 *  - Lista dinamica de vinculos de campanha {campanha, valor} com busca.
 *  - Aviso discreto comparando soma das alocacoes vs total da NF (nao bloqueia).
 *
 * Graceful degradation: se GET /nf/tags ou /campanhas falharem (backend ainda
 * em deploy), o bloco degrada — tag fica vazia, busca informa indisponibilidade,
 * e o form continua submetendo normalmente.
 */
export function NfTagCampanhaFields({
  tagId,
  onTagChange,
  campanhas,
  onCampanhasChange,
  totalNf,
  moeda = "BRL",
  supplierId
}: Props) {
  const [tags, setTags] = useState<NfTag[]>([]);
  const [tagsUnavailable, setTagsUnavailable] = useState(false);

  // ── Sugestoes do fechamento (so quando ha fornecedor) ─────────────────────
  const [suggestions, setSuggestions] = useState<FechamentoSugestaoItem[]>([]);
  const [sugLoading, setSugLoading] = useState(false);
  // Backend ainda em deploy / 404 / erro de rede => suprime o bloco (graceful).
  const [sugUnavailable, setSugUnavailable] = useState(false);

  // Busca as sugestoes sempre que o fornecedor muda. Sem fornecedor, zera.
  useEffect(() => {
    if (!supplierId) {
      setSuggestions([]);
      setSugUnavailable(false);
      setSugLoading(false);
      return;
    }
    let cancelled = false;
    setSugLoading(true);
    (async () => {
      try {
        const res: { items?: FechamentoSugestaoItem[] } | FechamentoSugestaoItem[] =
          await apiFetch(
            `/nf/fechamento-sugestoes?supplier_id=${encodeURIComponent(supplierId)}`
          );
        const items = Array.isArray(res) ? res : res?.items || [];
        if (!cancelled) {
          setSuggestions(items);
          setSugUnavailable(false);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setSugUnavailable(true);
        }
      } finally {
        if (!cancelled) setSugLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  // Ao TROCAR de fornecedor, descarta as linhas que vieram de sugestao (pertenciam
  // ao fornecedor antigo) — mas preserva as adicionadas manualmente. O guard por
  // ref evita rodar no mount e em re-renders que nao mudaram o fornecedor.
  const prevSupplierRef = useRef(supplierId);
  useEffect(() => {
    if (prevSupplierRef.current === supplierId) return;
    prevSupplierRef.current = supplierId;
    if (campanhas.some((c) => c.from_suggestion)) {
      onCampanhasChange(campanhas.filter((c) => !c.from_suggestion));
    }
  }, [supplierId, campanhas, onCampanhasChange]);

  // Agrupa as sugestoes por mes de referencia (mais recente primeiro).
  const suggestionGroups = useMemo(() => {
    const map = new Map<string, FechamentoSugestaoItem[]>();
    for (const it of suggestions) {
      const key = it.mes_referencia || "";
      const arr = map.get(key);
      if (arr) arr.push(it);
      else map.set(key, [it]);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [suggestions]);

  // campanha_id -> linha atual no estado (pra refletir checkbox/valor).
  const draftById = useMemo(() => {
    const m = new Map<string, CampanhaLinkDraft>();
    for (const d of campanhas) if (d.campanha_id) m.set(d.campanha_id, d);
    return m;
  }, [campanhas]);

  const updateById = (campanha_id: string, patch: Partial<CampanhaLinkDraft>) => {
    onCampanhasChange(
      campanhas.map((c) => (c.campanha_id === campanha_id ? { ...c, ...patch } : c))
    );
  };

  const toggleSuggestion = (item: FechamentoSugestaoItem) => {
    if (draftById.has(item.campanha_id)) {
      onCampanhasChange(
        campanhas.filter((c) => c.campanha_id !== item.campanha_id)
      );
      return;
    }
    const label = formatCampanhaLabel({
      id: item.campanha_id,
      codigo: item.codigo ?? null,
      name: item.campanha_name ?? null,
      mes_referencia: item.mes_referencia ?? null
    });
    onCampanhasChange([
      ...campanhas,
      {
        campanha_id: item.campanha_id,
        label,
        valor: String(item.valor_sugerido ?? ""),
        from_suggestion: true
      }
    ]);
  };

  // Lista de meses de referencia disponiveis (cacheada no nivel do bloco,
  // compartilhada por todas as linhas — nao rebusca por linha).
  const [months, setMonths] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: { items: NfTag[] } | NfTag[] = await apiFetch(
          "/nf/tags?active=true"
        );
        const items = Array.isArray(res) ? res : res?.items || [];
        if (!cancelled) setTags(items);
      } catch {
        if (!cancelled) setTagsUnavailable(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: { months?: string[] } = await apiFetch(
          "/campanhas?months_available=1"
        );
        const list = Array.isArray(res?.months) ? res.months : [];
        if (!cancelled) setMonths(list);
      } catch {
        // Degrada: sem meses o picker cai na busca global por texto.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Se a tag atual nao esta na lista (ex: tag inativa ja vinculada), mantem
  // visivel pra nao perder a selecao.
  const tagInList = tags.some((t) => t.id === tagId);

  const inputCls =
    "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/60";

  const somaAloc = useMemo(
    () =>
      campanhas.reduce(
        (s, c) => s + (parseFloat((c.valor || "0").replace(",", ".")) || 0),
        0
      ),
    [campanhas]
  );

  const hasCampanhas = campanhas.length > 0;
  // Linhas mostradas na lista manual (com fornecedor, as de sugestao saem dali).
  const manualCount = supplierId
    ? campanhas.filter((c) => !c.from_suggestion).length
    : campanhas.length;
  const totalKnown = typeof totalNf === "number" && !isNaN(totalNf) && totalNf > 0;
  const mismatch =
    hasCampanhas && totalKnown && Math.abs(somaAloc - totalNf) > 0.005;

  const updateRow = (idx: number, patch: Partial<CampanhaLinkDraft>) => {
    onCampanhasChange(
      campanhas.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    );
  };

  const removeRow = (idx: number) => {
    onCampanhasChange(campanhas.filter((_, i) => i !== idx));
  };

  const addRow = () => {
    onCampanhasChange([...campanhas, { campanha_id: "", valor: "" }]);
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-background/40 p-4">
      <p className="text-xs text-muted">
        Voce pode vincular campanhas de meses diferentes nesta mesma NF.
      </p>

      {/* Tag */}
      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
          <TagIcon className="h-3.5 w-3.5 text-muted" />
          Tag
        </label>
        {tagsUnavailable ? (
          <p className="text-xs text-muted">
            Tags indisponiveis no momento.
          </p>
        ) : (
          <select
            value={tagId}
            onChange={(e) => onTagChange(e.target.value)}
            className={inputCls}
          >
            <option value="">— Sem tag —</option>
            {!tagInList && tagId && (
              <option value={tagId}>(tag atual)</option>
            )}
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Sugestoes do fechamento (so com fornecedor; graceful se indisponivel) */}
      {supplierId && !sugUnavailable && (sugLoading || suggestionGroups.length > 0) && (
        <div className="rounded-lg border border-border bg-background/40 p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <p className="text-sm font-medium text-foreground">
              Pagamentos a receber (do fechamento)
            </p>
            {sugLoading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            )}
          </div>

          {!sugLoading && suggestionGroups.length === 0 ? (
            <p className="text-xs text-muted">
              Nenhum pagamento pendente do fechamento para este fornecedor.
            </p>
          ) : (
            <div className="space-y-3">
              {suggestionGroups.map(([mes, items]) => (
                <div key={mes || "sem-mes"}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    {mes ? `Mes ${formatMesRef(mes)}` : "Sem mes"}
                  </p>
                  <div className="space-y-1.5">
                    {items.map((item) => {
                      const draft = draftById.get(item.campanha_id);
                      const checked = !!draft;
                      const sugMoeda = item.moeda || moeda;
                      return (
                        <div
                          key={item.campanha_id}
                          className="flex items-center gap-2"
                        >
                          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSuggestion(item)}
                              className="h-4 w-4 flex-shrink-0 accent-primary"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                              {item.codigo ? `${item.codigo} — ` : ""}
                              {item.campanha_name || item.campanha_id.slice(0, 8)}
                            </span>
                          </label>
                          {checked ? (
                            <input
                              value={draft?.valor ?? ""}
                              onChange={(e) =>
                                updateById(item.campanha_id, {
                                  valor: e.target.value
                                })
                              }
                              inputMode="decimal"
                              placeholder="0,00"
                              aria-label="Valor a vincular"
                              className="w-28 flex-shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                            />
                          ) : (
                            <span className="w-28 flex-shrink-0 text-right text-xs text-muted">
                              {fmtCurrency(item.valor_sugerido, sugMoeda, "pt")}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-2 text-[11px] text-muted">
            Marque as campanhas que esta NF cobre. O valor vem do fechamento e e
            editavel.
          </p>
        </div>
      )}

      {/* Campanhas */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            {supplierId ? "Outras campanhas" : "Campanhas"}
          </label>
          {hasCampanhas && (
            <span
              className={`text-xs ${mismatch ? "text-amber-400" : "text-muted"}`}
            >
              soma: {fmtCurrency(somaAloc, moeda, "pt")}
              {totalKnown && (
                <>
                  {" · "}
                  total da NF: {fmtCurrency(totalNf!, moeda, "pt")}
                </>
              )}
            </span>
          )}
        </div>

        {manualCount === 0 && (
          <p className="mb-2 text-xs text-muted">
            {supplierId
              ? "Nenhuma campanha avulsa. Use a busca abaixo pra vincular fora da sugestao."
              : "Nenhuma campanha vinculada."}
          </p>
        )}

        <div className="space-y-2">
          {campanhas.map((row, idx) => {
            // Linhas vindas de sugestao sao geridas pelos checkboxes acima — nao
            // duplicar aqui. (idx preservado retornando null pra updateRow/removeRow.)
            if (supplierId && row.from_suggestion) return null;
            return (
              <div key={idx} className="flex items-start gap-2">
                <div className="flex-1">
                  <CampanhaPicker
                    value={row.campanha_id}
                    label={row.label}
                    months={months}
                    onSelect={(item) =>
                      updateRow(idx, {
                        campanha_id: item.id,
                        label: formatCampanhaLabel(item)
                      })
                    }
                  />
                </div>
                <input
                  value={row.valor}
                  onChange={(e) => updateRow(idx, { valor: e.target.value })}
                  inputMode="decimal"
                  placeholder="0,00"
                  aria-label="Valor alocado"
                  className="w-28 flex-shrink-0 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/60"
                />
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  aria-label="Remover campanha"
                  className="mt-1 flex-shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-danger"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="mt-2 flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface/80"
        >
          <Plus className="h-3.5 w-3.5" />
          {supplierId ? "Adicionar campanha avulsa" : "Adicionar campanha"}
        </button>
      </div>
    </div>
  );
}

/**
 * Campo de busca de campanha com dropdown de resultados. Antes da busca, um
 * seletor de mes de referencia (populado pelo bloco pai) reduz o escopo:
 * GET /campanhas?month=<YYYY-MM>&q=<texto> (month e q combinaveis).
 * Quando ja existe selecao, mostra o label resolvido com botao pra trocar.
 */
function CampanhaPicker({
  value,
  label,
  months,
  onSelect
}: {
  value: string;
  label?: string;
  months: string[];
  onSelect: (item: CampanhaSearchItem) => void;
}) {
  const [open, setOpen] = useState(!value);
  const [month, setMonth] = useState("");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<CampanhaSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (month) params.set("month", month);
        if (debounced) params.set("q", debounced);
        const res: { items: CampanhaSearchItem[] } | CampanhaSearchItem[] =
          await apiFetch(`/campanhas?${params.toString()}`);
        const items = Array.isArray(res) ? res : res?.items || [];
        if (!cancelled) {
          setResults(items.slice(0, 20));
          setUnavailable(false);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
          setUnavailable(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, month, open]);

  // Fecha o dropdown ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        // Mantem aberto se ainda nao ha selecao (evita "perder" o campo).
        if (value) setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, value]);

  if (value && !open) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
        <span className="flex-1 truncate text-sm text-foreground">
          {label || value}
        </span>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setQuery("");
          }}
          className="flex-shrink-0 text-xs font-medium text-primary hover:underline"
        >
          trocar
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative space-y-2">
      {months.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="flex-shrink-0 text-xs font-medium text-muted">
            Mes:
          </span>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Mes de referencia da campanha"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/60"
          >
            <option value="">Todos os meses</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMesRef(m)}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={
            month
              ? "Buscar campanha do mes..."
              : "Buscar campanha (CMP-001 ou nome)..."
          }
          className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary/60"
        />
        {open && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-xl">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          ) : unavailable ? (
            <p className="px-3 py-3 text-xs text-muted">
              Busca de campanhas indisponivel.
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted">
              {debounced ? "Nenhuma campanha encontrada." : "Digite para buscar."}
            </p>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelect(c);
                  setOpen(false);
                }}
                className="block w-full truncate px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-background"
              >
                {formatCampanhaLabel(c)}
              </button>
            ))
          )}
          </div>
        )}
      </div>
    </div>
  );
}
