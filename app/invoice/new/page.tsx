"use client";

import { useState } from "react";
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

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [refMonth, setRefMonth] = useState(""); // YYYY-MM
  const [campaign, setCampaign] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [warnDate, setWarnDate] = useState("");

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
    refMonth: lang === "pt" ? "Mes de referencia" : "Reference month",
    campaign: lang === "pt" ? "Campanha" : "Campaign",
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
    if (!invoiceNumber.trim()) return labels.invoiceNumber + " — " + labels.required;
    const amt = parseFloat(amount.replace(",", "."));
    if (isNaN(amt) || amt <= 0) return labels.amountGt0;
    if (!dueDate) return labels.dueDate + " — " + labels.required;
    if (!refMonth) return labels.refMonth + " — " + labels.required;
    if (!campaign.trim()) return labels.campaign + " — " + labels.required;
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("invoice_number", invoiceNumber.trim());
      fd.append("amount", String(parseFloat(amount.replace(",", "."))));
      fd.append("due_date", dueDate);
      // refMonth pode chegar como YYYY-MM; backend espera ISO de primeiro dia do mes
      const refIso = refMonth.length === 7 ? `${refMonth}-01` : refMonth;
      fd.append("reference_month", refIso);
      fd.append("campaign", campaign.trim());
      if (pdf) fd.append("pdf", pdf);

      await apiFetch("/nf/invoices", { method: "POST", body: fd });
      toast.success(labels.toastOk);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || (lang === "pt" ? "Falha ao enviar." : "Failed to send."));
    } finally {
      setSubmitting(false);
    }
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
              setRefMonth("");
              setCampaign("");
              setPdf(null);
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

      <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-border bg-surface p-6">
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
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted">
                {lang === "pt" ? "R$" : "BRL"}
              </span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className={inputCls + " pl-12"}
              />
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

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              {labels.refMonth} <span className="text-primary">*</span>
            </label>
            <input
              type="month"
              value={refMonth}
              onChange={(e) => setRefMonth(e.target.value)}
              className={inputCls}
              style={{ colorScheme: "dark" }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              {labels.campaign} <span className="text-primary">*</span>
            </label>
            <input
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              className={inputCls}
              placeholder={lang === "pt" ? "Ex: Campanha XYZ" : "e.g. Campaign XYZ"}
            />
          </div>
        </div>

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
            disabled={submitting}
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
    </div>
  );
}
