"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Clock,
  FileText,
  HandCoins,
  Loader2,
  RefreshCw,
  Undo2
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { WaveReceiveModal } from "@/components/nf/wave-receive-modal";
import { UndoRecebimentoModal } from "@/components/nf/undo-recebimento-modal";
import { useNfRole } from "@/lib/nf-role-context";
import { useToast } from "@/lib/toast-context";
import { apiFetchStrict, readableError } from "@/lib/api-error";
import { isRouteMissing } from "@/lib/link-suggestions";
import { agingClass, campanhaLabel } from "@/lib/fechamento-recebimentos";
import { fmtCurrency, fmtDateOnly, fmtRefMonth } from "@/lib/i18n";
import { contaLabel } from "@/lib/contas";
import type {
  FechamentoPendencia,
  FechamentoPendenciasResponse,
  FechamentoRecebimento,
  FechamentoRecebimentosListResponse,
  Moeda
} from "@/types";

/**
 * Pagamentos Wave: conta corrente dos fechamentos de parceiro de revenue share
 * (campanha x mes) + registro do deposito que quita N fechamentos de uma vez.
 * Backend: /api/v1/nf/fechamento-recebimentos (migration 082).
 */
export default function PagamentosWavePage() {
  return (
    <AppShell>
      <PagamentosWaveContent />
    </AppShell>
  );
}

const MOEDAS: Moeda[] = ["BRL", "USD"];

