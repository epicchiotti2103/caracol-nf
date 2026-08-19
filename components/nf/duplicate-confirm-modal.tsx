"use client";

import { AlertTriangle, Loader2, XCircle } from "lucide-react";
import type { DuplicateDetail } from "@/lib/api-error";
import {
  OverlapList,
  describeConflict
} from "@/components/nf/duplicidade-panel";
import type { DuplicateOverlap } from "@/types";

interface Props {
  detail: DuplicateDetail;
  moeda?: "BRL" | "USD";
  loading?: boolean;
  onCancel: () => void;
  /** So chamado nas variantes de AVISO (reenvia com confirm_duplicate=true). */
  onConfirm: () => void;
}

/**
 * Modal dos 409 estruturados de duplicidade.
 *
 * - `duplicate_number`: BLOQUEIO DURO. Sem botao de forcar — o usuario tem que
 *   corrigir o numero da nota.
 * - `duplicate_warning`: aviso no cadastro -> "Cadastrar mesmo assim".
 * - `duplicate_payment_warning`: aviso no PAGAMENTO -> passo irreversivel,
 *   texto explicito + "Pagar mesmo assim". Aqui o overlap tem DUAS origens:
 *   item com `no_lote: true` = conflito entre as NFs do PROPRIO lote (nenhuma
 *   paga ainda); item sem a flag = conflito com NF JA PAGA. A copy separa os
 *   dois — o gate e o mesmo, mas dizer "ja tem NF paga" quando nada foi pago
 *   engana o usuario.
 */
export function DuplicateConfirmModal({
  detail,
  moeda = "BRL",
  loading = false,
  onCancel,
  onConfirm
}: Props) {
  const isBlock = detail.code === "duplicate_number";
  const isPayment = detail.code === "duplicate_payment_warning";
  const overlaps: DuplicateOverlap[] = Array.isArray(detail.overlaps)
    ? detail.overlaps
    : [];

  // Overlap com NF JA PAGA vs overlap entre as NFs do proprio lote.
  const pagas = overlaps.filter((o) => !o.no_lote);
  const doLote = overlaps.filter((o) => o.no_lote);
  const soLote = isPayment && doLote.length > 0 && pagas.length === 0;

  const title = isBlock
    ? "Numero de NF ja cadastrado"
    : soLote
      ? "Atencao: NFs deste lote cobrem o mesmo mes"
      : isPayment
        ? "Atencao: possivel pagamento em duplicidade"
        : "Atencao: possivel NF duplicada";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-start gap-3 border-b border-border px-6 py-4">
          {isBlock ? (
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
          )}
          <p className="text-base font-semibold text-foreground">{title}</p>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-6 py-4">
          {isBlock && (
            <>
              <p className="text-sm text-foreground">
                Esse fornecedor ja tem uma NF com esse numero. Nao da pra cadastrar de
                novo — corrija o numero da nota e envie outra vez.
              </p>
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {describeConflict({
                  invoice_id: detail.invoice_id,
                  invoice_number: detail.invoice_number
                })}
              </p>
            </>
          )}

          {!isBlock && !isPayment && (
            <p className="text-sm text-foreground">
              Encontramos indicios de que essa nota ja pode estar cadastrada. Confira
              antes de continuar.
            </p>
          )}

          {isPayment && pagas.length > 0 && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2">
              <p className="text-sm font-medium text-danger">
                Esse fornecedor ja tem NF paga cobrindo a mesma competencia.
              </p>
            </div>
          )}

          {isPayment && doLote.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <p className="text-sm font-medium text-amber-100">
                As NFs deste lote cobrem o mesmo mes do mesmo fornecedor.
              </p>
              <p className="mt-1 text-xs text-amber-100/90">
                Nenhuma esta paga ainda — confira se nao sao a mesma nota duplicada
                antes de pagar.
              </p>
            </div>
          )}

          {isPayment && (
            <p className="text-xs text-danger/90">
              Marcar como paga e um passo IRREVERSIVEL: o dinheiro ja saiu e a NF nao
              volta pra fila. Se isso for pagamento repetido do mesmo mes, cancele e
              confira antes.
            </p>
          )}

          {detail.pdf_conflict && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <p className="text-xs font-medium text-amber-100">
                O mesmo arquivo PDF ja foi cadastrado antes:
              </p>
              <p className="mt-0.5 text-xs text-amber-100/90">
                {describeConflict(detail.pdf_conflict)}
              </p>
            </div>
          )}

          {isPayment ? (
            <>
              {pagas.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted">
                    NFs pagas que cobrem a mesma competencia:
                  </p>
                  <OverlapList overlaps={pagas} moeda={moeda} />
                </div>
              )}
              {doLote.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted">
                    NFs deste lote que cobrem o mesmo mes:
                  </p>
                  <OverlapList overlaps={doLote} moeda={moeda} />
                </div>
              )}
            </>
          ) : (
            overlaps.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted">
                  NFs desse fornecedor que ja cobrem essa competencia:
                </p>
                <OverlapList overlaps={overlaps} moeda={moeda} />
              </div>
            )
          )}

          {!isBlock && overlaps.length === 0 && !detail.pdf_conflict && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              O backend sinalizou duplicidade, mas nao detalhou o conflito. Confira a
              lista de NFs desse fornecedor antes de continuar.
            </p>
          )}
        </div>

        <div className="flex gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-background disabled:opacity-50"
          >
            {isBlock ? "Entendi" : "Cancelar"}
          </button>
          {!isBlock && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50 ${
                isPayment
                  ? "bg-danger text-white hover:opacity-90"
                  : "bg-primary text-black hover:opacity-90"
              }`}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPayment ? "Pagar mesmo assim" : "Cadastrar mesmo assim"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
