import { AppShell } from "@/components/app-shell";
import { PageHeader, EmptyState } from "@/components/ui";

export default function NotasPage() {
  return (
    <AppShell>
      <PageHeader
        title="Notas fiscais"
        description="Lista de todas as NFs cadastradas."
        actionLabel="Nova nota"
        actionHref="/notas/new"
      />

      <EmptyState
        title="Nenhuma nota cadastrada"
        description="A integracao com o backend de NF sera ligada aqui. Por enquanto e so o esqueleto da tela."
      />
    </AppShell>
  );
}
