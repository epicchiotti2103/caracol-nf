"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useCan } from "@/lib/nf-role-context";
import { useToast } from "@/lib/toast-context";
import { apiFetch } from "@/lib/api";
import type {
  PermCatalogItem,
  PermsMatrixResponse,
  PermsMatrixUpdatePayload
} from "@/types";

// Rótulos amigáveis dos papéis (fallback pro próprio id quando desconhecido).
const ROLE_LABELS: Record<string, string> = {
  adm_campanha: "Adm. Campanha",
  publisher: "Publisher",
  admin: "Admin"
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}

export default function PapeisPage() {
  return (
    <AppShell>
      <PapeisContent />
    </AppShell>
  );
}

function PapeisContent() {
  const can = useCan();
  const router = useRouter();
  const toast = useToast();

  // A matriz é editável só por admin (god-mode). Reusa a key de gestão de
  // usuários como porta de entrada — quem mexe em papéis é o admin.
  const canSee = can("nf.usuarios.manage");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<PermCatalogItem[]>([]);
  // matriz editável (role -> key -> bool)
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [dirty, setDirty] = useState(false);

  // Guard de acesso
  useEffect(() => {
    if (!canSee) router.replace("/");
  }, [canSee, router]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res: PermsMatrixResponse = await apiFetch("/perms/nf/matrix");
      setRoles(Array.isArray(res?.roles) ? res.roles : []);
      setCatalog(Array.isArray(res?.catalog) ? res.catalog : []);
      setMatrix(res?.matrix && typeof res.matrix === "object" ? res.matrix : {});
      setDirty(false);
    } catch (err: any) {
      setError(
        err?.message ||
          "Falha ao carregar a matriz de permissoes. O backend de permissoes pode ainda nao estar no ar."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canSee) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee]);

  // Agrupa o catálogo por `group`, preservando a ordem de aparição.
  const groups = useMemo(() => {
    const map = new Map<string, PermCatalogItem[]>();
    for (const item of catalog) {
      const g = item.group || "Geral";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(item);
    }
    return Array.from(map.entries());
  }, [catalog]);

  const toggle = (role: string, key: string) => {
    setMatrix((prev) => {
      const roleMap = { ...(prev[role] || {}) };
      roleMap[key] = !roleMap[key];
      return { ...prev, [role]: roleMap };
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      // Manda só os papéis editáveis (admin não vai no body — é god-mode).
      const payload: PermsMatrixUpdatePayload = {
        matrix: Object.fromEntries(
          roles.map((r) => [r, matrix[r] || {}])
        )
      };
      const res: PermsMatrixResponse = await apiFetch("/perms/nf/matrix", {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      // O backend pode normalizar/devolver a matriz canônica.
      if (res?.matrix && typeof res.matrix === "object") setMatrix(res.matrix);
      if (Array.isArray(res?.roles)) setRoles(res.roles);
      if (Array.isArray(res?.catalog)) setCatalog(res.catalog);
      setDirty(false);
      toast.success("Matriz de permissoes salva.");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao salvar a matriz.");
    } finally {
      setSaving(false);
    }
  };

  if (!canSee) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/usuarios-nf"
            className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Usuarios do NF
          </Link>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
            Controle de acesso
          </h4>
          <h1 className="text-2xl font-semibold text-foreground">Papeis e permissoes</h1>
          <p className="mt-1 text-sm text-muted">
            Defina o que cada papel pode ver e gerenciar no NF. O papel{" "}
            <span className="font-medium text-foreground">Admin</span> tem acesso total
            e nao e editavel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading || saving}
            className="rounded-lg border border-border bg-surface p-2 text-muted transition-colors hover:bg-surface/80 disabled:opacity-50"
            title="Recarregar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={save}
            disabled={!dirty || saving || loading}
            className="flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : catalog.length === 0 ? (
          <div className="py-20 text-center">
            <ShieldCheck className="mx-auto mb-3 h-8 w-8 opacity-20" />
            <p className="text-sm text-muted">Nenhuma permissao no catalogo.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="sticky left-0 z-10 bg-surface px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                    Permissao
                  </th>
                  {/* Admin sempre primeiro, read-only */}
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-primary">
                    Admin
                  </th>
                  {roles.map((r) => (
                    <th
                      key={r}
                      className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted"
                    >
                      {roleLabel(r)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(([group, items]) => (
                  <GroupRows
                    key={group}
                    group={group}
                    items={items}
                    roles={roles}
                    matrix={matrix}
                    onToggle={toggle}
                    colSpan={roles.length + 2}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-muted">
        As mudancas so valem apos clicar em <span className="font-medium">Salvar</span>.
      </p>
    </div>
  );
}

function GroupRows({
  group,
  items,
  roles,
  matrix,
  onToggle,
  colSpan
}: {
  group: string;
  items: PermCatalogItem[];
  roles: string[];
  matrix: Record<string, Record<string, boolean>>;
  onToggle: (role: string, key: string) => void;
  colSpan: number;
}) {
  return (
    <>
      <tr className="border-b border-border bg-background/30">
        <td
          colSpan={colSpan}
          className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-primary/80"
        >
          {group}
        </td>
      </tr>
      {items.map((item) => (
        <tr key={item.key} className="border-b border-border last:border-0 hover:bg-background">
          <td className="sticky left-0 z-10 bg-surface px-5 py-3">
            <div className="font-medium text-foreground">{item.label}</div>
            <div className="text-[11px] text-muted">{item.key}</div>
          </td>
          {/* Admin: read-only, sempre liberado */}
          <td className="px-4 py-3 text-center">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary"
              title="Admin tem acesso total (nao editavel)"
            >
              <Check className="h-4 w-4" />
            </span>
          </td>
          {roles.map((role) => {
            const checked = !!matrix[role]?.[item.key];
            return (
              <td key={role} className="px-4 py-3 text-center">
                <button
                  type="button"
                  onClick={() => onToggle(role, item.key)}
                  aria-pressed={checked}
                  aria-label={`${roleLabel(role)} — ${item.label}`}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
                    checked
                      ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                      : "border-border bg-background text-transparent hover:border-primary/40"
                  }`}
                >
                  <Check className="h-4 w-4" />
                </button>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
