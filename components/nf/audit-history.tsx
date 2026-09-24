"use client";

import { useState } from "react";
import { History, Loader2, X } from "lucide-react";
import { apiFetchStrict, ApiHttpError, readableError } from "@/lib/api-error";
import { useAuth } from "@/lib/auth-context";
import { useNfRole } from "@/lib/nf-role-context";
import { fmtDateOnly, fmtDateTime, type Lang } from "@/lib/i18n";

/**
 * Historico de alteracoes (audit_log) de uma NF a pagar ou a receber.
 *
 * Contrato: `GET /audit?entidade=<nf_invoice|nf_receivable>&entidade_id=<uuid>`
 * -> `{items, total, disponivel}` (desc por created_at). `disponivel:false` =
 * tabela ainda nao criada no banco -> "Historico em implantacao".
 *
 * Gating: o backend libera nf_role admin/adm_campanha ou hub admin. O botao so
 * aparece pra esses papeis; se mesmo assim vier 403, o botao some.
 */
export type AuditEntidade = "nf_invoice" | "nf_receivable";

interface AuditItem {
  id: string;
  entidade: string;
  entidade_id: string;
  acao: string;
  campo: string | null;
  valor_antes: unknown;
  valor_depois: unknown;
  user_email: string | null;
  created_at: string;
}

interface AuditResponse {
  items: AuditItem[];
  total: number;
  disponivel: boolean;
}

const ACOES: Record<string, { pt: string; en: string }> = {
  criar: { pt: "Criou", en: "Created" },
  editar: { pt: "Editou", en: "Edited" },
  aprovar: { pt: "Aprovou", en: "Approved" },
  recusar: { pt: "Recusou", en: "Rejected" },
  pagar: { pt: "Pagou", en: "Paid" },
  receber: { pt: "Recebeu", en: "Received" },
  cancelar: { pt: "Cancelou", en: "Cancelled" },
  apagar: { pt: "Apagou", en: "Deleted" }
};

const CAMPOS: Record<string, string> = {
  status: "Status",
  amount: "Valor",
  moeda: "Moeda",
  due_date: "Vencimento",
  issue_date: "Emissao",
  reference_month: "Competencia",
  tag_id: "Tag",
  invoice_number: "Numero",
  supplier_id: "Fornecedor",
  client_id: "Cliente",
  paid_at: "Pago em",
  received_at: "Recebido em",
  paid_conta: "Conta",
  reason: "Motivo",
  slot: "Etapa",
  description: "Descricao",
  notes: "Observacoes",
  caracol_entity: "Entidade"
};

const MONEY_KEY = /amount|valor|total|imposto|custo/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function label(k: string): string {
  return CAMPOS[k] ?? k;
}

function fmtScalar(v: unknown, key: string | null, moeda: string | null, lang: Lang): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? (lang === "pt" ? "sim" : "yes") : lang === "pt" ? "nao" : "no";
  if (key && MONEY_KEY.test(key)) {
    const n = typeof v === "number" ? v : Number(v);
    if (!isNaN(n)) {
      const locale = lang === "en" ? "en-US" : "pt-BR";
      return moeda === "USD" || moeda === "BRL"
        ? n.toLocaleString(locale, { style: "currency", currency: moeda })
        : n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }
  if (typeof v === "string" && DATE_RE.test(v.trim())) return fmtDateOnly(v, lang);
  if (typeof v === "object") {
    const s = JSON.stringify(v);
    return s.length > 80 ? s.slice(0, 77) + "..." : s;
  }
  const s = String(v);
  return s.length > 80 ? s.slice(0, 77) + "..." : s;
}

function fmtValor(v: unknown, campo: string | null, lang: Lang): string {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const obj = v as Record<string, unknown>;
    const moeda = typeof obj.moeda === "string" ? obj.moeda.toUpperCase() : null;
    const parts = Object.entries(obj)
      .filter(([k, val]) => k !== "moeda" || !("amount" in obj) || val == null)
      .map(([k, val]) => `${label(k)}: ${fmtScalar(val, k, moeda, lang)}`);
    return parts.length ? parts.join(" · ") : "—";
  }
  return fmtScalar(v, campo, null, lang);
}

export function AuditHistoryButton({
  entidade,
  entidadeId,
  lang = "pt",
  compact = false
}: {
  entidade: AuditEntidade;
  entidadeId: string;
  lang?: Lang;
  compact?: boolean;
}) {
  const role = useNfRole();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<AuditResponse | null>(null);

  const allowed = role === "admin" || role === "adm_campanha" || user?.hub_role === "admin";
  if (!allowed || hidden) return null;

  const t = {
    btn: lang === "pt" ? "Historico" : "History",
    title: lang === "pt" ? "Historico de alteracoes" : "Change history",
    empty: lang === "pt" ? "Nenhuma alteracao registrada." : "No changes recorded.",
    soon: lang === "pt" ? "Historico em implantacao." : "History coming soon.",
    fail: lang === "pt" ? "Falha ao carregar o historico." : "Failed to load history.",
    by: lang === "pt" ? "por" : "by"
  };

  const load = async () => {
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      const res: AuditResponse = await apiFetchStrict(
        `/audit?entidade=${entidade}&entidade_id=${encodeURIComponent(entidadeId)}`
      );
      setData(res);
    } catch (err) {
      if (err instanceof ApiHttpError && err.status === 403) {
        setOpen(false);
        setHidden(true);
        return;
      }
      setError(readableError(err, t.fail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={load}
        className={
          compact
            ? "inline-flex items-center gap-1 rounded p-1.5 text-muted hover:bg-background hover:text-foreground"
            : "flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
        }
        title={t.title}
      >
        <History className={compact ? "h-3.5 w-3.5" : "h-3.5 w-3.5"} />
        {!compact && t.btn}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border bg-zinc-950 px-6 py-4">
              <p className="text-base font-semibold text-orange-50">{t.title}</p>
              <button onClick={() => setOpen(false)} className="text-orange-100/40 hover:text-orange-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 text-sm whitespace-normal">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : error ? (
                <p className="text-danger">{error}</p>
              ) : !data ? null : !data.disponivel ? (
                <p className="text-muted">{t.soon}</p>
              ) : data.items.length === 0 ? (
                <p className="text-muted">{t.empty}</p>
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-5">
                  {data.items.map((it) => {
                    const acao = ACOES[it.acao]?.[lang] ?? it.acao;
                    return (
                      <li key={it.id} className="relative">
                        <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border border-primary bg-background" />
                        <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                          <span>{fmtDateTime(it.created_at, lang)}</span>
                          <span>
                            {t.by} <span className="text-foreground">{it.user_email || "—"}</span>
                          </span>
                        </div>
                        <p className="mt-0.5 font-medium text-foreground">
                          {acao}
                          {it.campo && <span className="font-normal text-muted"> · {label(it.campo)}</span>}
                        </p>
                        {(it.valor_antes != null || it.valor_depois != null) && (
                          <p className="mt-1 break-words text-xs">
                            <span className="text-muted line-through decoration-muted/50">
                              {fmtValor(it.valor_antes, it.campo, lang)}
                            </span>
                            <span className="mx-1.5 text-muted">→</span>
                            <span className="text-foreground">{fmtValor(it.valor_depois, it.campo, lang)}</span>
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
