"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  FileUp,
  Loader2,
  Upload
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useNfRole, langForRole } from "@/lib/nf-role-context";
import { useToast } from "@/lib/toast-context";
import { apiFetch } from "@/lib/api";
import {
  NfTagCampanhaFields,
  draftsToPayload,
  type CampanhaLinkDraft
} from "@/components/nf/nf-tag-campanha-fields";
import { ConciliacaoPanel } from "@/components/nf/conciliacao-panel";
import {
  CompetenciaFields,
  anchorCompetencia,
  competenciasToPayload,
  validateCompetencias,
  type CompetenciaDraft
} from "@/components/nf/competencia-fields";
import { DuplicidadePanel } from "@/components/nf/duplicidade-panel";
import { DuplicateConfirmModal } from "@/components/nf/duplicate-confirm-modal";
import {
  apiFetchStrict,
  duplicateDetail,
  readableError,
  type DuplicateDetail
} from "@/lib/api-error";
import type { Supplier } from "@/types";

const MAX_PDF_MB = 10;

export default function NewInvoicePage() {
  return (
    <AppShell>
      <NewInvoiceForm />
    </AppShell>
  );
}

function NewInvoiceForm() {
  const role = useNfRole();
  const lang = langForRole(role);
  const router = useRouter();
  const toast = useToast();

  // Admin/adm_campanha escolhem em nome de qual fornecedor cadastrado a NF
  // sera lancada. Usuario comum/linkado nao escolhe — o backend amarra
  // automaticamente no fornecedor associado ao usuario logado.
  const isAdmin = role === "admin" || role === "adm_campanha";

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [moeda, setMoeda] = useState<"BRL" | "USD">("BRL");
  const [dueDate, setDueDate] = useState("");
  // Competencias da NF (>=1 linha). Com 1 linha o valor acompanha o total da NF
  // automaticamente — o fluxo de 1 mes continua sendo so escolher o mes.
  const [competencias, setCompetencias] = useState<CompetenciaDraft[]>([
    { competencia: "", valor: "" }
  ]);
  const [pdf, setPdf] = useState<File | null>(null);

  // Tag (1 por NF) + vinculo de campanhas (N, cada uma com valor).
  const [tagId, setTagId] = useState("");
  const [campanhaLinks, setCampanhaLinks] = useState<CampanhaLinkDraft[]>([]);

  // Fornecedor cadastrado escolhido (so admin/adm_campanha).
  const [supplierId, setSupplierId] = useState("");

  // Carregamento da lista de fornecedores ativos (so quando admin/adm_campanha)
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [suppliersError, setSuppliersError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [warnDate, setWarnDate] = useState("");
  // 409 estruturado devolvido pelo POST (bloqueio de numero ou aviso de duplicata)
  const [dupDetail, setDupDetail] = useState<DuplicateDetail | null>(null);

  const amountNum = parseFloat((amount || "").replace(",", ".")) || 0;

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoadingSuppliers(true);
      setSuppliersError("");
      try {
        const res: { items: Supplier[] } | Supplier[] =
          await apiFetch("/suppliers?active=true");
        const items = Array.isArray(res) ? res : res?.items || [];
        if (cancelled) return;
        setSuppliers(items);
      } catch (err: any) {
        if (cancelled) return;
        setSuppliersError(err?.message || "Falha ao carregar fornecedores.");
      } finally {
        if (!cancelled) setLoadingSuppliers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const labels = {
    title: lang === "pt" ? "Nova nota fiscal" : "New invoice",
    subtitle:
      lang === "pt"
        ? "Preencha os dados da NF emitida para a Caracol."
        : "Fill the data for the invoice issued to Caracol.",
    back: lang === "pt" ? "Voltar" : "Back",
    invoiceNumber: lang === "pt" ? "Numero da NF" : "Invoice number",
    amount: lang === "pt" ? "Valor" : "Amount",
    dueDate: lang === "pt" ? "Vencimento" : "Due date",
    refMonth: lang === "pt" ? "Mes de competencia da NF" : "Invoice competence month",
    refMonthHint:
      lang === "pt"
        ? "Nao limita as campanhas — voce pode vincular campanhas de meses diferentes abaixo."
        : "Does not limit campaigns — you can link campaigns from different months below.",
    moedaLabel: lang === "pt" ? "Moeda" : "Currency",
    pdfFile: lang === "pt" ? "Arquivo PDF" : "PDF file",
    submit: lang === "pt" ? "Enviar NF" : "Send invoice",
    sending: lang === "pt" ? "Enviando..." : "Sending...",
    cancel: lang === "pt" ? "Cancelar" : "Cancel",
    required: lang === "pt" ? "Obrigatorio." : "Required.",
    amountGt0: lang === "pt" ? "Valor deve ser maior que zero." : "Amount must be greater than 0.",
    dueWarn:
      lang === "pt"
        ? "Atencao: vencimento ja passou."
        : "Warning: due date is in the past.",
    pdfTooBig:
      lang === "pt"
        ? `Arquivo muito grande (max ${MAX_PDF_MB}MB).`
        : `File too large (max ${MAX_PDF_MB}MB).`,
    supplierLabel: "Fornecedor",
    supplierPlaceholder: "Selecione um fornecedor",
    supplierLoading: "Carregando fornecedores...",
    supplierRequired: "Selecione um fornecedor.",
    noSuppliers:
      "Nenhum fornecedor cadastrado ainda. Cadastre um fornecedor antes de criar uma NF.",
    goToFornecedores: "Ir para /admin/fornecedores",
    linkedHint:
      lang === "pt"
        ? "A NF sera vinculada automaticamente ao seu cadastro."
        : "The invoice will be linked to your supplier record automatically.",
    successTitle: lang === "pt" ? "NF enviada!" : "Invoice sent!",
    successSub:
      lang === "pt"
        ? "A equipe vai analisar e voce pode acompanhar pelo painel."
        : "The team will review it. You can follow the status on the dashboard.",
    seeList: lang === "pt" ? "Ver lista" : "See list",
    sendAnother: lang === "pt" ? "Enviar outra" : "Send another",
    pdfHint:
      lang === "pt"
        ? `PDF da nota fiscal — max. ${MAX_PDF_MB} MB`
        : `Invoice PDF — max ${MAX_PDF_MB} MB`,
    pdfUpload: lang === "pt" ? "Clique para selecionar" : "Click to select",
    toastOk: lang === "pt" ? "NF enviada" : "Invoice sent"
  };

  const validate = () => {
    if (isAdmin && !supplierId) return labels.supplierRequired;
    if (!invoiceNumber.trim()) return labels.invoiceNumber + " — " + labels.required;
    const amt = parseFloat(amount.replace(",", "."));
    if (isNaN(amt) || amt <= 0) return labels.amountGt0;
    if (!dueDate) return labels.dueDate + " — " + labels.required;
    const compErr = validateCompetencias(competencias, amt, lang, moeda);
    if (compErr) return compErr;
    if (pdf && pdf.size > MAX_PDF_MB * 1024 * 1024) return labels.pdfTooBig;
    return null;
  };

  const handleDueDateChange = (v: string) => {
    setDueDate(v);
    if (v) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const d = new Date(v + "T00:00:00");
      setWarnDate(d < today ? labels.dueWarn : "");
    } else {
      setWarnDate("");
    }
  };

  // FormData montada do zero a cada tentativa (nunca reaproveita a anterior,
  // pra nao duplicar `confirm_duplicate` no reenvio).
  const buildFormData = (confirmDuplicate: boolean): FormData => {
    const fd = new FormData();
    fd.append("invoice_number", invoiceNumber.trim());
    fd.append("amount", String(amountNum));
    fd.append("moeda", moeda);
    fd.append("due_date", dueDate);
    const compPayload = competenciasToPayload(competencias, amountNum);
    // Ancora de compat: menor competencia declarada (backend espera o 1o dia).
    const anchor = anchorCompetencia(competencias);
    if (anchor) fd.append("reference_month", `${anchor}-01`);
    if (compPayload.length > 0) {
      fd.append("competencias_json", JSON.stringify(compPayload));
    }
    // Admin/adm_campanha escolhem o fornecedor. Usuario comum/linkado nao
    // manda supplier_id — o backend amarra na entidade do usuario logado.
    if (isAdmin && supplierId) {
      fd.append("supplier_id", supplierId);
    }
    if (tagId) fd.append("tag_id", tagId);
    const campanhasPayload = draftsToPayload(campanhaLinks);
    if (campanhasPayload.length > 0) {
      fd.append("campanhas_json", JSON.stringify(campanhasPayload));
    }
    if (pdf) fd.append("pdf", pdf);
    if (confirmDuplicate) fd.append("confirm_duplicate", "true");
    return fd;
  };

  const doSubmit = async (confirmDuplicate: boolean) => {
    setSubmitting(true);
    try {
      await apiFetchStrict("/nf/invoices", {
        method: "POST",
        body: buildFormData(confirmDuplicate)
      });
      toast.success(labels.toastOk);
      setDupDetail(null);
      setSuccess(true);
    } catch (err: any) {
      const dup = duplicateDetail(err);
      if (dup) {
        // 409 estruturado: bloqueio (numero repetido) ou aviso (PDF/competencia).
        setDupDetail(dup);
        setError("");
      } else {
        setDupDetail(null);
        setError(
          readableError(err, lang === "pt" ? "Falha ao enviar." : "Failed to send.")
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    await doSubmit(false);
  };

  if (success) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h2 className="mb-2 text-2xl font-semibold text-foreground">{labels.successTitle}</h2>
        <p className="mb-8 text-sm text-muted">{labels.successSub}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => {
              setSuccess(false);
              setInvoiceNumber("");
              setAmount("");
              setDueDate("");
              setCompetencias([{ competencia: "", valor: "" }]);
              setPdf(null);
              setSupplierId("");
              setMoeda("BRL");
              setTagId("");
              setCampanhaLinks([]);
            }}
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
          >
            {labels.sendAnother}
          </button>
          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            {labels.seeList}
          </button>
        </div>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/60";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        onClick={() => router.push("/")}
        className="mb-6 flex items-center gap-1.5 text-sm text-muted transition-opacity hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {labels.back}
      </button>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">{labels.title}</h1>
        <p className="mt-1 text-sm text-muted">{labels.subtitle}</p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {isAdmin &&
        !loadingSuppliers &&
        suppliers.length === 0 &&
        !suppliersError && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
              <div className="flex-1">
                <p className="text-sm text-amber-100">{labels.noSuppliers}</p>
                <Link
                  href="/admin/fornecedores"
                  className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                >
                  {labels.goToFornecedores}
                </Link>
              </div>
            </div>
          </div>
        )}

      <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-border bg-surface p-6">
        {isAdmin ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              {labels.supplierLabel} <span className="text-primary">*</span>
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              disabled={loadingSuppliers || suppliers.length === 0}
              className={inputCls + " disabled:opacity-60"}
            >
              <option value="">
                {loadingSuppliers
                  ? labels.supplierLoading
                  : labels.supplierPlaceholder}
              </option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.tax_id ? `${s.name} (${s.tax_id})` : s.name}
                </option>
              ))}
            </select>
            {suppliersError && (
              <p className="mt-1 text-xs text-danger">{suppliersError}</p>
            )}
          </div>
        ) : (
          <p className="rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-muted">
            {labels.linkedHint}
          </p>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            {labels.invoiceNumber} <span className="text-primary">*</span>
          </label>
          <input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            className={inputCls}
            placeholder="NF-000142"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              {labels.amount} <span className="text-primary">*</span>
            </label>
            <div className="flex gap-2">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className={inputCls + " flex-1"}
              />
              <select
                value={moeda}
                onChange={(e) => setMoeda(e.target.value as "BRL" | "USD")}
                aria-label={labels.moedaLabel}
                className="w-24 flex-shrink-0 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/60"
              >
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              {labels.dueDate} <span className="text-primary">*</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => handleDueDateChange(e.target.value)}
              className={inputCls}
              style={{ colorScheme: "dark" }}
            />
            {warnDate && <p className="mt-1 text-xs text-amber-400">{warnDate}</p>}
          </div>
        </div>

        <CompetenciaFields
          drafts={competencias}
          onChange={setCompetencias}
          totalNf={amountNum}
          moeda={moeda}
          lang={lang}
          inputCls={inputCls}
        />

        <NfTagCampanhaFields
          tagId={tagId}
          onTagChange={setTagId}
          campanhas={campanhaLinks}
          onCampanhasChange={setCampanhaLinks}
          totalNf={parseFloat((amount || "").replace(",", ".")) || undefined}
          moeda={moeda}
          supplierId={isAdmin ? supplierId || undefined : undefined}
        />

        {isAdmin && (
          <ConciliacaoPanel
            supplierId={supplierId}
            moeda={moeda}
            campanhas={campanhaLinks}
          />
        )}

        {/* Informativo: NF/PDF/competencia ja cadastrados pra esse fornecedor.
            So faz sentido pra quem escolhe o fornecedor na tela. */}
        {isAdmin && (
          <DuplicidadePanel
            supplierId={supplierId}
            invoiceNumber={invoiceNumber}
            amount={amountNum}
            competencias={competencias.map((c) => c.competencia)}
            moeda={moeda}
          />
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            {labels.pdfFile}
          </label>
          <label
            htmlFor="pdf"
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-8 transition-colors hover:bg-background ${
              pdf ? "border-primary/50" : "border-border"
            }`}
          >
            {pdf ? (
              <>
                <FileUp className="h-6 w-6 text-primary" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">{pdf.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {(pdf.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background">
                  <Upload className="h-4 w-4 text-muted" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">{labels.pdfUpload}</p>
                  <p className="mt-0.5 text-xs text-muted">{labels.pdfHint}</p>
                </div>
              </>
            )}
            <input
              id="pdf"
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-background"
          >
            {labels.cancel}
          </button>
          <button
            type="submit"
            disabled={submitting || (isAdmin && suppliers.length === 0)}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {labels.sending}
              </>
            ) : (
              labels.submit
            )}
          </button>
        </div>
      </form>

      {dupDetail && (
        <DuplicateConfirmModal
          detail={dupDetail}
          moeda={moeda}
          loading={submitting}
          onCancel={() => setDupDetail(null)}
          onConfirm={() => doSubmit(true)}
        />
      )}
    </div>
  );
}
