"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { fmtCurrency } from "@/lib/i18n";
import type {
  DuplicateCheckResponse,
  DuplicateConflictRef,
  DuplicateOverlap
} from "@/types";

const DEBOUNCE_MS = 500;

export function formatMesRef(s: string | null | undefined): string {
  if (!s) return "";
  const ym = s.length >= 7 ? s.slice(0, 7) : s;
  const [y, m] = ym.split("-");
  if (!y || !m) return s;
  return `${m}/${y}`;
}

function toNumber(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/** Rotulo de uma NF conflitante — defensivo, o shape do backend e frouxo. */
export function describeConflict(c: DuplicateConflictRef | null | undefined): string {
  if (!c) return "";
  const num = c.invoice_number || (c.invoice_id ? String(c.invoice_id).slice(0, 8) : "");
  const parts: string[] = [];
  if (num) parts.push(`NF #${num}`);
  const amount = toNumber(c.amount);
  if (amount != null) parts.push(fmtCurrency(amount, "BRL", "pt"));
  if (c.competencia) parts.push(formatMesRef(c.competencia));
  if (c.status) parts.push(`status ${c.status}`);
  return parts.join(" · ") || "NF ja cadastrada";
}

/** "esse fornecedor ja tem a NF #X cobrindo 05/2026 (R$ 3.000,00, status paga)" */
export function describeOverlap(
  o: DuplicateOverlap,
  moeda: "BRL" | "USD" = "BRL"
): string {
  const num = o.invoice_number || (o.invoice_id ? String(o.invoice_id).slice(0, 8) : "?");
  const mes = formatMesRef(o.competencia);
  const valor = toNumber(o.valor) ?? toNumber(o.amount);
  const extras: string[] = [];
  if (valor != null) extras.push(fmtCurrency(valor, moeda, "pt"));
  if (o.status) extras.push(`status ${o.status}`);
  const suffix = extras.length > 0 ? ` (${extras.join(", ")})` : "";
  // `no_lote` so vem no 409 de pagamento: o conflito e com outra NF do PROPRIO
  // lote, nao com uma nota ja paga.
  const origem = o.no_lote ? " · deste lote" : "";
  return `NF #${num}${mes ? ` cobrindo ${mes}` : ""}${suffix}${origem}`;
}

/** Lista reaproveitada pelo painel e pelos modais de confirmacao. */
export function OverlapList({
  overlaps,
  moeda = "BRL"
}: {
  overlaps: DuplicateOverlap[];
  moeda?: "BRL" | "USD";
}) {
  if (!overlaps || overlaps.length === 0) return null;
  return (
    <ul className="space-y-1">
      {overlaps.map((o, i) => (
        <li
          key={`${o.invoice_id || i}-${o.competencia || i}`}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground"
        >
          {describeOverlap(o, moeda)}
        </li>
      ))}
    </ul>
  );
}

interface Props {
  supplierId: string;
  invoiceNumber: string;
  /** Valor total da NF (numero). Opcional pro backend, mandamos quando houver. */
  amount?: number;
  /** Competencias declaradas em YYYY-MM. */
  competencias: string[];
  moeda?: "BRL" | "USD";
  /** Edicao: ignora a propria NF na checagem. */
  excludeInvoiceId?: string;
}

/**
 * Painel INFORMATIVO anti-duplicidade da NF a pagar.
 *
 * Mesma mecanica do ConciliacaoPanel: debounce 500ms, ignora resposta fora de
 * ordem (reqIdRef) e, se o endpoint falhar/404 (backend ainda nao no ar), o
 * painel simplesmente some — nada de erro vermelho. NUNCA bloqueia submit.
 *
 * Quando esta tudo limpo tambem nao renderiza nada (o painel so aparece pra
 * avisar de conflito).
 */
export function DuplicidadePanel({
  supplierId,
  invoiceNumber,
  amount,
  competencias,
  moeda = "BRL",
  excludeInvoiceId
}: Props) {
  const [data, setData] = useState<DuplicateCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const meses = competencias.filter(Boolean);
  const numero = invoiceNumber.trim();
  const canQuery = Boolean(supplierId) && (Boolean(numero) || meses.length > 0);

  const signature = JSON.stringify({
    supplierId,
    numero,
    amount: amount ?? null,
    meses,
    excludeInvoiceId: excludeInvoiceId || null
  });

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
        const qs = new URLSearchParams();
        qs.set("supplier_id", supplierId);
        if (numero) qs.set("invoice_number", numero);
        if (amount != null && Number.isFinite(amount) && amount > 0) {
          qs.set("amount", String(amount));
        }
        if (meses.length > 0) qs.set("competencias", meses.join(","));
        if (excludeInvoiceId) qs.set("exclude_invoice_id", excludeInvoiceId);
        const res: DuplicateCheckResponse = await apiFetch(
          `/nf/invoices/duplicate-check?${qs.toString()}`
        );
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

  if (!canQuery || unavailable || !data) return null;

  const overlaps = data.overlaps || [];
  const hasSomething =
    Boolean(data.number_conflict) || Boolean(data.pdf_conflict) || overlaps.length > 0;
  if (!hasSomething) return null;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Checagem de duplicidade</p>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
      </div>

      {data.number_conflict && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2">
          <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
          <div className="text-xs text-danger">
            <p className="font-medium">
              Esse numero de NF ja existe pra esse fornecedor — o cadastro vai ser
              bloqueado.
            </p>
            <p className="mt-0.5 opacity-90">{describeConflict(data.number_conflict)}</p>
          </div>
        </div>
      )}

      {data.pdf_conflict && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
          <div className="text-xs text-amber-100">
            <p className="font-medium">Esse mesmo PDF ja foi cadastrado antes.</p>
            <p className="mt-0.5 opacity-90">{describeConflict(data.pdf_conflict)}</p>
          </div>
        </div>
      )}

      {overlaps.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
            <p className="text-xs font-medium text-amber-100">
              Esse fornecedor ja tem NF cobrindo essa competencia:
            </p>
          </div>
          <OverlapList overlaps={overlaps} moeda={moeda} />
        </div>
      )}
    </div>
  );
}
