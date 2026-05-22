"use client";

import * as React from "react";
import { Calendar, X } from "lucide-react";

// Versao simplificada do DateRangePicker do tracker, adaptada pro NF.
// O tracker usa `react-day-picker`; o NF nao tem essa dep no package.json,
// entao aqui usamos 2 `<input type="date">` nativos + presets, mantendo o
// mesmo formato de API (`startDate`/`endDate` em YYYY-MM-DD, `onChange`).

function parseISO(value?: string | null): Date | undefined {
  if (!value || value.length !== 10) return undefined;
  const [y, m, d] = value.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return undefined;
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? undefined : dt;
}

function toISO(date?: Date): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatBR(date?: Date): string {
  if (!date) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type Preset = { label: string; from: Date; to: Date };

function makePresets(): Preset[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenAgo = new Date(today);
  sevenAgo.setDate(sevenAgo.getDate() - 6);
  const thirtyAgo = new Date(today);
  thirtyAgo.setDate(thirtyAgo.getDate() - 29);
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  return [
    { label: "Hoje", from: today, to: today },
    { label: "Ultimos 7 dias", from: sevenAgo, to: today },
    { label: "Ultimos 30 dias", from: thirtyAgo, to: today },
    { label: "Este mes", from: thisMonthStart, to: thisMonthEnd },
    { label: "Mes passado", from: lastMonthStart, to: lastMonthEnd },
    { label: "Proximo mes", from: nextMonthStart, to: nextMonthEnd },
  ];
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  className,
  placeholder = "Selecionar periodo",
}: {
  startDate?: string;
  endDate?: string;
  onChange: (start: string, end: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [draftFrom, setDraftFrom] = React.useState<string>(startDate || "");
  const [draftTo, setDraftTo] = React.useState<string>(endDate || "");

  React.useEffect(() => {
    if (open) {
      setDraftFrom(startDate || "");
      setDraftTo(endDate || "");
    }
  }, [open, startDate, endDate]);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onChange(draftFrom, draftTo);
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onChange(draftFrom, draftTo);
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, draftFrom, draftTo, onChange]);

  const label = React.useMemo(() => {
    const from = formatBR(parseISO(startDate));
    const to = formatBR(parseISO(endDate));
    if (from && to) return `${from} — ${to}`;
    if (from) return `De ${from}`;
    if (to) return `Ate ${to}`;
    return placeholder;
  }, [startDate, endDate, placeholder]);

  const hasRange = Boolean(startDate || endDate);

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full min-w-[220px] items-center gap-2 rounded-lg border border-border bg-background px-3 text-left text-[13px] text-foreground hover:border-primary/50 focus:border-primary/50 focus:outline-none"
        title="Periodo"
      >
        <Calendar className="h-4 w-4 shrink-0 text-muted" />
        <span className={hasRange ? "truncate" : "truncate text-muted"}>{label}</span>
        {hasRange && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setDraftFrom("");
              setDraftTo("");
              onChange("", "");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                setDraftFrom("");
                setDraftTo("");
                onChange("", "");
              }
            }}
            className="ml-auto rounded p-0.5 text-muted hover:bg-surface hover:text-foreground"
            title="Limpar"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 flex rounded-lg border border-border bg-surface p-2 shadow-lg">
          <div className="flex w-36 flex-col gap-1 border-r border-border pr-2">
            <p className="px-2 pb-1 text-[10px] uppercase tracking-wide text-muted">
              Atalhos
            </p>
            {makePresets().map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  const from = toISO(p.from);
                  const to = toISO(p.to);
                  setDraftFrom(from);
                  setDraftTo(to);
                  onChange(from, to);
                  setOpen(false);
                }}
                className="rounded px-2 py-1.5 text-left text-[12px] text-foreground hover:bg-background"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 p-2">
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide text-muted">
                  De
                </label>
                <input
                  type="date"
                  value={draftFrom}
                  onChange={(e) => setDraftFrom(e.target.value)}
                  className="h-9 rounded border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary/50"
                />
              </div>
              <span className="mt-4 text-muted">→</span>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide text-muted">
                  Ate
                </label>
                <input
                  type="date"
                  value={draftTo}
                  onChange={(e) => setDraftTo(e.target.value)}
                  className="h-9 rounded border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
              <button
                type="button"
                onClick={() => {
                  setDraftFrom("");
                  setDraftTo("");
                  onChange("", "");
                  setOpen(false);
                }}
                className="rounded px-2 py-1 text-[12px] text-muted hover:bg-background hover:text-foreground"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(draftFrom, draftTo);
                  setOpen(false);
                }}
                className="rounded bg-primary px-3 py-1 text-[12px] font-medium text-black hover:opacity-90"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
