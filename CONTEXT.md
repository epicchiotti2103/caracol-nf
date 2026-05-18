# Caracol NF — contexto detalhado

> Doc de arquitetura e decisoes. Resumo executivo em `README.md`.

## O que e

Sistema interno de controle de notas fiscais da Caracol. **Estado: funcional fase 1** — CRUD de invoices (envio com PDF, listagem, detalhe), papeis intra-NF, dashboard de admin, workflow de status com auditoria.

## URLs e infra

| | |
|---|---|
| Repo | https://github.com/epicchiotti2103/caracol-nf (privado) |
| Producao | https://nf.aeobr.com.br |
| Vercel project | caracol-nf |
| DNS | Cloudflare, modo **DNS only (nuvem cinza)**, CNAME `nf` → `cname.vercel-dns.com` |
| HTTPS | Let's Encrypt via Vercel automatico |

## Por que existe

Substitui a planilha que controla as NFs que publishers/parceiros emitem pra Caracol: acompanhar valor, vencimento, mes de referencia, campanha vinculada, status (em analise → aprovada → paga, ou recusada). Quem aprova/paga fica auditado.

E o **segundo app** da suite Caracol, depois do Tracker. Entra no Hub como tile.

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS (mesmo tema laranja escuro do Tracker)
- js-cookie pra sessao
- lucide-react pra icones
- Auth: chama `POST /api/v1/auth/login` do backend do Tracker (Supabase Auth via FastAPI)
- Backend NF: vive em `tracker-caracol/backend/app/routes/nf.py` sob `/api/v1/nf/*` (decisao: backend unico)

## Estrutura de pastas

```
caracol-nf/
  app/
    globals.css                  Variaveis HSL do tema
    layout.tsx                   AuthProvider + ToastProvider + BootstrapGate
    page.tsx                     Lista de invoices (renderiza conforme papel)
    login/page.tsx               Login
    invoice/
      new/page.tsx               Form de cadastro (bilingual + upload PDF)
      [id]/page.tsx              Detalhe + acoes (aprovar/recusar/pagar)
    admin/
      usuarios-nf/page.tsx       Gestao de papeis intra-NF (admin only)
  components/
    app-shell.tsx                Layout com navbar
    nf-navbar.tsx                Navbar unificado, adapta conforme papel
    nf/bootstrap-gate.tsx        Valida acesso e expoe papel via context
    status-badge.tsx             Badge bilingual de status
  lib/
    api.ts                       fetch helper com Bearer token
    auth-context.tsx             Sessao + SSO (replicado nos 3 apps)
    config.ts                    API_BASE_URL, HUB_URL
    toast-context.tsx            Toasts globais
    nf-role-context.tsx          Papel intra-NF + helper langForRole
    i18n.ts                      Strings bilingual + formatadores
  types/index.ts                 Invoice, InvoiceStatus, NfRole, NfUser, DashboardSummary
  middleware.ts                  Redireciona pra /login se nao autenticado
```

## Endpoints consumidos

Todos sob `NEXT_PUBLIC_API_URL` (`https://trk.aeobr.com.br/api/v1`):

- `POST /auth/login` — login
- `POST /auth/refresh` — refresh do token (transparente via `lib/api.ts`)
- `GET /hub/me/apps` — apps do user (gate de acesso)
- `GET /nf/me/role` — papel intra-NF (gate intra-app)
- `GET /nf/invoices` — lista (filtrada por papel no backend)
- `GET /nf/invoices/{id}` — detalhe
- `GET /nf/invoices/{id}/pdf` — `{url}` assinada (5min)
- `POST /nf/invoices` — cria (multipart, campo `pdf` opcional)
- `PATCH /nf/invoices/{id}/status` — `{status, notes?}`; regras de papel no backend
- `GET /nf/dashboard/summary` — `{em_analise_count, a_pagar_amount, pagas_30d_amount}` (admin)
- `GET /nf/users` — lista users com `nf_role` (admin)
- `PUT /nf/users/{user_id}/role` — `{role: NfRole | null}` (admin)

## Papeis intra-NF

| Papel | Pode ver | Pode aprovar | Pode pagar | UI |
|---|---|---|---|---|
| `publisher` | Suas proprias NFs | — | — | Ingles |
| `adm_campanha` | Todas as NFs | Sim (`em_analise`) e recusar | — | Portugues |
| `admin` | Todas as NFs + dashboard | Sim | Sim (`aprovada` → `paga`) | Portugues |

Admin tambem pode gerir papeis em `/admin/usuarios-nf` via `PUT /nf/users/{id}/role` (passar `role: null` remove o papel).

## Workflow de status

```
   em_analise --(approve)--> aprovada --(pay)--> paga
        |                         |
        +--(reject + notes)-> recusada <-(reject + notes, edge)
```

Modal de aprovacao/pagamento so confirma. Modal de recusa exige `notes` (motivo).

Campos de auditoria persistidos pelo backend:
- `approved_by` (uuid) + `approved_at` (timestamp) — preenchidos no transition para `aprovada`
- `paid_by` + `paid_at` — preenchidos no transition para `paga`
- `notes` — texto livre, carrega motivo da recusa

O frontend exibe nome do user (`approved_by_name`, `paid_by_name`) se o backend retornar; senao mostra o UUID.

## Bilinguismo

`publisher` → ingles. `adm_campanha` e `admin` → portugues. Resolvido por `langForRole(role)` em `lib/nf-role-context.tsx`. Strings em `lib/i18n.ts`. Status badge tambem aceita prop `lang`.

## Auth

