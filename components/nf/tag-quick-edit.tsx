"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { apiFetchStrict, ApiHttpError } from "@/lib/api-error";
import type { NfTag } from "@/types";

type Kind = "invoice" | "receivable";

interface TagPatchResponse {
  id: string;
  tag_id: string | null;
  tag_name: string | null;
}

interface Props {
  kind: Kind;
  id: string;
  tagId: string | null | undefined;
  tagName: string | null | undefined;
  // Quem pode editar (admin/adm_campanha e status != cancelada) — decidido
  // pelo chamador. false => so exibe o badge (ou nada, se sem tag).
  editable: boolean;
  onSaved: (tagId: string | null, tagName: string | null) => void;
  // "badge" = pilula compacta (listas); "inline" = texto simples (detalhe).
  variant?: "badge" | "inline";
}

/**
 * Edicao SO da tag, em qualquer status da NF (aprovada/paga/recebida inclusive).
 * Usa as rotas dedicadas PATCH /nf/invoices/{id}/tag e /nf/receivables/{id}/tag
 * (body {tag_id|null}) — o PATCH geral continua travado fora de em_analise/pendente.
 *
 * 404 = backend ainda sem a rota (deploy em andamento) -> mensagem amigavel.
 */
export function TagQuickEdit({
  kind,
  id,
  tagId,
  tagName,
  editable,
  onSaved,
  variant = "badge"
}: Props) {
  const [editing, setEditing] = useState(false);
  const [tags, setTags] = useState<NfTag[] | null>(null);
  const [tagsError, setTagsError] = useState(false);
  const [value, setValue] = useState<string>(tagId || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing || tags !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const res: { items: NfTag[] } | NfTag[] = await apiFetch(
          "/nf/tags?active=true"
        );
        const items = Array.isArray(res) ? res : res?.items || [];
        if (!cancelled) setTags(items);
      } catch {
        if (!cancelled) {
          setTags([]);
          setTagsError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editing, tags]);

  const start = (e: React.MouseEvent) => {
    e.stopPropagation();
    setValue(tagId || "");
    setError("");
    setEditing(true);
  };

  const cancel = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditing(false);
    setError("");
  };

  const save = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = value || null;
    if (next === (tagId || null)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const base = kind === "invoice" ? "/nf/invoices" : "/nf/receivables";
      const res: TagPatchResponse | null = await apiFetchStrict(
        `${base}/${id}/tag`,
        { method: "PATCH", body: JSON.stringify({ tag_id: next }) }
      );
      const savedId = res ? res.tag_id ?? null : next;
      const savedName =
        res && res.tag_name !== undefined
          ? res.tag_name
          : tags?.find((t) => t.id === next)?.name ?? null;
      onSaved(savedId, savedName);
      setEditing(false);
    } catch (err: any) {
      if (err instanceof ApiHttpError && err.status === 404) {
        setError(
          "Edição de tag ainda não disponível (backend em atualização). Tente de novo em alguns minutos."
        );
      } else if (err instanceof ApiHttpError && err.status === 403) {
        setError("Sem permissão para alterar a tag.");
      } else {
        setError(err?.message || "Falha ao salvar a tag.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    // Tag atual pode estar inativa: mantem na lista pra nao sumir do select.
    const list = tags || [];
    const currentMissing = !!tagId && !list.some((t) => t.id === tagId);
    return (
      <div
        className="flex flex-col gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1">
          <select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={saving || tags === null}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary/60 disabled:opacity-60"
          >
            <option value="">Sem tag</option>
            {currentMissing && (
              <option value={tagId as string}>
                {tagName || "(tag atual)"}
              </option>
            )}
            {list.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            onClick={save}
            disabled={saving || tags === null}
            className="rounded p-1 text-emerald-300 hover:bg-background disabled:opacity-50"
            title="Salvar tag"
          >
            {saving || tags === null ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={cancel}
            disabled={saving}
            className="rounded p-1 text-muted hover:bg-background hover:text-foreground disabled:opacity-50"
            title="Cancelar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {tagsError && (
          <p className="text-[10px] text-amber-300">
            Não foi possível carregar as tags.
          </p>
        )}
        {error && <p className="max-w-[260px] text-[10px] text-red-300">{error}</p>}
      </div>
    );
  }

  const label =
    variant === "badge" ? (
      tagName ? (
        <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          {tagName}
        </span>
      ) : null
    ) : (
      <span className="text-sm text-foreground">
        {tagName || <span className="text-muted">—</span>}
      </span>
    );

  if (!editable) return label;

  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <button
        onClick={start}
        className="inline-flex items-center gap-0.5 rounded p-0.5 text-[10px] text-muted hover:bg-background hover:text-foreground"
        title={tagName ? "Trocar tag" : "Definir tag"}
      >
        <Pencil className="h-3 w-3" />
        {!tagName && variant === "badge" && <span>tag</span>}
      </button>
    </span>
  );
}
