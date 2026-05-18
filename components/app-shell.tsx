import { NfNavbar } from "@/components/nf-navbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <NfNavbar />
      <main>{children}</main>
    </div>
  );
}
