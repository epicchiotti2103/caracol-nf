"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Download,
  Loader2,
  User as UserIcon,
  X
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { useNfRole, langForRole } from "@/lib/nf-role-context";
import { useToast } from "@/lib/toast-context";
import { apiFetch } from "@/lib/api";
import { fmtCurrency, fmtDate, fmtDateTime, fmtRefMonth } from "@/lib/i18n";
import type { Invoice, InvoiceStatus, NfUser } from "@/types";

type Action = "approve" | "reject" | "pay";

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <InvoiceDetail id={params.id} />
    </AppShell>
  );
}

function InvoiceDetail({ id }: { id: string }) {
  const role = useNfRole();
  const lang = langForRole(role);
  const router = useRouter();
  const toast = useToast();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectInternalNotes, setRejectInternalNotes] = useState("");
  const [acting, setActing] = useState(false);

  // Painel de notas (admin/adm_campanha podem editar; publisher so ve notes_supplier read-only)
  const [notesSupplier, setNotesSupplier] = useState("");
  const [notesInternal, setNotesInternal] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Reatribuicao de responsavel (admin/adm_campanha)
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<NfUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [savingAssignee, setSavingAssignee] = useState(false);

  const t = {
    back: lang === "pt" ? "Voltar" : "Back",
    invoice: lang === "pt" ? "Nota fiscal" : "Invoice",
    amount: lang === "pt" ? "Valor" : "Amount",
    dueDate: lang === "pt" ? "Vencimento" : "Due date",
    refMonth: lang === "pt" ? "Mes de referencia" : "Reference month",
    campaign: lang === "pt" ? "Campanha" : "Campaign",
    publisher: "Publisher",
    submittedBy: lang === "pt" ? "Cadastrado por" : "Submitted by",
    status: "Status",
    createdAt: lang === "pt" ? "Enviada em" : "Sent at",
    downloadPdf: lang === "pt" ? "Baixar PDF" : "Download PDF",
    approve: lang === "pt" ? "Aprovar" : "Approve",
    reject: lang === "pt" ? "Recusar" : "Reject",
    markPaid: lang === "pt" ? "Marcar como paga" : "Mark as paid",
    rejectionReason: lang === "pt" ? "Motivo da recusa" : "Rejection reason",
    confirmApprove:
      lang === "pt" ? "Confirmar aprovacao?" : "Confirm approval?",
    confirmPay:
      lang === "pt" ? "Confirmar pagamento?" : "Confirm payment?",
    confirmReject:
      lang === "pt" ? "Confirmar recusa" : "Confirm rejection",
    cancel: lang === "pt" ? "Cancelar" : "Cancel",
    confirm: lang === "pt" ? "Confirmar" : "Confirm",
    saving: lang === "pt" ? "Salvando..." : "Saving...",
    approvedBy: lang === "pt" ? "Aprovada por" : "Approved by",
    paidBy: lang === "pt" ? "Paga por" : "Paid by",
    rejectedNotes: lang === "pt" ? "Motivo" : "Notes",
    notFound: lang === "pt" ? "NF nao encontrada." : "Invoice not found.",
    reasonRequired:
      lang === "pt" ? "Informe o motivo da recusa." : "Enter the rejection reason.",
    approvedOk: lang === "pt" ? "NF aprovada" : "Invoice approved",
    rejectedOk: lang === "pt" ? "NF recusada" : "Invoice rejected",
    paidOk: lang === "pt" ? "NF marcada como paga" : "Invoice marked as paid",
    // Painel de notas
    notesSupplierLabel:
      lang === "pt" ? "Notas para o fornecedor" : "Notes from Caracol",
    notesInternalLabel: "Notas internas — nao visiveis ao fornecedor",
    saveNotes: "Salvar notas",
    notesSavedOk: "Notas salvas",
    notesSaveFail: "Falha ao salvar notas",
    noNotesYet: lang === "pt" ? "Sem notas." : "No notes.",
    // Modal de recusa
    rejectReasonSupplier:
      lang === "pt"
        ? "Motivo (visivel ao fornecedor)"
        : "Reason (visible to supplier)",
    rejectInternalNote: "Anotacao interna (opcional)",
    // Responsavel
    responsibleLabel: lang === "pt" ? "Responsavel" : "Reviewer",
    noAssignee: lang === "pt" ? "Sem responsavel" : "Unassigned",
    reassign: lang === "pt" ? "Reatribuir" : "Reassign",
    assign: lang === "pt" ? "Atribuir" : "Assign",
    assignTitle: lang === "pt" ? "Definir responsavel" : "Set reviewer",
    assignNoOne: lang === "pt" ? "— sem responsavel —" : "— unassigned —",
    assignSave: lang === "pt" ? "Salvar" : "Save",
    assignedOk: lang === "pt" ? "Responsavel atualizado" : "Reviewer updated",
    assignedFail:
      lang === "pt" ? "Falha ao atualizar responsavel" : "Failed to update reviewer",
    loadingUsersLabel: lang === "pt" ? "Carregando..." : "Loading..."
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const inv: Invoice = await apiFetch(`/nf/invoices/${id}`);
      setInvoice(inv);
      setNotesSupplier(inv.notes_supplier || "");
      setNotesInternal(inv.notes_internal || "");
    } catch (err: any) {
      setError(err?.message || t.notFound);
    } finally {
      setLoading(false);
    }
  };

  const saveNotes = async () => {
    if (!invoice) return;
    setSavingNotes(true);
    try {
      const body: Record<string, any> = {
        notes_supplier: notesSupplier.trim() || null
      };
      if (role === "admin" || role === "adm_campanha") {
        body.notes_internal = notesInternal.trim() || null;
      }
      const updated: Invoice = await apiFetch(`/nf/invoices/${id}/notes`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      setInvoice(updated);
      setNotesSupplier(updated.notes_supplier || "");
      setNotesInternal(updated.notes_internal || "");
      toast.success(t.notesSavedOk);
    } catch (err: any) {
      toast.error(err?.message || t.notesSaveFail);
    } finally {
      setSavingNotes(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const openAssignModal = async () => {
    setSelectedAssignee(invoice?.assignee_id || "");
    setAssignOpen(true);
    if (assignableUsers.length === 0) {
      setLoadingUsers(true);
      try {
        const res: { items: NfUser[]; total: number } | NfUser[] =
          await apiFetch("/nf/users");
        const items = Array.isArray(res) ? res : res?.items || [];
        // Filtra so admin / adm_campanha (publishers nao revisam)
        setAssignableUsers(
          items.filter(
            (u) => u.nf_role === "admin" || u.nf_role === "adm_campanha"
          )
        );
      } catch (err: any) {
        toast.error(err?.message || t.assignedFail);
      } finally {
        setLoadingUsers(false);
      }
    }
  };

  const saveAssignee = async () => {
    if (!invoice) return;
    setSavingAssignee(true);
    try {
      const updated: Invoice = await apiFetch(
        `/nf/invoices/${id}/assignee`,
        {
          method: "PATCH",
          body: JSON.stringify({ assignee_id: selectedAssignee || null })
        }
      );
      setInvoice(updated);
      toast.success(t.assignedOk);
      setAssignOpen(false);
    } catch (err: any) {
      toast.error(err?.message || t.assignedFail);
    } finally {
      setSavingAssignee(false);
    }
  };

  const downloadPdf = async () => {
    try {
      const res: { url: string } = await apiFetch(`/nf/invoices/${id}/pdf`);
      if (res?.url) window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast.error(err?.message || (lang === "pt" ? "Falha ao gerar link" : "Failed"));
    }
  };

  const executeAction = async () => {
    if (!invoice || !pendingAction) return;
    let newStatus: InvoiceStatus;
    let body: Record<string, any> = {};
    if (pendingAction === "approve") {
      newStatus = "aprovada";
    } else if (pendingAction === "pay") {
      newStatus = "paga";
    } else {
      newStatus = "recusada";
      if (!rejectNotes.trim()) {
        toast.error(t.reasonRequired);
        return;
      }
      body.notes_supplier = rejectNotes.trim();
      if (rejectInternalNotes.trim()) {
        body.notes_internal = rejectInternalNotes.trim();
      }
    }
    body.status = newStatus;
    setActing(true);
    try {
      const updated: Invoice = await apiFetch(`/nf/invoices/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      setInvoice(updated);
      toast.success(
        pendingAction === "approve"
          ? t.approvedOk
          : pendingAction === "pay"
          ? t.paidOk
          : t.rejectedOk
      );
      setPendingAction(null);
      setRejectNotes("");
      setRejectInternalNotes("");
      // Apos PATCH /status, ressincronizar notas locais
      setNotesSupplier(updated.notes_supplier || "");
      setNotesInternal(updated.notes_internal || "");
    } catch (err: any) {
      toast.error(err?.message || (lang === "pt" ? "Falha." : "Failed."));
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-danger" />
        <p className="text-sm text-muted">{error || t.notFound}</p>
        <button
          onClick={() => router.push("/")}
          className="mt-6 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
        >
          {t.back}
        </button>
      </div>
    );
  }

  // Acoes disponiveis por papel
  const canApprove =
    (role === "adm_campanha" || role === "admin") && invoice.status === "em_analise";
  const canReject =
    (role === "adm_campanha" || role === "admin") &&
    (invoice.status === "em_analise" || invoice.status === "aprovada");
  const canPay = role === "admin" && invoice.status === "aprovada";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        onClick={() => router.push("/")}
        className="mb-6 flex items-center gap-1.5 text-sm text-muted transition-opacity hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {t.back}
      </button>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t.invoice}</p>
          <h1 className="text-2xl font-semibold text-foreground">{invoice.invoice_number}</h1>
        </div>
        <StatusBadge status={invoice.status} lang={lang} />
      </div>

      <AssigneeBlock
        invoice={invoice}
        role={role}
        t={t}
        onOpen={openAssignModal}
      />

      <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
        <Row label={t.amount} value={fmtCurrency(invoice.amount || 0, lang)} bold />
        <Row label={t.dueDate} value={fmtDate(invoice.due_date, lang)} />
        <Row label={t.refMonth} value={fmtRefMonth(invoice.reference_month, lang)} />
        <Row label={t.campaign} value={invoice.campaign || "—"} />
        {role !== "publisher" && (
          <Row
            label={t.publisher}
            value={
              invoice.publisher_name
                ? `${invoice.publisher_name}${
                    invoice.publisher_email ? ` (${invoice.publisher_email})` : ""
                  }`
                : invoice.publisher_email || "—"
            }
          />
        )}
        {invoice.submitted_by &&
          invoice.submitted_by !== invoice.publisher_id && (
            <p className="text-xs text-muted">
              {t.submittedBy}:{" "}
              <span className="text-foreground/80">
                {invoice.submitted_by_name || "—"}
              </span>
            </p>
          )}
        <Row label={t.createdAt} value={fmtDateTime(invoice.created_at, lang)} />

        {invoice.pdf_path && (
          <div className="border-t border-border pt-4">
            <button
              onClick={downloadPdf}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              <Download className="h-4 w-4" />
              {t.downloadPdf}
            </button>
          </div>
        )}

        {/* Auditoria de aprovacao/pagamento */}
        {(invoice.approved_by || invoice.paid_by) && (
          <div className="space-y-2 border-t border-border pt-4">
            {invoice.approved_by && (
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" />
                <p className="text-muted">
                  {t.approvedBy}:{" "}
                  <span className="font-medium text-foreground">
                    {invoice.approved_by_name || "—"}
                  </span>{" "}
                  {invoice.approved_at && (
                    <span className="text-xs">— {fmtDateTime(invoice.approved_at, lang)}</span>
                  )}
                </p>
              </div>
            )}
            {invoice.paid_by && (
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                <p className="text-muted">
                  {t.paidBy}:{" "}
                  <span className="font-medium text-foreground">
                    {invoice.paid_by_name || "—"}
                  </span>{" "}
                  {invoice.paid_at && (
                    <span className="text-xs">— {fmtDateTime(invoice.paid_at, lang)}</span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Motivo de recusa (mostra notes_supplier em destaque vermelho) */}
        {invoice.status === "recusada" && invoice.notes_supplier && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-red-300">
              {t.rejectedNotes}
            </p>
            <p className="text-sm text-red-100/80">{invoice.notes_supplier}</p>
          </div>
        )}
      </div>

      {/* Paineis de notas */}
      <NotesPanels
        role={role}
        lang={lang}
        invoice={invoice}
        notesSupplier={notesSupplier}
        notesInternal={notesInternal}
        setNotesSupplier={setNotesSupplier}
        setNotesInternal={setNotesInternal}
        onSave={saveNotes}
        saving={savingNotes}
        t={t}
      />

      {/* Acoes */}
      {(canApprove || canReject || canPay) && (
        <div className="mt-6 flex flex-wrap gap-3">
          {canApprove && (
            <button
              onClick={() => setPendingAction("approve")}
              className="flex items-center gap-2 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25"
            >
              <CheckCircle2 className="h-4 w-4" />
              {t.approve}
            </button>
          )}
          {canPay && (
            <button
              onClick={() => setPendingAction("pay")}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              {t.markPaid}
            </button>
          )}
          {canReject && (
            <button
              onClick={() => setPendingAction("reject")}
              className="flex items-center gap-2 rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/25"
            >
              {t.reject}
            </button>
          )}
        </div>
      )}

      {pendingAction && (
        <ActionModal
          action={pendingAction}
          t={t}
          rejectNotes={rejectNotes}
          setRejectNotes={setRejectNotes}
          rejectInternalNotes={rejectInternalNotes}
          setRejectInternalNotes={setRejectInternalNotes}
          loading={acting}
          onCancel={() => {
            setPendingAction(null);
            setRejectNotes("");
            setRejectInternalNotes("");
          }}
          onConfirm={executeAction}
        />
      )}

      {assignOpen && (
        <AssignModal
          t={t}
          users={assignableUsers}
          loading={loadingUsers}
          saving={savingAssignee}
          selected={selectedAssignee}
          onSelect={setSelectedAssignee}
          onCancel={() => setAssignOpen(false)}
          onConfirm={saveAssignee}
        />
      )}
    </div>
  );
}

function AssigneeBlock({
  invoice,
  role,
  t,
  onOpen
}: {
  invoice: Invoice;
  role: string;
  t: any;
  onOpen: () => void;
}) {
  const canManage = role === "admin" || role === "adm_campanha";

  // Publisher: so ve o nome se houver. Sem botao.
  if (!canManage) {
    if (!invoice.assignee_name) return null;
    return (
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3">
        <UserIcon className="h-4 w-4 text-muted" />
        <p className="text-sm text-muted">
          {t.responsibleLabel}:{" "}
          <span className="font-medium text-foreground">
            {invoice.assignee_name}
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <UserIcon className="h-4 w-4 flex-shrink-0 text-muted" />
        <p className="truncate text-sm text-muted">
          {t.responsibleLabel}:{" "}
          {invoice.assignee_name ? (
            <span className="font-medium text-foreground">
              {invoice.assignee_name}
            </span>
          ) : (
            <span className="italic text-muted">{t.noAssignee}</span>
          )}
        </p>
      </div>
      <button
        onClick={onOpen}
        className="flex-shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-background/60"
      >
        {invoice.assignee_id ? t.reassign : t.assign}
      </button>
    </div>
  );
}

function AssignModal({
  t,
  users,
  loading,
  saving,
  selected,
  onSelect,
  onCancel,
  onConfirm
}: {
  t: any;
  users: NfUser[];
  loading: boolean;
  saving: boolean;
  selected: string;
  onSelect: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-zinc-950 px-6 py-4">
          <p className="text-base font-semibold text-orange-50">{t.assignTitle}</p>
          <button onClick={onCancel} className="text-orange-100/40 hover:text-orange-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <select
              value={selected}
              onChange={(e) => onSelect(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary/60"
            >
              <option value="">{t.assignNoOne}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}{" "}
                  {u.nf_role === "admin" ? "(admin)" : "(adm. campanha)"}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              disabled={saving}
              className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground hover:bg-background"
            >
              {t.cancel}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading || saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.saving}
                </>
              ) : (
                t.assignSave
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotesPanels({
  role,
  lang,
  invoice,
  notesSupplier,
  notesInternal,
  setNotesSupplier,
  setNotesInternal,
  onSave,
  saving,
  t
}: {
  role: string;
  lang: "pt" | "en";
  invoice: Invoice;
  notesSupplier: string;
  notesInternal: string;
  setNotesSupplier: (v: string) => void;
  setNotesInternal: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  t: any;
}) {
  const canEdit = role === "admin" || role === "adm_campanha";

  // Publisher so ve notes_supplier (read-only). Se vazio, esconde painel.
  if (!canEdit) {
    if (!invoice.notes_supplier) return null;
    return (
      <div className="mt-6 rounded-xl border border-border bg-surface p-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          {t.notesSupplierLabel}
        </p>
        <p className="whitespace-pre-wrap text-sm text-foreground">
          {invoice.notes_supplier}
        </p>
      </div>
    );
  }

  // Admin / adm_campanha: 2 paineis editaveis
  const dirty =
    (notesSupplier || "") !== (invoice.notes_supplier || "") ||
    (notesInternal || "") !== (invoice.notes_internal || "");

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-xl border border-border bg-surface p-6">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
          {t.notesSupplierLabel}
        </label>
        <textarea
          value={notesSupplier}
          onChange={(e) => setNotesSupplier(e.target.value)}
          rows={3}
          placeholder={lang === "pt" ? "Visivel ao fornecedor" : ""}
          className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary/60"
        />
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-amber-300">
          {t.notesInternalLabel}
        </label>
        <textarea
          value={notesInternal}
          onChange={(e) => setNotesInternal(e.target.value)}
          rows={3}
          placeholder="So admin / adm_campanha veem"
          className="w-full rounded-lg border border-amber-500/30 bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-amber-400/70"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={saving || !dirty}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.saving}
            </>
          ) : (
            t.saveNotes
          )}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className={`text-right text-sm ${bold ? "font-semibold text-foreground" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function ActionModal({
  action,
  t,
  rejectNotes,
  setRejectNotes,
  rejectInternalNotes,
  setRejectInternalNotes,
  loading,
  onCancel,
  onConfirm
}: {
  action: Action;
  t: any;
  rejectNotes: string;
  setRejectNotes: (v: string) => void;
  rejectInternalNotes: string;
  setRejectInternalNotes: (v: string) => void;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const title =
    action === "approve" ? t.confirmApprove : action === "pay" ? t.confirmPay : t.confirmReject;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-zinc-950 px-6 py-4">
          <p className="text-base font-semibold text-orange-50">{title}</p>
          <button onClick={onCancel} className="text-orange-100/40 hover:text-orange-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          {action === "reject" && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  {t.rejectReasonSupplier} <span className="text-primary">*</span>
                </label>
                <textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary/60"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-amber-300">
                  {t.rejectInternalNote}
                </label>
                <textarea
                  value={rejectInternalNotes}
                  onChange={(e) => setRejectInternalNotes(e.target.value)}
                  rows={2}
                  placeholder="So admin / adm_campanha veem"
                  className="w-full rounded-lg border border-amber-500/30 bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-amber-400/70"
                />
              </div>
            </>
          )}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground hover:bg-background"
            >
              {t.cancel}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading || (action === "reject" && !rejectNotes.trim())}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.saving}
                </>
              ) : (
                t.confirm
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