function PagamentosWaveContent() {
  const role = useNfRole();
  const router = useRouter();
  const toast = useToast();
  const isStaff = role === "admin" || role === "adm_campanha";

  useEffect(() => {
    if (!isStaff) router.replace("/");
  }, [isStaff, router]);

  const [pend, setPend] = useState<FechamentoPendenciasResponse | null>(null);
  const [lotes, setLotes] = useState<FechamentoRecebimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [clientId, setClientId] = useState<string>("");
  const [filtro, setFiltro] = useState<"pendentes" | "todos">("pendentes");
  const [showModal, setShowModal] = useState(false);
  const [undoLote, setUndoLote] = useState<FechamentoRecebimento | null>(null);
  const reqRef = useRef(0);

  const load = async () => {
    const my = ++reqRef.current;
    setLoading(true);
    setError("");
    try {
      const qs = clientId ? `?client_id=${encodeURIComponent(clientId)}` : "";
      const histQs = `?limit=200${clientId ? `&client_id=${encodeURIComponent(clientId)}` : ""}`;
      const [p, h] = await Promise.all([
        apiFetchStrict(`/nf/fechamento-recebimentos/pendencias${qs}`),
        apiFetchStrict(`/nf/fechamento-recebimentos${histQs}`)
      ]);
      if (my !== reqRef.current) return;
      setUnavailable(false);
      setPend({
        items: Array.isArray(p?.items) ? p.items : [],
        totais: p?.totais || { pendente: {}, recebido: {} }
      });
      setLotes(Array.isArray((h as FechamentoRecebimentosListResponse)?.items) ? h.items : []);
    } catch (err) {
      if (my !== reqRef.current) return;
      if (isRouteMissing(err)) {
        setUnavailable(true);
      } else {
        setError(readableError(err, "Falha ao carregar os fechamentos."));
      }
    } finally {
      if (my === reqRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (isStaff) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff, clientId]);

  const items = pend?.items || [];

  // Clientes parceiros presentes (seletor so aparece com >1).
  const [clientes, setClientes] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (clientId) return; // lista completa so vem sem filtro
    const m = new Map<string, string>();
    for (const i of items) if (i.client_id) m.set(i.client_id, i.client_name || "Cliente");
    setClientes(Array.from(m, ([id, name]) => ({ id, name })));
  }, [items, clientId]);

  const visiveis = useMemo(
    () => (filtro === "pendentes" ? items.filter((i) => i.status === "pendente") : items),
    [items, filtro]
  );

  const grupos = useMemo(() => {
    const m = new Map<string, FechamentoPendencia[]>();
    for (const i of visiveis) {
      const k = (i.mes_referencia || "").slice(0, 7);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(i);
    }
    return Array.from(m.entries());
  }, [visiveis]);

  const nSelecionaveis = items.filter((i) => i.selecionavel).length;

  const openProof = async (l: FechamentoRecebimento) => {
    try {
      const res: { url: string } = await apiFetchStrict(
        `/nf/fechamento-recebimentos/${l.id}/proof`
      );
      if (res?.url) window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(readableError(err, "Falha ao gerar link do comprovante."));
    }
  };

  if (!isStaff) return null;

  const totais = pend?.totais || { pendente: {}, recebido: {} };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
            NF a receber
          </h4>
          <h1 className="text-2xl font-semibold text-foreground">Pagamentos Wave</h1>
          <p className="mt-1 text-sm text-muted">
            Fechamentos de parceiro (campanha x mes) e os depositos que quitam cada um. Sem NF e
            sem pagamento parcial.
          </p>
        </div>
        <div className="flex items-end gap-2">
          {clientes.length > 1 && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Cliente
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="h-9 min-w-[160px] rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary/50"
              >
                <option value="">Todos</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-border bg-surface p-2 text-muted transition-colors hover:bg-surface/80 disabled:opacity-50"
            title="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            disabled={loading || unavailable || nSelecionaveis === 0}
            className="flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <HandCoins className="h-4 w-4" />
            Registrar pagamento
          </button>
        </div>
      </div>

      {loading && !pend ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : unavailable ? (
        <StateBox
          Icon={Clock}
          title="Recurso ainda nao disponivel"
          text="O backend de recebimento de fechamentos ainda nao foi publicado. Tente de novo mais tarde."
        />
      ) : error ? (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      ) : (
        <>
          {/* Totais por moeda */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {MOEDAS.map((m) => (
              <TotalCard key={`p-${m}`} label={`Pendente ${m}`} value={totais.pendente?.[m] || 0} moeda={m} tone="pend" />
            ))}
            {MOEDAS.map((m) => (
              <TotalCard key={`r-${m}`} label={`Recebido ${m}`} value={totais.recebido?.[m] || 0} moeda={m} tone="ok" />
            ))}
          </div>

          {/* Conta corrente */}
          <section className="mb-10">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Conta corrente
              </h2>
              <div className="flex gap-1">
                {(["pendentes", "todos"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFiltro(f)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      filtro === f
                        ? "bg-primary text-black"
                        : "bg-surface text-muted hover:text-foreground"
                    }`}
                  >
                    {f === "pendentes" ? "Pendentes" : "Todos"}
                  </button>
                ))}
              </div>
            </div>

            {grupos.length === 0 ? (
              <StateBox
                Icon={HandCoins}
                title={filtro === "pendentes" ? "Nada pendente" : "Nenhum fechamento"}
                text={
                  filtro === "pendentes"
                    ? "Todos os fechamentos de parceiro estao quitados."
                    : "Nenhum fechamento de parceiro encontrado."
                }
              />
            ) : (
              <div className="space-y-4">
                {grupos.map(([mes, list]) => {
                  const subtot = sumByMoeda(list.filter((i) => i.status === "pendente"));
                  return (
                    <div key={mes} className="overflow-hidden rounded-xl border border-border bg-surface">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2">
                        <p className="text-sm font-semibold text-foreground">
                          {fmtRefMonth(mes, "pt")}
                        </p>
                        <p className="text-xs text-muted">
                          pendente:{" "}
                          {subtot.length === 0
                            ? "—"
                            : subtot.map(([m, v]) => fmtCurrency(v, m, "pt")).join(" + ")}
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <tbody>
                            {list.map((i) => (
                              <PendenciaRow key={i.fechamento_id} i={i} showClient={!clientId && clientes.length > 1} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Historico de lotes */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Historico de pagamentos
            </h2>
            {lotes.length === 0 ? (
              <StateBox
                Icon={FileText}
                title="Nenhum pagamento registrado"
                text="Os depositos registrados aparecem aqui, com as campanhas quitadas."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                      <th className="px-4 py-2 font-semibold">Data</th>
                      <th className="px-4 py-2 font-semibold">Cliente</th>
                      <th className="px-4 py-2 text-right font-semibold">Valor</th>
                      <th className="px-4 py-2 font-semibold">Conta</th>
                      <th className="px-4 py-2 font-semibold">Campanhas quitadas</th>
                      <th className="px-4 py-2 text-right font-semibold">Diferenca</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {lotes.map((l) => (
                      <tr key={l.id} className="border-b border-border/60 align-top last:border-0">
                        <td className="whitespace-nowrap px-4 py-2.5 text-foreground">
                          {fmtDateOnly(l.received_at, "pt")}
                        </td>
                        <td className="px-4 py-2.5 text-muted">{l.client_name || "—"}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-foreground">
                          {fmtCurrency(l.amount, l.moeda, "pt")}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                          {contaLabel(l.moeda, l.conta)}
                        </td>
                        <td className="px-4 py-2.5">
                          <ul className="space-y-0.5 text-xs">
                            {(l.fechamentos || []).map((f) => (
                              <li key={f.fechamento_id} className="text-foreground">
                                {campanhaLabel(f.campanha_codigo, f.campanha_name)}
                                <span className="text-muted">
                                  {" · "}
                                  {fmtRefMonth(f.mes_referencia, "pt")} ·{" "}
                                  {fmtCurrency(f.a_receber, f.moeda, "pt")}
                                </span>
                              </li>
                            ))}
                          </ul>
                          {l.notes && <p className="mt-1 text-[11px] italic text-muted">{l.notes}</p>}
                        </td>
                        <td
                          className={`whitespace-nowrap px-4 py-2.5 text-right font-mono text-xs ${
                            Math.abs(l.diferenca || 0) < 0.005
                              ? "text-emerald-400"
                              : (l.diferenca || 0) < 0
                                ? "text-danger"
                                : "text-amber-300"
                          }`}
                          title={`Esperado ${fmtCurrency(l.esperado, l.moeda, "pt")}`}
                        >
                          {fmtCurrency(l.diferenca, l.moeda, "pt")}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right">
                          <div className="flex justify-end gap-2">
                            {l.has_proof && (
                              <button
                                onClick={() => openProof(l)}
                                className="text-xs text-primary hover:underline"
                              >
                                Comprovante
                              </button>
                            )}
                            <button
                              onClick={() => setUndoLote(l)}
                              className="flex items-center gap-1 text-xs text-muted hover:text-danger"
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                              Desfazer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {showModal && (
        <WaveReceiveModal
          items={items}
          onClose={() => setShowModal(false)}
          onSaved={load}
          onStale={load}
        />
      )}

      {undoLote && (
        <UndoRecebimentoModal
          lote={undoLote}
          onClose={() => setUndoLote(null)}
          onDone={() => {
            setUndoLote(null);
            toast.success("Pagamento desfeito. Fechamentos voltaram a pendente.");
            load();
          }}
        />
      )}
    </div>
  );
}

function sumByMoeda(list: FechamentoPendencia[]): [Moeda, number][] {
  const m = new Map<Moeda, number>();
  for (const i of list) m.set(i.moeda, (m.get(i.moeda) || 0) + (i.a_receber || 0));
  return Array.from(m.entries());
}

function PendenciaRow({ i, showClient }: { i: FechamentoPendencia; showClient: boolean }) {
  const disabled = i.status === "coberto_nf" || (i.status === "pendente" && !i.locked);
  let badge: { cls: string; label: string };
  if (i.status === "recebido") {
    badge = { cls: "bg-emerald-500/15 text-emerald-300", label: "recebido" };
  } else if (i.status === "coberto_nf") {
    badge = { cls: "bg-zinc-700/40 text-zinc-300", label: "coberto por NF" };
  } else if (!i.locked) {
    badge = { cls: "bg-zinc-700/40 text-zinc-300", label: "nao travado" };
  } else {
    badge = { cls: "bg-amber-500/15 text-amber-300", label: "pendente" };
  }

  return (
    <tr className={`border-b border-border/60 last:border-0 ${disabled ? "opacity-50" : ""}`}>
      <td className="px-4 py-2.5">
        <p className="text-foreground">{campanhaLabel(i.campanha_codigo, i.campanha_name)}</p>
        {showClient && <p className="text-xs text-muted">{i.client_name || "—"}</p>}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
          {badge.label}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-xs">
        {i.status === "recebido" && i.recebimento ? (
          <span className="text-muted">
            em {fmtDateOnly(i.recebimento.received_at, "pt")}
            {i.dias_em_aberto != null && ` · ${i.dias_em_aberto}d`}
          </span>
        ) : i.status === "pendente" && i.dias_em_aberto != null ? (
          <span className={agingClass(i.dias_em_aberto)}>{i.dias_em_aberto} dias em aberto</span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-foreground">
        {i.a_receber == null ? "—" : fmtCurrency(i.a_receber, i.moeda, "pt")}
      </td>
    </tr>
  );
}

function TotalCard({
  label,
  value,
  moeda,
  tone
}: {
  label: string;
  value: number;
  moeda: Moeda;
  tone: "pend" | "ok";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`mt-1 font-mono text-lg font-semibold ${
          value === 0 ? "text-muted" : tone === "pend" ? "text-amber-300" : "text-emerald-400"
        }`}
      >
        {fmtCurrency(value, moeda, "pt")}
      </p>
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
