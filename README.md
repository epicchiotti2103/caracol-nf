# Caracol NF

Sistema interno de controle de notas fiscais da Caracol.

Faz parte da suite Caracol — entrada pelo [Hub](https://github.com/epicchiotti2103/caracol-hub).

## Status: funcional (fase 1)

CRUD de invoices funcionando, com upload de PDF, papeis intra-NF (publisher / adm_campanha / admin), workflow de status (`em_analise` → `aprovada` → `paga`, com `recusada` em qualquer ponto antes de paga) e dashboard de admin. Backend vive no Tracker em `tracker-caracol/backend/app/routes/nf.py` (rotas `/api/v1/nf/*`).

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- js-cookie para sessao
- Mesma API de autenticacao do Tracker (`/api/v1/auth/login`)

## Telas

- `/login` — login conectado ao Supabase Auth (via API do Tracker)
- `/` — lista de notas fiscais (renderizacao diferente por papel; titulo, colunas e botoes adaptam)
- `/invoice/new` — formulario de cadastro de NF com upload de PDF (form bilingual: ingles pra publisher, portugues pros outros). Admin/adm_campanha precisam selecionar o publisher num `<select>` obrigatorio (alimentado por `GET /nf/users` filtrado por `nf_role === "publisher"`); publisher cadastra direto pra si.
- `/invoice/[id]` — detalhe da NF com auditoria (quem aprovou / quem pagou + timestamps) e acoes condicionais conforme papel
- `/admin/usuarios-nf` — gestao de papeis intra-NF (apenas admin)

A logo Caracol no header e clicavel e volta pro Hub.

## Papeis intra-NF

Sao definidos numa tabela do backend e expostos por `GET /api/v1/nf/me/role`. O `BootstrapGate` resolve o papel apos confirmar o acesso ao app `nf` e cacheia em memoria pra sessao.

| Papel | Pode | Idioma da UI |
|---|---|---|
| `publisher` | Criar e ver as proprias NFs | Ingles |
| `adm_campanha` | Ver todas NFs, aprovar/recusar `em_analise` | Portugues |
| `admin` | Tudo do adm_campanha + marcar `aprovada` como `paga` + recusa pos-aprovacao + gerir papeis | Portugues |

Sem papel definido, o gate mostra "Seu perfil no NF nao foi configurado".

## Workflow de status

```
em_analise --(approve)--> aprovada --(pay)--> paga
     |                         |
     +--(reject)----> recusada <+--(reject*)
```
\* adm_campanha/admin podem recusar uma `aprovada` se necessario.

Campos de auditoria: `approved_by` + `approved_at` (quem aprovou); `paid_by` + `paid_at` (quem pagou).

Notas em 2 campos: `notes_supplier` (visivel a todos, mostrada ao publisher — carrega motivo de recusa quando aplicavel) e `notes_internal` (so admin/adm_campanha veem; backend mascara como `null` no payload do publisher). Editaveis a qualquer hora via `PATCH /nf/invoices/{id}/notes`.

## Responsavel pela NF

Cada NF tem um campo opcional `assignee_id` (preenchido automaticamente no `POST /invoices` por um adm_campanha aleatorio, com fallback pra admin). Quem esta listado como responsavel ve, no topo da lista, um banner laranja "Voce tem N NFs aguardando voce" enquanto houver NFs `em_analise` atribuidas a ele. Clicar no banner ativa um filtro local ("mine") que mostra so essas. So admin/adm_campanha veem o banner — publisher recebe `pending_assigned_count = 0` do backend.

No detalhe da NF, admin/adm_campanha veem o nome do responsavel e podem reatribuir via `PATCH /nf/invoices/{id}/assignee` (modal com `<select>` listando admins + adms de campanha; opcao "sem responsavel" zera). Publisher so ve o nome em modo read-only, traduzido como "Reviewer".

## Cadastro em nome do publisher

Admin/adm_campanha podem criar uma NF em nome de outro publisher: o form `/invoice/new` exige a selecao do publisher num `<select>` no topo (lista vem de `GET /nf/users` filtrada por `nf_role === "publisher"`) e envia `publisher_id` no FormData do `POST /nf/invoices`. Se nao houver publisher cadastrado, o form mostra um warning com link pra `/admin/usuarios-nf` e desabilita o submit. O detalhe da NF distingue **publisher** (parceiro/fornecedor, `publisher_id`/`publisher_name`) de **submitted_by** (quem cadastrou), exibindo a linha discreta "Cadastrado por: X" / "Submitted by: X" abaixo do publisher apenas quando `submitted_by !== publisher_id`.

## Controle de acesso

- **Admin do Hub** (`useAuth().isAdmin`) vem de `user.hub_role === "admin"`. Nao tem mais `ADMIN_EMAILS` hardcoded.
- **Acesso ao app NF** e validado pelo `BootstrapGate` (`components/nf/bootstrap-gate.tsx`):
  1. Apos auth, chama `GET /api/v1/hub/me/apps`. Se nao tem slug `nf` -> redireciona pra `app.aeobr.com.br?reason=no_access_nf`.
  2. Se tem app, chama `GET /api/v1/nf/me/role`. Se a resposta for `role: null` -> tela "Sem perfil no NF, fale com admin".
  3. Caso ok, expoe o papel via `useNfRole()` pra arvore inteira.
- Cache em memoria por sessao, limpo no logout.

## Como rodar (local)

```bash
cp .env.example .env.local
# preencha as variaveis
npm install
npm run dev
```

App em http://localhost:3000.

## Deploy

Vercel detecta o repo e builda. Dominio `nf.aeobr.com.br` ja configurado.

Env vars na Vercel:
- `NEXT_PUBLIC_API_URL` — `https://trk.aeobr.com.br/api/v1`
- `NEXT_PUBLIC_HUB_URL` — `https://app.aeobr.com.br`

## Helpers reaproveitados do Tracker

- `lib/api.ts`, `lib/auth-context.tsx`, `lib/config.ts`, `lib/toast-context.tsx`
- `components/status-badge.tsx`

Quando o terceiro app evoluir, vale extrair pra um pacote `@caracol/ui` compartilhado.
