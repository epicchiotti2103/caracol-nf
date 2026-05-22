"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, DollarSign, Flame, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { fmtCurrency } from "@/lib/i18n";
import type { DashboardChipItem } from "@/types";
import { HoverPopover } from "./hover-popover";

type ChipKey = "pending" | "topay" | "overdue";

type ChipDef = {
  key: ChipKey;
  label: string;
  endpoint: string;
  filterHref: string;
  tone: "warning" | "success" | "danger";
  Icon: React.ElementType;
};

const CHIPS: ChipDef[] = [
  {
    key: "pending",
    label: "pendentes",
    endpoint: "/nf/dashboard/pending-approvals",
    filterHref: "/?status=em_analise",
    tone: "warning",
    Icon: AlertTriangle
  },
  {
    key: "topay",
    label: "a pagar",
    endpoint: "/nf/dashboard/to-pay",
    filterHref: "/?status=aprovada",
    tone: "success",
    Icon: DollarSign
  },
  {
    key: "overdue",
    label: "vencidas",
    endpoint: "/nf/dashboard/overdue",
    filterHref: "/?status=em_analise&vencida=1",
    tone: "danger",
    Icon: Flame
  }
];

const TONE_CLASSES: Record<ChipDef["tone"], { chip: string; iconBg: string }> = {
  warning: {
    chip: "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15",
    iconBg: "bg-amber-500/20 text-amber-300"
  },
  success: {
    chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15",
    iconBg: "bg-emerald-500/20 text-emerald-300"
  },
  danger: {
    chip: "border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/15",
    iconBg: "bg-red-500/20 text-red-300"
  }
};

export function DashboardChips({
  counts,
  queryString = ""
}: {
  counts: {
    pending: number;
    topay: number;
    overdue: number;
  };
  // Quando setado, propaga filtros pros endpoints de hover E pro link "ver todas"
  queryString?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {CHIPS.map((c) => (
        <ChipWithHover
          key={c.key}
          def={c}
          count={counts[c.key]}
          queryString={queryString}
        />
      ))}
    </div>
  );
}

function ChipWithHover({
  def,
  count,
  queryString
}: {
  def: ChipDef;
  count: number;
  queryString: string;
}) {
  const [items, setItems] = useState<DashboardChipItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Reseta cache do hover quando filtros mudam (chave = queryString)
  useEffect(() => {
    setItems(null);
    setError("");
  }, [queryString]);

  const ensureLoaded = async () => {
    if (items !== null || loading) return;
    setLoading(true);
    setError("");
    try {
      const url = queryString ? `${def.endpoint}?${queryString}` : def.endpoint;
      const res: DashboardChipItem[] | { items: DashboardChipItem[] } = await apiFetch(url);
      const list = Array.isArray(res) ? res : res?.items || [];
      setItems(list);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Append "ver todas" link mantendo filtros ativos
  const filterHref = (() => {
    const base = def.filterHref;
    if (!queryString) return base;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}${queryString}`;
  })();

  const tone = TONE_CLASSES[def.tone];
  const Icon = def.Icon;

  return (
    <div onMouseEnter={ensureLoaded} onTouchStart={ensureLoaded}>
      <HoverPopover
        align="start"
        width={360}
        trigger={
          <span
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${tone.chip}`}
          >
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${tone.iconBg}`}
            >
              <Icon className="h-3 w-3" />
            </span>
            <span className="font-bold">{count}</span>
            <span className="font-medium">{def.label}</span>
          </span>
        }
      >
        <ChipContent
          def={def}
          loading={loading}
          error={error}
          items={items}
          filterHref={filterHref}
        />
      </HoverPopover>
    </div>
  );
}

function ChipContent({
  def,
  loading,
  error,
  items,
  filterHref
}: {
  def: ChipDef;
  loading: boolean;
  error: string;
  items: DashboardChipItem[] | null;
  filterHref: string;
}) {
  if (loading || items === null) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }
  if (error) {
    return <p className="px-2 py-3 text-xs text-danger">{error}</p>;
  }
  if (items.length === 0) {
    return (
      <p className="px-2 py-3 text-xs text-muted">Nenhuma NF nesta lista.</p>
    );
  }

  return (
    <div className="space-y-1">
      <div className="border-b border-border px-2 py-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          {def.key === "pending"
            ? "Pendentes de aprovacao"
            : def.key === "topay"
            ? "Aprovadas (a pagar)"
            : "Vencidas"}
        </p>
      </div>
      <ul className="divide-y divide-border/60">
        {items.slice(0, 5).map((it) => (
          <li key={it.invoice_id}>
            <Link
              href={`/invoice/${it.invoice_id}`}
              className="block rounded-md px-2 py-2 text-xs transition-colors hover:bg-background"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-foreground">
                  NF {it.invoice_number ? `#${it.invoice_number}` : "—"}
                </span>
                <span className="text-foreground/80">
                  {fmtCurrency(it.valor || 0, it.moeda || "BRL", "pt")}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-muted">
                {it.fornecedor || "—"}
              </p>
              {def.key === "pending" && it.aguarda && it.aguarda.length > 0 && (
                <p className="mt-0.5 text-[11px] text-amber-300">
                  aguarda: {it.aguarda.join(", ")}
                </p>
              )}
              {def.key === "topay" && (
                <p className="mt-0.5 text-[11px] text-emerald-300">
                  pagador: {it.pagador || "sem designado"}
                </p>
              )}
              {def.key === "overdue" && it.dias_atraso != null && (
                <p className="mt-0.5 text-[11px] text-red-300">
                  vencida ha {it.dias_atraso}{" "}
                  {it.dias_atraso === 1 ? "dia" : "dias"}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <div className="border-t border-border px-2 pt-2">
        <Link
          href={filterHref}
          className="block rounded px-2 py-1.5 text-center text-[11px] font-semibold text-primary hover:bg-background"
        >
          ver todas
        </Link>
      </div>
    </div>
  );
}
