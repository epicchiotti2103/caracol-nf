"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useNfRole, useCan, langForRole } from "@/lib/nf-role-context";
import { HUB_URL } from "@/lib/config";
import { Building2, FileText, LogOut, ArrowLeft, ShieldCheck, Tag, Truck, User, Users } from "lucide-react";
import type { NfPermKey } from "@/types";

// perm: key de permissão exigida pra ver o link (gating dinâmico via `can`).
// Se omitido, link e visivel para todos os papeis do idioma.
// adminOnly: link visivel apenas pro papel admin (gating estatico — usado em
// telas sem perm key dedicada, ex: catalogo de tags, que e admin-only).
type LinkDef = {
  href: string;
  label: string;
  icon: any;
  perm?: NfPermKey;
  adminOnly?: boolean;
};

const linksByLang: Record<"pt" | "en", LinkDef[]> = {
  pt: [
    { href: "/", label: "Notas", icon: FileText },
    { href: "/admin/clientes", label: "Clientes", icon: Building2, perm: "nf.clientes.view" },
    { href: "/admin/fornecedores", label: "Fornecedores", icon: Truck, perm: "nf.fornecedores.view" },
    { href: "/admin/usuarios-nf", label: "Usuarios", icon: Users, perm: "nf.usuarios.view" },
    { href: "/admin/tags", label: "Tags", icon: Tag, adminOnly: true }
  ],
  en: [{ href: "/", label: "Invoices", icon: FileText }]
};

const t = {
  pt: { hub: "Hub", logout: "Sair", role: "Equipe" },
  en: { hub: "Hub", logout: "Log out", role: "Publisher" }
};

export function NfNavbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const role = useNfRole();
  const can = useCan();
  const lang = langForRole(role);
  const links = linksByLang[lang].filter(
    (l) => (!l.perm || can(l.perm)) && (!l.adminOnly || role === "admin")
  );

  return (
    <header className="sticky top-0 z-40 border-b border-primary/30 bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <a
              href={HUB_URL}
              className="flex items-center gap-2.5"
              title={lang === "pt" ? "Voltar ao Hub" : "Back to Hub"}
            >
              <Image
                src="/logo-caracol.png"
                alt="Caracol"
                width={120}
                height={32}
                priority
                className="h-7 w-auto sm:h-8"
              />
              <div className="hidden sm:block">
                <span className="text-sm font-semibold tracking-wide text-orange-50">
                  {lang === "pt" ? "Notas Fiscais" : "Invoices"}
                </span>
                {role === "admin" && (
                  <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
                    Admin
                  </span>
                )}
                {role === "adm_campanha" && (
                  <span className="ml-2 rounded bg-blue-500/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-200">
                    Campanha
                  </span>
                )}
              </div>
            </a>

            <nav className="hidden items-center gap-1 md:flex">
              {links.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "text-primary"
                        : "text-orange-100/60 hover:bg-white/5 hover:text-orange-50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={HUB_URL}
              className="hidden items-center gap-1 rounded-md px-2 py-1.5 text-xs text-orange-100/40 hover:text-orange-50 sm:flex"
              title={t[lang].hub}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t[lang].hub}
            </a>

            <div className="flex items-center gap-2 border-l border-white/10 pl-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                {role === "publisher" ? (
                  <User className="h-4 w-4 text-primary" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="hidden text-right sm:block">
                <p className="max-w-[160px] truncate text-xs font-medium leading-tight text-orange-50">
                  {user?.name || (lang === "pt" ? "Usuario" : "User")}
                </p>
                <p className="text-[11px] leading-tight text-primary/70">
                  {role === "admin"
                    ? lang === "pt"
                      ? "Admin NF"
                      : "NF Admin"
                    : role === "adm_campanha"
                    ? "Adm. Campanha"
                    : t[lang].role}
                </p>
              </div>
              <button
                onClick={logout}
                title={t[lang].logout}
                className="rounded-md p-1.5 text-orange-100/60 transition-colors hover:bg-white/5 hover:text-orange-50"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {links.length > 1 && (
          <div className="flex items-center gap-1 pb-2 md:hidden">
            {links.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    active ? "text-primary" : "text-orange-100/60"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
