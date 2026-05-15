import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/lib/toast-context";
import { BootstrapGate } from "@/components/nf/bootstrap-gate";

export const metadata: Metadata = {
  title: "Caracol NF",
  description: "Controle interno de notas fiscais"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body>
        <AuthProvider>
          <ToastProvider>
            <BootstrapGate>{children}</BootstrapGate>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
