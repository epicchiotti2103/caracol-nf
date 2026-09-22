"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useNfRole } from "@/lib/nf-role-context";
import { useToast } from "@/lib/toast-context";
import { apiFetchStrict, readableError } from "@/lib/api-error";
import {
  fetchLinkSuggestions,
  isRouteMissing,
  previousMonth,
  recentMonthOptions,
  toNum
} from "@/lib/link-suggestions";
import { fmtCurrency, fmtRefMonth } from "@/lib/i18n";
import type {
  LinkSuggestion,
  LinkSuggestionApplyResponse,
  LinkSuggestionMatch,
  NfCompetencia
} from "@/types";

/**
 * Sugestoes de vinculo: NF a pagar SEM campanha vinculada -> campanhas
 * candidatas (backend casa publisher/fornecedor + mes). Nada e vinculado
 * sozinho: o usuario revisa os checkboxes e clica "Vincular".
 *
 * Deep-link: /sugestoes-vinculo?month=YYYY-MM (o Gerencial linka pra ca).
 */
export default function SugestoesVinculoPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        }
      >
        <SugestoesContent />
      </Suspense>
    </AppShell>
  );
}

const MONTH_RE = /^\d{4}-\d{2}$/;

function SugestoesContent() {
  const role = useNfRole();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const isStaff = role === "admin" || role === "adm_campanha";

  // Tela interna — publisher nao tem acesso.
  useEffect(() => {
    if (!isStaff) router.replace("/");
  }, [isStaff, router]);

  const monthParam = searchParams?.get("month") || "";
  const month = MONTH_RE.test(monthParam) ? monthParam : previousMonth();

  const monthOptions = useMemo(() => {
    const opts = recentMonthOptions();
    // Mes vindo da URL fora da janela de 12 meses continua selecionavel.
    if (!opts.some((o) => o.value === month)) {
      opts.push({ value: month, label: fmtRefMonth(month, "pt") });
    }
    return opts;
  }, [month]);

  const [items, setItems] = useState<LinkSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  // invoice_id -> campaign_ids marcados
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const reqIdRef = useRef(0);

  const load = async () => {
    const myReq = ++reqIdRef.current;
    setLoading(true);
    setError("");
    try {
      const res = await fetchLinkSuggestions(month);
      if (myReq !== reqIdRef.current) return;
      if (res.status === "unavailable") {
        setUnavailable(true);
        setItems([]);
        return;
      }
      setUnavailable(false);
      setItems(res.data.suggestions);
      // Default: todas as candidatas marcadas.
      const sel: Record<string, string[]> = {};
      for (const s of res.data.suggestions) {
        sel[s.invoice_id] = (s.candidates || []).map((c) => c.campaign_id);
      }
      setSelected(sel);
    } catch (err) {
      if (myReq !== reqIdRef.current) return;
      setError(readableError(err, "Falha ao carregar sugestoes."));
      setItems([]);
    } finally {
      if (myReq === reqIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (isStaff) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff, month]);

  const setMonth = (m: string) => {
    router.replace(`/sugestoes-vinculo?month=${m}`);
  };

  const toggle = (invoiceId: string, campaignId: string) => {
    setSelected((prev) => {
      const cur = prev[invoiceId] || [];
      const next = cur.includes(campaignId)
        ? cur.filter((id) => id !== campaignId)
        : [...cur, campaignId];
      return { ...prev, [invoiceId]: next };
    });
  };

  const apply = async (s: LinkSuggestion) => {
    const ids = selected[s.invoice_id] || [];
    if (ids.length === 0) return;
    setApplyingId(s.invoice_id);
    try {
      const res: LinkSuggestionApplyResponse = await apiFetchStrict(
        "/nf/link-suggestions/apply",
        {
          method: "POST",
          body: JSON.stringify({ invoice_id: s.invoice_id, campaign_ids: ids })
        }
      );
      const n = res?.linked_campaign_ids?.length ?? ids.length;
      toast.success(
        `NF ${s.number || ""} vinculada a ${n} ${n === 1 ? "campanha" : "campanhas"}`.replace(
          /\s+/g,
          " "
        )
      );
      setItems((prev) => prev.filter((x) => x.invoice_id !== s.invoice_id));
    } catch (err) {
      if (isRouteMissing(err)) {
        toast.error("Vinculo ainda nao disponivel no backend.");
      } else {
        toast.error(readableError(err, "Falha ao vincular."));
      }
    } finally {
      setApplyingId(null);
    }
  };

  if (!isStaff) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
            NF a pagar
          </h4>
          <h1 className="text-2xl font-semibold text-foreground">Sugestoes de vinculo</h1>
          <p className="mt-1 text-sm text-muted">
            NFs sem campanha vinculada e as campanhas candidatas do mes. Revise e clique
            em Vincular. Nada e vinculado automaticamente.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Mes
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 min-w-[160px] rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary/50"
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-border bg-surface p-2 text-muted transition-colors hover:bg-surface/80 disabled:opacity-50"
            title="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : unavailable ? (
        <StateBox
          Icon={Clock}
          title="Recurso ainda nao disponivel"
          text="O backend de sugestoes de vinculo ainda nao foi publicado. Tente de novo mais tarde."
        />
      ) : error ? (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      ) : items.length === 0 ? (
        <StateBox
          Icon={CheckCircle2}
          title="Nenhuma sugestao"
          text={`Nenhuma NF a pagar sem vinculo com campanha candidata em ${fmtRefMonth(month, "pt")}.`}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            <span className="font-semibold text-primary">{items.length}</span>{" "}
            {items.length === 1 ? "NF com sugestao" : "NFs com sugestao"} em{" "}
            {fmtRefMonth(month, "pt")}
          </p>
          <div className="space-y-4">
            {items.map((s) => (
              <SuggestionCard
                key={s.invoice_id}
                s={s}
                selectedIds={selected[s.invoice_id] || []}
                onToggle={(cid) => toggle(s.invoice_id, cid)}
                onApply={() => apply(s)}
                applying={applyingId === s.invoice_id}
                disabled={applyingId !== null && applyingId !== s.invoice_id}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StateBox({ Icon, title, text }: { Icon: any; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface px-6 py-14 text-center">
      <Icon className="mb-3 h-8 w-8 text-muted" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-xs text-muted">{text}</p>
    </div>
  );
}

function moedaOf(c: string | null | undefined): "BRL" | "USD" {
  return (c || "").toUpperCase() === "USD" ? "USD" : "BRL";
}

function competenciaLabel(c: string | NfCompetencia): string {
  if (typeof c === "string") return fmtRefMonth(c, "pt");
  return fmtRefMonth(c?.competencia, "pt");
}

function SuggestionCard({
  s,
  selectedIds,
  onToggle,
  onApply,
  applying,
  disabled
}: {
  s: LinkSuggestion;
  selectedIds: string[];
  onToggle: (campaignId: string) => void;
  onApply: () => void;
  applying: boolean;
  disabled: boolean;
}) {
  const moeda = moedaOf(s.currency);
  const amount = toNum(s.amount);
  const candidates = s.candidates || [];
  const selectedTotal = candidates
    .filter((c) => selectedIds.includes(c.campaign_id))
    .reduce((acc, c) => acc + toNum(c.publisher_amount), 0);
  const diff = selectedTotal - amount;
  const allSelected = selectedIds.length === candidates.length;
  const badge = matchBadge(s.match);
  const competencias = (s.competencias || []).map(competenciaLabel).filter(Boolean);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {s.supplier_name || "Fornecedor sem nome"}
            </p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            NF {s.number || "—"}
            {competencias.length > 0 && <> · competencia {competencias.join(", ")}</>}
            {" · "}
            <Link
              href={`/invoice/${s.invoice_id}`}
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              abrir NF <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Valor da NF
          </p>
          <p className="text-lg font-semibold text-foreground">
            {fmtCurrency(amount, moeda, "pt")}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {candidates.map((c) => {
          const checked = selectedIds.includes(c.campaign_id);
          return (
            <label
              key={c.campaign_id}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors ${
                checked
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-background/40 hover:bg-background/60"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(c.campaign_id)}
                  disabled={applying}
                  className="h-4 w-4 accent-primary"
                />
                <span className="truncate text-sm text-foreground">
                  {c.campaign_name || c.campaign_id.slice(0, 8)}
                  {c.month && (
                    <span className="text-muted"> · {fmtRefMonth(c.month, "pt")}</span>
                  )}
                </span>
              </div>
              <span className="flex-shrink-0 text-sm text-foreground">
                {c.publisher_amount == null
                  ? "—"
                  : fmtCurrency(toNum(c.publisher_amount), moeda, "pt")}
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div className="text-sm text-muted">
          {allSelected ? "Soma das candidatas" : "Soma das marcadas"}:{" "}
          <span className="font-medium text-foreground">
            {fmtCurrency(selectedTotal, moeda, "pt")}
          </span>
          {" vs NF "}
          <span className="font-medium text-foreground">{fmtCurrency(amount, moeda, "pt")}</span>
          {selectedIds.length > 0 && (
            <span
              className={`ml-2 font-semibold ${
                Math.abs(diff) > 0.005 ? "text-amber-300" : "text-emerald-400"
              }`}
            >
              diff {fmtCurrency(diff, moeda, "pt")}
            </span>
          )}
        </div>
        <button
          onClick={onApply}
          disabled={applying || disabled || selectedIds.length === 0}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Vincular {selectedIds.length > 0 && `(${selectedIds.length})`}
        </button>
      </div>
    </div>
  );
}

function matchBadge(m: LinkSuggestionMatch) {
  switch (m) {
    case "exato":
      return { cls: "bg-emerald-500/15 text-emerald-300", label: "exato" };
    case "aproximado":
      return { cls: "bg-amber-500/15 text-amber-300", label: "aproximado" };
    case "divergente":
    default:
      return { cls: "bg-danger/15 text-danger", label: m || "divergente" };
  }
}