Mesmo SSO via cookie no dominio raiz `.aeobr.com.br` (igual hub e tracker). Em producao, login feito em qualquer app vale aqui. Em dev (`localhost`), sem cross-subdomain.

`lib/auth-context.tsx` e identico ao do hub e do tracker — qualquer mudanca tem que ser replicada nos outros dois ou SSO quebra.

### Controle de admin

- `useAuth().isAdmin` deriva direto de `user.hub_role === "admin"`, vindo do backend no payload do `/auth/login`. **Sem mais lista hardcoded de emails.**
- Em client components, usar `const { isAdmin } = useAuth()`.
- Em server components / middleware, ler o cookie `user_data` e checar `hub_role === "admin"`.

### Gate de acesso ao app + papel intra-NF

`components/nf/bootstrap-gate.tsx` envolve a arvore dentro do `RootLayout`. Fluxo:

1. Espera o `AuthProvider` carregar.
2. Em `/login` ou quando nao ha `user`, libera direto.
3. Chama `GET /api/v1/hub/me/apps`. Se nao tem slug `nf` -> tela "sem acesso" + redirect pra `${HUB_URL}?reason=no_access_nf`.
4. Chama `GET /api/v1/nf/me/role`. Se `role: null` -> tela "perfil do NF nao configurado" com botao Sair.
5. Se role !== null -> envolve a arvore com `NfRoleProvider` expondo o papel.
6. Cache em memoria por `userId` (apps + role). Limpo automaticamente quando `user` vira `null` (logout).

## Variaveis de ambiente (Vercel)

```
NEXT_PUBLIC_API_URL=https://trk.aeobr.com.br/api/v1
NEXT_PUBLIC_HUB_URL=https://app.aeobr.com.br
```

## Estado atual

- [x] Repo criado (privado)
- [x] UI montada
- [x] Login funcional via API do Tracker
- [x] SSO entre subdominios
- [x] Deploy na Vercel
- [x] Dominio `nf.aeobr.com.br` com HTTPS
- [x] CORS liberado no backend do Tracker
- [x] Gate de acesso ao app via `GET /hub/me/apps` (slug `nf`)
- [x] Gate intra-NF via `GET /nf/me/role`
- [x] `ADMIN_EMAILS` hardcoded removido (admin vem de `hub_role`)
- [x] Backend NF em prod (`tracker-caracol/backend/app/routes/nf.py`)
- [x] Lista de invoices (filtros + status)
- [x] Form de cadastro com upload PDF
- [x] Detalhe com acoes condicionais por papel
- [x] Workflow de status (em_analise → aprovada → paga, recusada)
- [x] Auditoria (approved_by, approved_at, paid_by, paid_at, notes)
- [x] Dashboard admin (em_analise_count, a_pagar_amount, pagas_30d_amount)
- [x] Gestao de papeis intra-NF (`/admin/usuarios-nf`)
- [x] Logo Caracol clicavel volta pro Hub
- [ ] Cadastro de campanhas como entidade propria (hoje e texto livre)
- [ ] Integracao com SEFAZ (futuro)
- [ ] Notificacoes (futuro)

## Decisoes tomadas

1. **App separado** em vez de modulo dentro do Tracker — modelos sao muito diferentes. Mantido.

2. **Helpers reaproveitados do Tracker** (api.ts, auth-context.tsx, toast-context.tsx) — copiados manualmente. Para o terceiro app, considerar extrair pra `@caracol/ui`.

3. **Mesma instancia Supabase do Tracker** — tabelas novas com prefixo `nf_`. Permite SSO trivial e reuso de auth.

4. **Backend unico no Tracker** — rotas `/api/v1/nf/*` em `tracker-caracol/backend/app/routes/nf.py`. Decisao tomada e em prod.

5. **Route groups removidos** — antes existiam `app/(supplier)/` e `app/(admin)/` pensados pra emails hardcoded. Agora tudo unificado em `/`, `/invoice/*`, `/admin/*`, com renderizacao condicional baseada em `useNfRole()`. Mais simples.

6. **Bilinguismo derivado do papel, nao da preferencia do user** — publisher e usuario externo, ve ingles. Adm/admin sao internos, veem portugues. Simples e suficiente pro escopo atual.

## Como editar

- **Codespaces** (recomendado): "Code → Codespaces → Create on main".
- **github.dev**: aperta `.` no repo.
- Local: `git clone`, `npm install`, `npm run dev`.

Cada push em `main` re-deploya na Vercel automaticamente.

## Para retomar o trabalho

Se voce e uma IA chegando aqui sem contexto:

1. **Leia este doc inteiro** antes de propor mudancas.
2. **Estado: funcional fase 1.** Telas em prod.
3. **Auth e cookie compartilhado**: qualquer mudanca em `lib/auth-context.tsx` precisa ser replicada em `caracol-hub` e `tracker-caracol`. Se desalinhar, SSO quebra.
4. **Backend nao vive aqui** — esta em `tracker-caracol/backend/app/routes/nf.py`. Pedir trabalho de backend = tarefa pro subagente `tracker`.
5. Cuidado com Cloudflare: subdominio `nf.aeobr.com.br` esta em **DNS only (cinza)**. Nao ligar proxy.
6. Helpers que ja existem — **nao reinvente**:
   - `apiFetch` pra fetch com Bearer (refresh automatico em 401)
   - `useToast` pra notificacoes
   - `useNfRole()` + `langForRole(role)` pra resolver idioma
   - `fmtCurrency / fmtDate / fmtRefMonth / fmtDateTime` em `lib/i18n.ts`
   - `StatusBadge` com prop `lang`
