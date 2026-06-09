"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Download,
  Loader2,
  Pencil,
  User as UserIcon,
  Wallet,
  X
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { ApprovalBadge, OverdueBadge } from "@/components/nf/approval-badge";
import { InvoiceEvents } from "@/components/nf/invoice-events";
import { InvoiceEditModal } from "@/components/nf/invoice-edit-modal";
import { useAuth } from "@/lib/auth-context";
import { useNfRole, useCan, langForRole } from "@/lib/nf-role-context";
import { useToast } from "@/lib/toast-context";
import { apiFetch } from "@/lib/api";
import { fmtCurrency, fmtDate, fmtDateTime, fmtRefMonth } from "@/lib/i18n";
import type { Invoice, NfCampanhaLink, NfUser, Supplier } from "@/types";

type Action = "approve_adm" | "approve_admin" | "reject" | "pay";

const PROOF_MAX_MB = 10;
const PROOF_ACCEPT = "image/png,image/jpeg,application/pdf";
const PROOF_MIMES = new Set(["image/png", "image/jpeg", "application/pdf"]);

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <InvoiceDetail id={params.id} />
    </AppShell>
  );
}

function InvoiceDetail({ id }: { id: string }) {
  const role = useNfRole();
  const can = useCan();
  const lang = langForRole(role);
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectInternalNotes, setRejectInternalNotes] = useState("");
  const [paidByAssigneeId, setPaidByAssigneeId] = useState<string>("");
  const [acting, setActing] = useState(false);
  // Upload do comprovante de pagamento (modal "Marcar como paga")
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofError, setProofError] = useState("");
  // Bump usado pra refrescar a timeline apos acoes
  const [eventsRefreshKey, setEventsRefreshKey] = useState(0);
  // Lote de pagamento (quais NFs dividem o mesmo comprovante)
  const [batchSiblings, setBatchSiblings] = useState<Invoice[] | null>(null);

  useEffect(() => {
    const bid = invoice?.batch_payment_id;
    if (!bid) {
      setBatchSiblings(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const res: { invoices?: Invoice[] } = await apiFetch(`/nf/payment-batches/${bid}`);
        if (active) setBatchSiblings(res.invoices ?? null);
      } catch {
        if (active) setBatchSiblings(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [invoice?.batch_payment_id]);

  // Painel de notas
  const [notesSupplier, setNotesSupplier] = useState("");
  const [notesInternal, setNotesInternal] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Modal de edicao da NF (admin/adm_campanha em em_analise)
  const [editOpen, setEditOpen] = useState(false);

  // Dados de pagamento do fornecedor vinculado (HelmBank) — read-only, so admin.
  // Backend pode nao ter os campos pay_* ainda; tratamos graceful.
  const [supplierPay, setSupplierPay] = useState<Supplier | null>(null);

  // Reatribuicao de responsavel
  const [assignOpen, setAssignOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState<NfUser[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<NfUser[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
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
    publisher: lang === "pt" ? "Fornecedor" : "Supplier",
    submittedBy: lang === "pt" ? "Cadastrado por" : "Submitted by",
    createdAt: lang === "pt" ? "Enviada em" : "Sent at",
    downloadPdf: lang === "pt" ? "Baixar PDF" : "Download PDF",
    downloadProof:
      lang === "pt" ? "Baixar comprovante" : "Download proof",
    proofLabel:
      lang === "pt"
        ? "Anexe o comprovante de pagamento (PNG, JPEG ou PDF, max 10MB)"
        : "Attach the payment proof (PNG, JPEG or PDF, max 10MB)",
    proofFileLabel:
      lang === "pt" ? "Comprovante" : "Proof",
    proofRequired:
      lang === "pt" ? "Anexe o comprovante." : "Attach the proof.",
    proofTooBig:
      lang === "pt"
        ? `Arquivo muito grande (max ${PROOF_MAX_MB}MB).`
        : `File too large (max ${PROOF_MAX_MB}MB).`,
    proofWrongType:
      lang === "pt"
        ? "Tipo invalido. Use PNG, JPEG ou PDF."
        : "Invalid type. Use PNG, JPEG or PDF.",
    proofConfirm:
      lang === "pt" ? "Confirmar pagamento" : "Confirm payment",
    payTitle: lang === "pt" ? "Marcar NF" : "Mark invoice",
    asPaid: lang === "pt" ? "como paga" : "as paid",
    approveAdm: "Aprovar (adm campanha)",
    approveAdmin: "Aprovar (admin)",
    youApproved: "Voce aprovou — aguardando admin",
    youApprovedAdmin: "Voce aprovou — aguardando adm. campanha",
    reject: lang === "pt" ? "Recusar" : "Reject",
    markPaid: lang === "pt" ? "Marcar como paga" : "Mark as paid",
    rejectionReason: lang === "pt" ? "Motivo da recusa" : "Rejection reason",
    confirmApproveSingle: "Confirmar aprovacao?",
    confirmApproveDouble: "Aprovar NF",
    completesFlow:
      "Esta aprovacao completa o fluxo. NF passa para 'aprovada' e fica a pagar.",
    designatePayer: "Designar pagador (opcional)",
    designatePayerHint:
      "Se deixar vazio, qualquer admin pode marcar como paga.",
    designateNobody: "— qualquer admin —",
    confirmApproval: "Confirmar aprovacao",
    confirmPay:
      lang === "pt" ? "Confirmar pagamento?" : "Confirm payment?",
    confirmReject:
      lang === "pt" ? "Confirmar recusa" : "Confirm rejection",
    cancel: lang === "pt" ? "Cancelar" : "Cancel",
    confirm: lang === "pt" ? "Confirmar" : "Confirm",
    saving: lang === "pt" ? "Salvando..." : "Saving...",
    approvedAdmBy: "Aprovado (adm. campanha) por",
    approvedAdminBy: "Aprovado (admin) por",
    paidBy: lang === "pt" ? "Paga por" : "Paid by",
    designatedPayer: "Pagador designado",
    rejectedNotes: lang === "pt" ? "Motivo" : "Notes",
    notFound: lang === "pt" ? "NF nao encontrada." : "Invoice not found.",
    reasonRequired:
      lang === "pt" ? "Informe o motivo da recusa." : "Enter the rejection reason.",
    approvedOk: lang === "pt" ? "Aprovacao registrada" : "Approval recorded",
    rejectedOk: lang === "pt" ? "NF recusada" : "Invoice rejected",
    paidOk: lang === "pt" ? "NF marcada como paga" : "Invoice marked as paid",
    notesSupplierLabel:
      lang === "pt" ? "Notas para o fornecedor" : "Notes from Caracol",
    notesInternalLabel: "Notas internas — nao visiveis ao fornecedor",
    saveNotes: "Salvar notas",
    notesSavedOk: "Notas salvas",
    notesSaveFail: "Falha ao salvar notas",
    rejectReasonSupplier:
      lang === "pt"
        ? "Motivo (visivel ao fornecedor)"
        : "Reason (visible to supplier)",
    rejectInternalNote: "Anotacao interna (opcional)",
    responsibleLabel: lang === "pt" ? "Responsavel" : "Reviewer",
    noAssignee: lang === "pt" ? "Sem responsavel" : "Unassigned",
    reassign: lang === "pt" ? "Reatribuir" : "Reassign",
    assign: lang === "pt" ? "Atribuir" : "Assign",
    assignTitle: lang === "pt" ? "Definir responsavel" : "Set reviewer",
    assignNoOne: lang === "pt" ? "— sem responsavel —" : "— unassigned —",
    assignSave: lang === "pt" ? "Salvar" : "Save",
    assignedOk: lang === "pt" ? "Responsavel atualizado" : "Reviewer updated",
    assignedFail:
      lang === "pt" ? "Falha ao atualizar responsavel" : "Failed to update reviewer"
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

  const refreshInvoice = async () => {
    try {
      const inv: Invoice = await apiFetch(`/nf/invoices/${id}`);
      setInvoice(inv);
      setNotesSupplier(inv.notes_supplier || "");
      setNotesInternal(inv.notes_internal || "");
    } catch {
      // silencioso
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Busca dados de pagamento do fornecedor (so admin/adm_campanha; so se a NF
  // estiver vinculada a um supplier_id). Falha silenciosa — bloco e opcional.
  useEffect(() => {
    const sid = invoice?.supplier_id;
    if (!sid || (role !== "admin" && role !== "adm_campanha")) {
      setSupplierPay(null);
      return;
    }
    let cancelled = false;
    apiFetch(`/suppliers/${sid}`)
      .then((s: Supplier) => {
        if (!cancelled) setSupplierPay(s);
      })
      .catch(() => {
        if (!cancelled) setSupplierPay(null);
      });
    return () => {
      cancelled = true;
    };
  }, [invoice?.supplier_id, role]);

  const loadUsers = async () => {
    if (usersLoaded || loadingUsers) return;
    setLoadingUsers(true);
    try {
      const res: { items: NfUser[]; total: number } | NfUser[] =
        await apiFetch("/nf/users");
      const items = Array.isArray(res) ? res : res?.items || [];
      setAssignableUsers(
        items.filter((u) => u.nf_role === "admin" || u.nf_role === "adm_campanha")
      );
      setAdminUsers(items.filter((u) => u.nf_role === "admin"));
      setUsersLoaded(true);
    } catch (err: any) {
      toast.error(err?.message || t.assignedFail);
    } finally {
      setLoadingUsers(false);
    }
  };

  const openAssignModal = async () => {
    setSelectedAssignee(invoice?.assignee_id || "");
    setAssignOpen(true);
    await loadUsers();
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
      setEventsRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err?.message || t.assignedFail);
    } finally {
      setSavingAssignee(false);
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
      setEventsRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err?.message || t.notesSaveFail);
    } finally {
      setSavingNotes(false);
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

  const downloadProof = async () => {
    try {
      const res: { url: string } = await apiFetch(`/nf/invoices/${id}/proof`);
      if (res?.url) window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast.error(err?.message || (lang === "pt" ? "Falha ao gerar link" : "Failed"));
    }
  };

  // Derivacoes
  // Considera "ja aprovou" se qualquer um dos campos vier do backend (_at OU _by).
  // Algumas respostas (POST /approve) podem nao popular ambos imediatamente.
  const admApproved =
    !!invoice?.approved_by_adm_campanha_at || !!invoice?.approved_by_adm_campanha_id;
  const adminApproved =
    !!invoice?.approved_by_admin_at || !!invoice?.approved_by_admin_id;
  const isEmAnalise = invoice?.status === "em_analise";
  const isAprovada = invoice?.status === "aprovada";

  // Quem ja aprovou (consulta papel do user atual)
  const youApprovedAsAdm =
    !!user?.id &&
    !!invoice?.approved_by_adm_campanha_id &&
    invoice.approved_by_adm_campanha_id === user.id;
  const youApprovedAsAdmin =
    !!user?.id &&
    !!invoice?.approved_by_admin_id &&
    invoice.approved_by_admin_id === user.id;

  // So mostra botao "Aprovar" se: status em_analise + meu papel + EU ainda nao aprovei.
  // (Bug 1: antes checava so `!admApproved`, mas mesmo com `_at` setado a UI
  // permanecia mostrando o botao em alguns casos. Agora dupla-checa por `youApproved`.)
  // Permissao de decisao (aprovar/recusar) agora e dinamica via RBAC: a key
  // `nf.notas.approve` (toggle em /admin/papeis) controla quem ve as acoes.
  // O papel ainda define QUAL slot da dupla aprovacao e preenchido
  // (adm_campanha -> slot adm; admin -> slot admin), mas a liberacao da acao
  // em si passa por `can("nf.notas.approve")`.
  const canDecide = can("nf.notas.approve");
  const canApproveAsAdm =
    canDecide &&
    role === "adm_campanha" &&
    isEmAnalise &&
    !admApproved &&
    !youApprovedAsAdm;
  const canApproveAsAdmin =
    canDecide &&
    role === "admin" &&
    isEmAnalise &&
    !adminApproved &&
    !youApprovedAsAdmin;
  const canReject = canDecide && isEmAnalise;
  const canPay = role === "admin" && isAprovada;

  // Admin completando a dupla = ele aprova quando adm_campanha ja aprovou.
  const adminCompletingFlow =
    role === "admin" && isEmAnalise && admApproved && !adminApproved;

  // Pre-carrega admins ao abrir modal de aprovacao do admin (pra dropdown de pagador)
  useEffect(() => {
    if (pendingAction === "approve_admin" && adminCompletingFlow) {
      loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAction, adminCompletingFlow]);

  const executeAction = async () => {
    if (!invoice || !pendingAction) return;
    setActing(true);
    try {
      let updated: Invoice;
      let successMsg: string;
      if (pendingAction === "approve_adm" || pendingAction === "approve_admin") {
        const body: Record<string, any> = {};
        // So manda paid_by_assignee_id se for admin completando o fluxo
        if (
          pendingAction === "approve_admin" &&
          adminCompletingFlow &&
          paidByAssigneeId
        ) {
          body.paid_by_assignee_id = paidByAssigneeId;
        }
        updated = await apiFetch(`/nf/invoices/${id}/approve`, {
          method: "POST",
          body: JSON.stringify(body)
        });
        successMsg = t.approvedOk;
      } else if (pendingAction === "pay") {
        if (!proofFile) {
          setProofError(t.proofRequired);
          setActing(false);
          return;
        }
        if (!PROOF_MIMES.has(proofFile.type)) {
          setProofError(t.proofWrongType);
          setActing(false);
          return;
        }
        if (proofFile.size > PROOF_MAX_MB * 1024 * 1024) {
          setProofError(t.proofTooBig);
          setActing(false);
          return;
        }
        const fd = new FormData();
        fd.append("proof", proofFile);
        updated = await apiFetch(`/nf/invoices/${id}/pay`, {
          method: "POST",
          body: fd
        });
        successMsg = t.paidOk;
      } else {
        // reject
        if (!rejectNotes.trim()) {
          toast.error(t.reasonRequired);
          setActing(false);
          return;
        }
        const body: Record<string, any> = { reason: rejectNotes.trim() };
        if (rejectInternalNotes.trim()) {
          body.notes_internal = rejectInternalNotes.trim();
        }
        updated = await apiFetch(`/nf/invoices/${id}/reject`, {
          method: "POST",
          body: JSON.stringify(body)
        });
        successMsg = t.rejectedOk;
      }
      setInvoice(updated);
      setNotesSupplier(updated.notes_supplier || "");
      setNotesInternal(updated.notes_internal || "");
      toast.success(successMsg);
      setPendingAction(null);
      setRejectNotes("");
      setRejectInternalNotes("");
      setPaidByAssigneeId("");
      setProofFile(null);
      setProofError("");
      setEventsRefreshKey((k) => k + 1);
      // Ressincroniza pra pegar campos derivados possivelmente ausentes na resposta direta
      refreshInvoice();
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

  const showAnyAction =
    canApproveAsAdm ||
    canApproveAsAdmin ||
    canReject ||
    canPay ||
    youApprovedAsAdm ||
    youApprovedAsAdmin;

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
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Botao Editar — so admin/adm_campanha + em_analise */}
          {(role === "admin" || role === "adm_campanha") &&
            invoice.status === "em_analise" && (
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                title="Editar dados da NF"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </button>
            )}
          <StatusBadge status={invoice.status} lang={lang} />
          {(invoice.status === "em_analise" ||
            invoice.status === "aprovada" ||
            invoice.status === "paga") && (
            <ApprovalBadge invoice={invoice} />
          )}
          <OverdueBadge invoice={invoice} />
        </div>
      </div>

      <AssigneeBlock
        invoice={invoice}
        role={role}
        t={t}
        onOpen={openAssignModal}
      />

      {/* Acoes */}
      {role !== "publisher" && showAnyAction && (
        <ActionsBar
          invoice={invoice}
          role={role}
          t={t}
          canApproveAsAdm={!!canApproveAsAdm}
          canApproveAsAdmin={!!canApproveAsAdmin}
          canReject={!!canReject}
          canPay={!!canPay}
          youApprovedAsAdm={!!youApprovedAsAdm}
          youApprovedAsAdmin={!!youApprovedAsAdmin}
          onApproveAdm={() => setPendingAction("approve_adm")}
          onApproveAdmin={() => setPendingAction("approve_admin")}
          onReject={() => setPendingAction("reject")}
          onPay={() => setPendingAction("pay")}
        />
      )}

      {/* Pagador designado */}
      {(invoice.paid_by_assignee_id || invoice.paid_by_assignee_name) &&
        invoice.status !== "paga" && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <Wallet className="h-4 w-4 text-primary" />
            <p className="text-sm text-muted">
              {t.designatedPayer}:{" "}
              <span className="font-medium text-foreground">
                {invoice.paid_by_assignee_name || "—"}
              </span>
            </p>
          </div>
        )}

      <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
        <Row
          label={t.amount}
          value={fmtCurrency(invoice.amount || 0, invoice.moeda || "BRL", lang)}
          bold
        />
        <Row label={t.dueDate} value={fmtDate(invoice.due_date, lang)} />
        <Row label={t.refMonth} value={fmtRefMonth(invoice.reference_month, lang)} />
        <Row
          label={t.campaign}
          value={invoice.campaign_name ?? invoice.campaign ?? "—"}
        />
        {invoice.tag_name && <Row label="Tag" value={invoice.tag_name} />}
        {role !== "publisher" && (
          <Row
            label={t.publisher}
            value={
              invoice.supplier_name ||
              invoice.publisher_name ||
              invoice.publisher_email ||
              "—"
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

        {(invoice.pdf_path || invoice.paid_proof_path) && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            {invoice.pdf_path && (
              <button
                onClick={downloadPdf}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
              >
                <Download className="h-4 w-4" />
                {t.downloadPdf}
              </button>
            )}
            {invoice.paid_proof_path && (
              <button
                onClick={downloadProof}
                className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
              >
                <Download className="h-4 w-4" />
                {t.downloadProof}
              </button>
            )}
          </div>
        )}

        {invoice.batch_payment_id && batchSiblings && batchSiblings.length > 1 && (
          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">
              {lang === "pt"
                ? "Pago em lote — mesmo comprovante destas NFs:"
                : "Paid in a batch — same proof for these invoices:"}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {batchSiblings.map((s) => (
                <button
                  key={s.id}
                  onClick={() => s.id !== id && router.push(`/invoice/${s.id}`)}
                  className={`rounded-md border px-2 py-1 text-xs font-mono transition-colors ${
                    s.id === id
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted hover:text-foreground"
                  }`}
                  title={s.supplier_name || undefined}
                >
                  {s.invoice_number}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Auditoria de aprovacao/pagamento */}
        {(invoice.approved_by_adm_campanha_at ||
          invoice.approved_by_admin_at ||
          invoice.paid_at) && (
          <div className="space-y-2 border-t border-border pt-4">
            {invoice.approved_by_adm_campanha_at && (
              <ApprovalLine
                icon={CheckCircle2}
                label={t.approvedAdmBy}
                name={
                  invoice.approved_by_adm_campanha_name || "—"
                }
                at={invoice.approved_by_adm_campanha_at}
                lang={lang}
              />
            )}
            {invoice.approved_by_admin_at && (
              <ApprovalLine
                icon={CheckCircle2}
                label={t.approvedAdminBy}
                name={invoice.approved_by_admin_name || "—"}
                at={invoice.approved_by_admin_at}
                lang={lang}
              />
            )}
            {invoice.paid_at && (
              <ApprovalLine
                icon={Wallet}
                label={t.paidBy}
                name={invoice.paid_by_name || "—"}
                at={invoice.paid_at}
                lang={lang}
                accent="primary"
              />
            )}
          </div>
        )}

        {/* Motivo de recusa */}
        {invoice.status === "recusada" && invoice.notes_supplier && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-red-300">
              {t.rejectedNotes}
            </p>
            <p className="text-sm text-red-100/80">{invoice.notes_supplier}</p>
          </div>
        )}
      </div>

      {/* Campanhas vinculadas (com valor alocado por campanha) */}
      {role !== "publisher" &&
        invoice.campanhas &&
        invoice.campanhas.length > 0 && (
          <CampanhasBlock
            campanhas={invoice.campanhas}
            moeda={invoice.moeda || "BRL"}
            total={Number(invoice.amount || 0)}
            lang={lang}
          />
        )}

      {/* Dados de pagamento do fornecedor (HelmBank) — read-only, so admin/adm */}
      {supplierPay && <SupplierPayBlock supplier={supplierPay} />}

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

      {/* Timeline */}
      <InvoiceEvents invoiceId={id} key={eventsRefreshKey} />

      {pendingAction && (
        <ActionModal
          action={pendingAction}
          adminCompletingFlow={adminCompletingFlow}
          adminUsers={adminUsers}
          paidByAssigneeId={paidByAssigneeId}
          setPaidByAssigneeId={setPaidByAssigneeId}
          loadingUsers={loadingUsers}
          t={t}
          invoiceNumber={invoice.invoice_number}
          rejectNotes={rejectNotes}
          setRejectNotes={setRejectNotes}
          rejectInternalNotes={rejectInternalNotes}
          setRejectInternalNotes={setRejectInternalNotes}
          proofFile={proofFile}
          setProofFile={(f) => {
            setProofError("");
            setProofFile(f);
          }}
          proofError={proofError}
          loading={acting}
          onCancel={() => {
            setPendingAction(null);
            setRejectNotes("");
            setRejectInternalNotes("");
            setPaidByAssigneeId("");
            setProofFile(null);
            setProofError("");
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
          currentAssigneeId={invoice?.assignee_id || ""}
          onSelect={setSelectedAssignee}
          onCancel={() => setAssignOpen(false)}
          onConfirm={saveAssignee}
        />
      )}

      {editOpen && invoice && (role === "admin" || role === "adm_campanha") && (
        <InvoiceEditModal
          invoice={invoice}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            setInvoice(updated);
            setNotesSupplier(updated.notes_supplier || "");
            setNotesInternal(updated.notes_internal || "");
            setEditOpen(false);
            toast.success("NF atualizada");
            setEventsRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function ActionsBar({
  role,
  invoice,
  t,
  canApproveAsAdm,
  canApproveAsAdmin,
  canReject,
  canPay,
  youApprovedAsAdm,
  youApprovedAsAdmin,
  onApproveAdm,
  onApproveAdmin,
  onReject,
  onPay
}: {
  role: string;
  invoice: Invoice;
  t: any;
  canApproveAsAdm: boolean;
  canApproveAsAdmin: boolean;
  canReject: boolean;
  canPay: boolean;
  youApprovedAsAdm: boolean;
  youApprovedAsAdmin: boolean;
  onApproveAdm: () => void;
  onApproveAdmin: () => void;
  onReject: () => void;
  onPay: () => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap gap-3">
      {role === "adm_campanha" &&
        invoice.status === "em_analise" &&
        (canApproveAsAdm ? (
          <button
            onClick={onApproveAdm}
            className="flex items-center gap-2 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25"
          >
            <CheckCircle2 className="h-4 w-4" />
            {t.approveAdm}
          </button>
        ) : youApprovedAsAdm ? (
          <span className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-2 text-sm text-emerald-300 opacity-80">
            <CheckCircle2 className="h-4 w-4" />
            {t.youApproved}
          </span>
        ) : null)}

      {role === "admin" &&
        invoice.status === "em_analise" &&
        (canApproveAsAdmin ? (
          <button
            onClick={onApproveAdmin}
            className="flex items-center gap-2 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25"
          >
            <CheckCircle2 className="h-4 w-4" />
            {t.approveAdmin}
          </button>
        ) : youApprovedAsAdmin ? (
          <span className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-2 text-sm text-emerald-300 opacity-80">
            <CheckCircle2 className="h-4 w-4" />
            {t.youApprovedAdmin}
          </span>
        ) : null)}

      {canPay && (
        <button
          onClick={onPay}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
        >
          <Wallet className="h-4 w-4" />
          {t.markPaid}
        </button>
      )}

      {canReject && (
        <button
          onClick={onReject}
          className="flex items-center gap-2 rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/25"
        >
          {t.reject}
        </button>
      )}
    </div>
  );
}

function ApprovalLine({
  icon: Icon,
  label,
  name,
  at,
  lang,
  accent
}: {
  icon: React.ElementType;
  label: string;
  name: string;
  at: string;
  lang: "pt" | "en";
  accent?: "primary";
}) {
  const color = accent === "primary" ? "text-primary" : "text-emerald-300";
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className={`mt-0.5 h-4 w-4 ${color}`} />
      <p className="text-muted">
        {label}:{" "}
        <span className="font-medium text-foreground">{name}</span>{" "}
        <span className="text-xs">— {fmtDateTime(at, lang)}</span>
      </p>
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
  currentAssigneeId,
  onSelect,
  onCancel,
  onConfirm
}: {
  t: any;
  users: NfUser[];
  loading: boolean;
  saving: boolean;
  selected: string;
  currentAssigneeId: string;
  onSelect: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const noChange = selected === currentAssigneeId;
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
              disabled={loading || saving || noChange}
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

function SupplierPayBlock({ supplier }: { supplier: Supplier }) {
  const isIntl = supplier.pay_wire_type !== "domestic";
  const rows: Array<[string, string | null | undefined]> = [
    ["Razao social / Beneficiario", supplier.legal_name ?? supplier.name],
    ["Tipo", supplier.pay_wire_type ? (isIntl ? "Internacional (SWIFT)" : "Domestica (Routing/ABA)") : null],
    ["Conta / IBAN", supplier.pay_account_number],
    ["Banco beneficiario", supplier.pay_beneficiary_bank_name],
    [isIntl ? "SWIFT" : "Routing/ABA", supplier.pay_beneficiary_bank_code],
    ["Banco correspondente", supplier.pay_correspondent_bank_name],
    ["SWIFT correspondente", supplier.pay_correspondent_bank_swift],
    ["Pais", supplier.pay_creditor_country],
    ["Cidade", supplier.pay_creditor_city],
    ["Endereco", supplier.pay_creditor_address],
    ["Telefone", supplier.pay_creditor_phone]
  ];
  const filled = rows.filter(([, v]) => !!v && String(v).trim());
  const hasInstructions = !!supplier.pay_instructions?.trim();

  // Nada cadastrado: nao mostra o bloco.
  if (filled.length === 0 && !hasInstructions) return null;

  return (
    <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-6">
      <div className="mb-3 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary" />
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Dados de pagamento (HelmBank)
        </p>
      </div>
      {filled.length > 0 && (
        <div className="space-y-2">
          {filled.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4">
              <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
              <p className="select-all text-right text-sm font-medium text-foreground">
                {value}
              </p>
            </div>
          ))}
        </div>
      )}
      {hasInstructions && (
        <div className="mt-4 border-t border-primary/20 pt-4">
          <p className="mb-1.5 text-xs uppercase tracking-wider text-muted">
            Instrucoes de pagamento
          </p>
          <p className="select-all whitespace-pre-wrap text-sm text-foreground">
            {supplier.pay_instructions}
          </p>
        </div>
      )}
    </div>
  );
}

function CampanhasBlock({
  campanhas,
  moeda,
  total,
  lang
}: {
  campanhas: NfCampanhaLink[];
  moeda: string;
  total: number;
  lang: "pt" | "en";
}) {
  const soma = campanhas.reduce(
    (s, c) => s + (Number(c.valor_alocado) || 0),
    0
  );
  const mismatch = total > 0 && Math.abs(soma - total) > 0.005;

  const fmtMes = (s: string | null | undefined) => {
    if (!s) return "";
    const ym = s.length >= 7 ? s.slice(0, 7) : s;
    const [y, m] = ym.split("-");
    return y && m ? `${m}/${y}` : s;
  };

  return (
    <div className="mt-6 rounded-xl border border-border bg-surface p-6">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        {lang === "pt" ? "Campanhas vinculadas" : "Linked campaigns"}
      </p>
      <div className="space-y-2">
        {campanhas.map((c) => {
          const codigo = c.codigo ? String(c.codigo) : null;
          const mes = fmtMes(c.mes_referencia);
          const label = [codigo, c.name, mes].filter(Boolean).join(" — ");
          return (
            <div
              key={c.campanha_id}
              className="flex items-baseline justify-between gap-4"
            >
              <p className="min-w-0 truncate text-sm text-foreground">
                {label || c.campanha_id}
              </p>
              <p className="flex-shrink-0 text-sm font-medium text-foreground">
                {fmtCurrency(Number(c.valor_alocado) || 0, moeda, lang)}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-border pt-3">
        <p className="text-xs uppercase tracking-wider text-muted">
          {lang === "pt" ? "Soma alocada" : "Allocated total"}
        </p>
        <p
          className={`text-sm font-semibold ${
            mismatch ? "text-amber-400" : "text-foreground"
          }`}
        >
          {fmtCurrency(soma, moeda, lang)}
          {mismatch && (
            <span className="ml-2 text-xs font-normal text-amber-400">
              ({lang === "pt" ? "difere do total" : "differs from total"}:{" "}
              {fmtCurrency(total, moeda, lang)})
            </span>
          )}
        </p>
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
  adminCompletingFlow,
  adminUsers,
  paidByAssigneeId,
  setPaidByAssigneeId,
  loadingUsers,
  t,
  invoiceNumber,
  rejectNotes,
  setRejectNotes,
  rejectInternalNotes,
  setRejectInternalNotes,
  proofFile,
  setProofFile,
  proofError,
  loading,
  onCancel,
  onConfirm
}: {
  action: Action;
  adminCompletingFlow: boolean;
  adminUsers: NfUser[];
  paidByAssigneeId: string;
  setPaidByAssigneeId: (v: string) => void;
  loadingUsers: boolean;
  t: any;
  invoiceNumber: string;
  rejectNotes: string;
  setRejectNotes: (v: string) => void;
  rejectInternalNotes: string;
  setRejectInternalNotes: (v: string) => void;
  proofFile: File | null;
  setProofFile: (f: File | null) => void;
  proofError: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isApproveAdminDouble =
    action === "approve_admin" && adminCompletingFlow;

  const title =
    action === "reject"
      ? t.confirmReject
      : action === "pay"
      ? `${t.payTitle} #${invoiceNumber} ${t.asPaid}`
      : isApproveAdminDouble
      ? `${t.confirmApproveDouble} #${invoiceNumber}`
      : t.confirmApproveSingle;

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

          {action === "pay" && (
            <>
              <p className="text-sm text-muted">{t.proofLabel}</p>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  {t.proofFileLabel} <span className="text-primary">*</span>
                </label>
                <input
                  type="file"
                  accept={PROOF_ACCEPT}
                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:opacity-90"
                />
                {proofFile && (
                  <p className="mt-1 text-xs text-muted">
                    {proofFile.name} · {(proofFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
                {proofError && (
                  <p className="mt-1 text-xs text-danger">{proofError}</p>
                )}
              </div>
            </>
          )}

          {isApproveAdminDouble && (
            <>
              <p className="text-sm text-muted">{t.completesFlow}</p>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  {t.designatePayer}
                </label>
                {loadingUsers ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.saving}
                  </div>
                ) : (
                  <select
                    value={paidByAssigneeId}
                    onChange={(e) => setPaidByAssigneeId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary/60"
                  >
                    <option value="">{t.designateNobody}</option>
                    {adminUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                )}
                <p className="mt-1.5 text-xs text-muted">{t.designatePayerHint}</p>
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
              disabled={
                loading ||
                (action === "reject" && !rejectNotes.trim()) ||
                (action === "pay" && !proofFile)
              }
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.saving}
                </>
              ) : isApproveAdminDouble ? (
                t.confirmApproval
              ) : action === "pay" ? (
                t.proofConfirm
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
