"use client";

import { useEffect, useState } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  UserCog,
  Wallet
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { InvoiceEvent, InvoiceEventType } from "@/types";

const ICONS: Record<InvoiceEventType, React.ElementType> = {
  status_change: ArrowRightLeft,
  assignee_change: UserCog,
  approval_added: CheckCircle2,
  paid_by_designated: Wallet,
  notes_update: RefreshCw
};

const COLORS: Record<InvoiceEventType, string> = {
  status_change: "text-blue-300",
  assignee_change: "text-amber-300",
  approval_added: "text-emerald-300",
  paid_by_designated: "text-primary",
  notes_update: "text-muted"
};

export function InvoiceEvents({ invoiceId }: { invoiceId: string }) {
  const [events, setEvents] = useState<InvoiceEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res: InvoiceEvent[] | { items: InvoiceEvent[] } = await apiFetch(
        `/nf/invoices/${invoiceId}/events`
      );
      const items = Array.isArray(res) ? res : res?.items || [];
      setEvents(items);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar historico");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  return (
    <div className="mt-6 rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Historico
        </h3>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-background disabled:opacity-50"
          title="Atualizar"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && events === null && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {error && !loading && (
        <p className="text-sm text-danger">{error}</p>
      )}

      {!loading && events && events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-6">
          <Clock className="mb-2 h-6 w-6 text-muted opacity-40" />
          <p className="text-xs text-muted">Sem eventos registrados.</p>
        </div>
      )}

      {events && events.length > 0 && (
        <ol className="relative space-y-3 pl-5">
          <span className="absolute bottom-1 left-[7px] top-1 w-px bg-border" />
          {events.map((ev, i) => {
            const Icon = ICONS[ev.event_type] || Clock;
            const colorClass = COLORS[ev.event_type] || "text-muted";
            return (
              <li key={ev.id || i} className="relative">
                <span
                  className={`absolute -left-5 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-background ${colorClass}`}
                >
                  <Icon className="h-3 w-3" />
                </span>
                <p className="text-sm text-foreground">
                  {describeEvent(ev)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {formatRelative(ev.created_at)}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function describeEvent(ev: InvoiceEvent): string {
  const actorName = ev.actor?.name || "—";
  switch (ev.event_type) {
    case "status_change":
      return `Status mudou de ${humanStatus(ev.from_value)} para ${humanStatus(
        ev.to_value
      )} (${actorName})`;
    case "assignee_change":
      return `${actorName} alterou responsavel: ${ev.from_value || "—"} → ${
        ev.to_value || "—"
      }`;
    case "approval_added":
      return `${actorName} aprovou${
        ev.to_value ? ` (${humanSlot(ev.to_value)})` : ""
      }`;
    case "paid_by_designated":
      return `${actorName} designou pagador: ${ev.to_value || "—"}`;
    case "notes_update":
      return `${actorName} atualizou notas`;
    default:
      return `${actorName} (${ev.event_type})`;
  }
}

function humanStatus(s?: string | null): string {
  switch (s) {
    case "em_analise":
      return "Em analise";
    case "aprovada":
      return "Aprovada";
    case "paga":
      return "Paga";
    case "recusada":
      return "Recusada";
    default:
      return s || "—";
  }
}

function humanSlot(s?: string | null): string {
  if (s === "adm_campanha") return "adm. campanha";
  if (s === "admin") return "admin";
  return s || "—";
}

// Tempo relativo simples em pt-BR (evita dep nova de date-fns).
function formatRelative(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "agora mesmo";
  const min = Math.floor(sec / 60);
  if (min < 60) return `ha ${min} ${min === 1 ? "minuto" : "minutos"}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `ha ${hr} ${hr === 1 ? "hora" : "horas"}`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `ha ${day} ${day === 1 ? "dia" : "dias"}`;
  return d.toLocaleString("pt-BR");
}
