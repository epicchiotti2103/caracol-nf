"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { HUB_URL } from "@/lib/config";
import { FileText, Users, LogOut, ShieldCheck, ArrowLeft } from "lucide-react";

const links = [
  { href: "/admin", label: "Notas recebidas", icon: FileText },
  { href: "/admin/suppliers", label: "Fornecedores", icon: Users }
];

export function AdminNavbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-zinc-950 border-b border-primary/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-black">
                NF
              </div>
              <div className="hidden sm:block">
                <span className="text-sm font-semibold tracking-wide text-orange-50">
                  Notas Fiscais
                </span>
                <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-primary text-black">
                  Admin
                </span>
              </div>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {links.map(({ href, label, icon: Icon }) => {
                const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
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
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Hub
            </a>

            <div className="flex items-center gap-2 border-l border-white/10 pl-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <ShieldCheck className="h-4 w-4 text-primary" />
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-xs font-medium leading-tight text-orange-50">
                  {user?.name || "Equipe Caracol"}
                </p>
                <p className="text-[11px] leading-tight text-primary/70">Equipe interna</p>
              </div>
              <button
                onClick={logout}
                title="Sair"
                className="rounded-md p-1.5 text-orange-100/60 transition-colors hover:bg-white/5 hover:text-orange-50"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 pb-2 md:hidden">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
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
      </div>
    </header>
  );
}
