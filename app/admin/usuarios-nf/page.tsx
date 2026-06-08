"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useCan } from "@/lib/nf-role-context";
import { useToast } from "@/lib/toast-context";
import { apiFetch } from "@/lib/api";
import type { NfRole, NfUser } from "@/types";

const ROLES: { value: NfRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "adm_campanha", label: "Adm. Campanha" },
  { value: "publisher", label: "Publisher" }
];

export default function UsuariosNfPage() {
  return (
    <AppShell>
      <UsuariosNfContent />
    </AppShell>
  );
}

function UsuariosNfContent() {
  const can = useCan();
  const router = useRouter();
  const toast = useToast();

  const canSee = can("nf.usuarios.view");
  const canManage = can("nf.usuarios.manage");

  const [users, setUsers] = useState<NfUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"sem" | "com">("com");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Guard de acesso
  useEffect(() => {
    if (!canSee) {
      router.replace("/");
    }
  }, [canSee, router]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res: { items: NfUser[]; total: number } | NfUser[] = await apiFetch("/nf/users");
      const items = Array.isArray(res) ? res : res?.items || [];
      setUsers(items);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canSee) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const inTab = tab === "sem" ? !u.nf_role : !!u.nf_role;
      if (!inTab) return false;
      if (!q) return true;
      return (
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
      );
    });
  }, [users, search, tab]);

  const changeRole = async (userId: string, newRole: NfRole | null) => {
    setBusyId(userId);
    try {
      const res: NfUser = await apiFetch(`/nf/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role: newRole })
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, nf_role: res?.nf_role ?? newRole } : u))
      );
      toast.success(newRole ? "Papel atualizado." : "Papel removido.");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao atualizar papel.");
    } finally {
      setBusyId(null);
    }
  };

  if (!canSee) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
            Gestao de papeis
          </h4>
          <h1 className="text-2xl font-semibold text-foreground">Usuarios do NF</h1>
          <p className="mt-1 text-sm text-muted">
            Defina quem e publisher, adm. de campanha ou admin no NF.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/papeis"
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface/80 hover:text-foreground"
            title="Editar a matriz de permissoes por papel"
          >
            <ShieldCheck className="h-4 w-4" />
            Papeis
          </Link>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-border bg-surface p-2 text-muted transition-colors hover:bg-surface/80 disabled:opacity-50"
            title="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface">
        <div className="flex flex-col items-start gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
          <div className="relative w-full flex-1 sm:w-auto">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTab("com")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === "com"
                  ? "bg-primary text-black"
                  : "bg-background text-muted hover:text-foreground"
              }`}
            >
              Com papel
            </button>
            <button
              onClick={() => setTab("sem")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === "sem"
                  ? "bg-primary text-black"
                  : "bg-background text-muted hover:text-foreground"
              }`}
            >
              Sem papel
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Nome", "Email", "Papel NF", "Acoes"].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <Users className="mx-auto mb-3 h-8 w-8 opacity-20" />
                    <p className="text-sm text-muted">
                      {tab === "sem" ? "Nenhum usuario sem papel." : "Nenhum usuario com papel."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((u, i) => (
                  <tr
                    key={u.id}
                    className={`transition-colors hover:bg-background ${
                      i < filtered.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <td className="px-5 py-4 font-medium text-foreground">{u.name || "—"}</td>
                    <td className="px-5 py-4 text-muted">{u.email}</td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <select
                        value={u.nf_role || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          changeRole(u.id, v ? (v as NfRole) : null);
                        }}
                        disabled={busyId === u.id || !canManage}
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/50 disabled:opacity-50"
                      >
                        <option value="">— sem papel —</option>
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      {u.nf_role && canManage && (
                        <button
                          onClick={() => changeRole(u.id, null)}
                          disabled={busyId === u.id}
                          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground disabled:opacity-50"
                        >
                          {busyId === u.id ? "..." : "Remover"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
