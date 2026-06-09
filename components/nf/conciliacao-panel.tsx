"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  XCircle
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { fmtCurrency } from "@/lib/i18n";
import { draftsToPayload, type CampanhaLinkDraft } from "@/components/nf/nf-tag-campanha-fields";
import type {
  ConciliacaoCampanha,
  ConciliacaoResponse
} from "@/types";

interface Props {
  supplierId: string;
  moeda: "BRL" | "USD";
  campanhas: CampanhaLinkDraft[];
}

const DEBOUNCE_MS = 500;

function formatMesRef(s: string | null | undefined): string {
  if (!s) return "";
  const ym = s.length >= 7 ? s.slice(0, 7) : s;
  const [y, m] = ym.split("-");
  if (!y || !m) return s;
  return `${m}/${y}`;
}

/**
 * Painel INFORMATIVO de conciliacao da NF a pagar contra o fechamento de
 * campanha. So aparece pra admin/adm_campanha (quem escolhe fornecedor).
 *
 * Dispara POST /nf/conciliacao com debounce de 500ms sempre que fornecedor,
 * moeda ou campanhas/valores mudam — desde que haja fornecedor + ao menos 1
 * campanha com valor > 0.
 *
 * Graceful: se o endpoint falhar/404 (backend ainda nao no ar), o painel
 * simplesmente nao renderiza — nada de erro vermelho. NUNCA bloqueia submit.
 */
export function ConciliacaoPanel({ supplierId, moeda, campanhas }: Props) {
  const [data, setData] = useState<ConciliacaoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  // Quando o backend nao responde (404/erro/rede), suprime o painel inteiro.
  const [unavailable, setUnavailable] = useState(false);

  // Payload de campanhas com valor > 0 (so essas valem conciliacao).
  const payload = draftsToPayload(campanhas).filter((c) => c.valor > 0);
  const canQuery = Boolean(supplierId) && payload.length > 0;

  // Assinatura estavel pra disparar o efeito so quando algo relevante muda.
  const signature = JSON.stringify({ supplierId, moeda, payload });

  // Guarda o ultimo request pra ignorar respostas fora de ordem.
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!canQuery) {
      setData(null);
      setLoading(false);
      return;
    }
    const myReq = ++reqIdRef.current;
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res: ConciliacaoResponse = await apiFetch("/nf/conciliacao", {
          method: "POST",
          body: JSON.stringify({
            supplier_id: supplierId,
            moeda,
            campanhas: payload
          })
        });
        if (cancelled || myReq !== reqIdRef.current) return;
        setData(res);
        setUnavailable(false);
      } catch {
        if (cancelled || myReq !== reqIdRef.current) return;
        // Backend fora do ar ou erro: degrada silenciosamente.
        setData(null);
        setUnavailable(true);
      } finally {
        if (!cancelled && myReq === reqIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, canQuery]);

  if (!canQuery || unavailable) return null;
  if (!data && !loading) return null;

  return (
    <div className="rounded-lg border border-border bg-background/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          Conciliacao com o fechamento
        </p>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
      </div>

      {data && <ConciliacaoBody data={data} moeda={moeda} />}
    </div>
  );
}

function ConciliacaoBody({
  data,
  moeda
}: {
  data: ConciliacaoResponse;
  moeda: "BRL" | "USD";
}) {
  const header = headerFor(data.status_geral);

  // Aviso de divergencia de moeda: alguma campanha com moeda_fechamento != moeda NF.
  const moedaMismatch = data.por_campanha.some(
    (c) =>
      c.moeda_fechamento &&
      c.moeda_fechamento.toUpperCase() !== moeda.toUpperCase()
  );

  return (
    <div className="space-y-3">
      {/* Cabecalho de status geral */}
      <div
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${header.box}`}
      >
        <header.Icon className={`h-4 w-4 flex-shrink-0 ${header.icon}`} />
        <span className={`text-sm font-medium ${header.text}`}>
          {header.label}
        </span>
      </div>

      {moedaMismatch && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-amber-300" />
          <span className="text-xs text-amber-100">
            A moeda do fechamento difere da moeda desta NF.
          </span>
        </div>
      )}

      {/* Linhas por campanha */}
      <div className="space-y-2">
        {data.por_campanha.map((c) => (
          <CampanhaRow key={c.campanha_id} c={c} moeda={moeda} />
        ))}
      </div>

      {/* Totais */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
        <span className="text-muted">
          Total informado: {fmtCurrency(data.total_informado, moeda, "pt")}
          {" · "}
          esperado: {fmtCurrency(data.total_esperado, moeda, "pt")}
        </span>
        <span
          className={`font-semibold ${
            Math.abs(data.diff_total ?? 0) > 0.005 ? "text-danger" : "text-emerald-400"
          }`}
        >
          diff: {fmtCurrency(data.diff_total, moeda, "pt")}
        </span>
      </div>
    </div>
  );
}

function CampanhaRow({
  c,
  moeda
}: {
  c: ConciliacaoCampanha;
  moeda: "BRL" | "USD";
}) {
  const badge = badgeFor(c.status);
  const titleParts = [c.codigo, c.name].filter(Boolean);
  const mes = formatMesRef(c.mes_referencia);
  const rowMoeda = (c.moeda_fechamento as "BRL" | "USD") || moeda;

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">
          {titleParts.join(" — ") || c.campanha_id.slice(0, 8)}
          {mes && <span className="text-muted"> · {mes}</span>}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          informado: {fmtCurrency(c.valor_informado, moeda, "pt")}
          {" · "}
          esperado: {fmtCurrency(c.valor_esperado, rowMoeda, "pt")}
          {c.diff != null && Math.abs(c.diff) > 0.005 && (
            <span className="text-danger">
              {" · "}diff: {fmtCurrency(c.diff, moeda, "pt")}
            </span>
          )}
        </p>
      </div>
      <span
        className={`mt-0.5 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}
      >
        {badge.label}
      </span>
    </div>
  );
}

function headerFor(status: ConciliacaoResponse["status_geral"]) {
  switch (status) {
    case "ok":
      return {
        Icon: CheckCircle2,
        box: "border-emerald-500/30 bg-emerald-500/10",
        icon: "text-emerald-400",
        text: "text-emerald-100",
        label: "Bate com o fechamento"
      };
    case "incompleto":
      return {
        Icon: AlertTriangle,
        box: "border-amber-500/30 bg-amber-500/10",
        icon: "text-amber-300",
        text: "text-amber-100",
        label: "Conciliacao incompleta"
      };
    case "divergente":
    default:
      return {
        Icon: XCircle,
        box: "border-danger/30 bg-danger/10",
        icon: "text-danger",
        text: "text-danger",
        label: "Divergencia com o fechamento"
      };
  }
}

function badgeFor(status: ConciliacaoCampanha["status"]) {
  switch (status) {
    case "ok":
      return { cls: "bg-emerald-500/15 text-emerald-300", label: "ok" };
    case "divergente":
      return { cls: "bg-danger/15 text-danger", label: "divergente" };
    case "sem_fechamento":
      return { cls: "bg-zinc-700/40 text-zinc-300", label: "sem fechamento" };
    case "publisher_nao_encontrado":
    default:
      return {
        cls: "bg-zinc-700/40 text-zinc-300",
        label: "publisher nao encontrado"
      };
  }
}
