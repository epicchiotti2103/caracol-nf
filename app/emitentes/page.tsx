import { AppShell } from "@/components/app-shell";
import { PageHeader, EmptyState } from "@/components/ui";

export default function EmitentesPage() {
  return (
    <AppShell>
      <PageHeader
        title="Emitentes"
        description="Empresas emissoras das notas fiscais."
        actionLabel="Novo emitente"
        actionHref="/emitentes/new"
      />

      <EmptyState
        title="Nenhum emitente cadastrado"
        description="Esqueleto da tela. Backend ainda nao conectado."
      />
    </AppShell>
  );
}
