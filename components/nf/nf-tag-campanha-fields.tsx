"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Search, Tag as TagIcon, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { fmtCurrency } from "@/lib/i18n";
import type { CampanhaSearchItem, NfCampanhaLink, NfTag } from "@/types";

// Linha de vinculo no estado do form (valor como string pra mascara monetaria
// consistente com o resto do NF — vira number so no submit).
export interface CampanhaLinkDraft {
  campanha_id: string;
  // Label resolvido pra exibicao ("CMP-001 — nome — MM/YYYY"). Opcional;
  // quando ausente cai no campanha_id.
  label?: string;
  valor: string;
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
  moeda = "BRL"
}: Props) {
  const [tags, setTags] = useState<NfTag[]>([]);
  const [tagsUnavailable, setTagsUnavailable] = useState(false);

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

      {/* Campanhas */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">Campanhas</label>
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

        {campanhas.length === 0 && (
          <p className="mb-2 text-xs text-muted">
            Nenhuma campanha vinculada.
          </p>
        )}

        <div className="space-y-2">
          {campanhas.map((row, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div className="flex-1">
                <CampanhaPicker
                  value={row.campanha_id}
                  label={row.label}
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
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="mt-2 flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface/80"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar campanha
        </button>
      </div>
    </div>
  );
}

/**
 * Campo de busca de campanha com dropdown de resultados (GET /campanhas?q=).
 * Quando ja existe selecao, mostra o label resolvido com botao pra trocar.
 */
function CampanhaPicker({
  value,
  label,
  onSelect
}: {
  value: string;
  label?: string;
  onSelect: (item: CampanhaSearchItem) => void;
}) {
  const [open, setOpen] = useState(!value);
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
  }, [debounced, open]);

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
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Buscar campanha (CMP-001 ou nome)..."
          className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary/60"
        />
      </div>
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
  );
}
