# Caracol NF

Sistema interno de controle de notas fiscais da Caracol.

Faz parte da suite Caracol — entrada pelo [Hub](https://github.com/epicchiotti2103/caracol-hub).

## Status: funcional (fase 1)

CRUD de invoices funcionando, com upload de PDF, papeis intra-NF (publisher / adm_campanha / admin), **workflow de aprovacao dupla** (adm_campanha + admin → aprovada → paga, com `recusada` apenas em `em_analise`), dashboard com chips no topo (pendentes / a pagar / vencidas, com hovercard de preview) e timeline de eventos no detalhe da NF. Backend vive no Tracker em `tracker-caracol/backend/app/routes/nf.py` (rotas `/api/v1/nf/*`).

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- js-cookie para sessao
- Mesma API de autenticacao do Tracker (`/api/v1/auth/login`)

## Telas

- `/login` — login conectado ao Supabase Auth (via API do Tracker)
- `/` — lista de notas fiscais (renderizacao diferente por papel; titulo, colunas e botoes adaptam)
- `/invoice/new` — formulario de cadastro de NF com upload de PDF (form bilingual: ingles pra publisher, portugues pros outros). Admin/adm_campanha veem um **toggle "Vincular a"**: a NF a pagar pode ser amarrada a um **Publisher (usuario)** num `<select>` (alimentado por `GET /nf/users` filtrado por `nf_role === "publisher"`) OU a um **Fornecedor cadastrado** (`<select>` de `GET /suppliers?active=true`, entidade sem login). Exatamente um dos dois e obrigatorio; o form envia `publisher_id` OU `supplier_id` no FormData do `POST /nf/invoices`. Publisher cadastra direto pra si (sem toggle). Campo **Moeda** (BRL/USD, default BRL) ao lado do Valor; prefix `R$` ou `US$` alterna conforme selecao.
- `/invoice/[id]` — detalhe com auditoria das 2 aprovacoes + pagamento, badges `2/2 aprovacoes` e `Vencida ha N dias`, acoes condicionais por papel (incluindo modal de "designar pagador" quando admin completa a dupla), painel de notas e **timeline de eventos** (`GET /nf/invoices/{id}/events`)
- `/admin/clientes` — cadastro de clientes (entidades que recebem NF a receber). Apenas admin cria/edita; admin e adm_campanha visualizam. CRUD via `/clients`.
- `/admin/fornecedores` — cadastro de fornecedores (entidades que emitem NF a pagar, sem login no sistema). Mesma UI/permissoes dos clientes; CRUD via `/suppliers`. Usado pra vincular NF a Pagar a um fornecedor quando nao ha publisher/usuario correspondente.
- `/admin/usuarios-nf` — gestao de papeis intra-NF (apenas admin)

No dashboard `/`, admins e adm_campanha veem **3 chips no topo** (pendentes / a pagar / vencidas). Cada chip abre um hovercard (com fallback de clique no mobile) listando ate 5 NFs do balde + link "ver todas" que aplica o filtro. Admin tambem ve 3 stat cards abaixo dos chips — os de **A pagar** e **Pagas (30d)** mostram total em **R$** e **US$** em duas linhas (`to_pay_brl`/`to_pay_usd`, `paid_last_30d_brl`/`paid_last_30d_usd`).

A logo Caracol no header e clicavel e volta pro Hub.

## Papeis intra-NF

Sao definidos numa tabela do backend e expostos por `GET /api/v1/nf/me/role`. O `BootstrapGate` resolve o papel apos confirmar o acesso ao app `nf` e cacheia em memoria pra sessao.

| Papel | Pode | Idioma da UI |
|---|---|---|
| `publisher` | Criar e ver as proprias NFs | Ingles |
| `adm_campanha` | Ver todas NFs, aprovar/recusar `em_analise` | Portugues |
| `admin` | Tudo do adm_campanha + marcar `aprovada` como `paga` + recusa pos-aprovacao + gerir papeis | Portugues |

Sem papel definido, o gate mostra "Seu perfil no NF nao foi configurado".

## Workflow de status (aprovacao dupla)

```
em_analise --(approve x2: adm_campanha + admin)--> aprovada --(pay, admin)--> paga
     |
     +--(reject + reason)--> recusada
```

Toda NF em `em_analise` precisa de DUAS aprovacoes: uma do `adm_campanha` e outra do `admin` (ordem nao importa). Os endpoints novos sao:

- `POST /nf/invoices/{id}/approve` — body opcional `{paid_by_assignee_id}`. Backend detecta o papel do caller e popula a coluna correta.
- `POST /nf/invoices/{id}/reject` — body `{reason, notes_internal?}`. So funciona em `em_analise`.
- `POST /nf/invoices/{id}/pay` — admin only. **Multipart/form-data** com campo `proof` obrigatorio (PNG, JPEG ou PDF, max 10MB). UI abre modal com upload antes de confirmar; backend grava `paid_proof_path` no storage.

Quando o admin completa a dupla, a UI abre um modal "Aprovar NF #X" com a opcao opcional **Designar pagador** (dropdown de admins). Se preenchido, a NF fica com `paid_by_assignee_id`/`paid_by_assignee_name` setados e o detalhe exibe "Pagador designado: Nome". Qualquer admin ainda pode pagar; e so um sinal de fluxo.

Ao marcar como paga, o admin abre um modal de upload e anexa o **comprovante de pagamento** (PNG/JPEG/PDF, max 10MB). O backend grava `paid_proof_path` e o detalhe ganha um botao "Baixar comprovante" que abre uma URL assinada (`GET /nf/invoices/{id}/proof`).

Campos de auditoria: `approval_adm_campanha_by/at`, `approval_admin_by/at`, `paid_by/at`, `paid_by_assignee_id`. Notas em 2 campos (`notes_supplier`, `notes_internal`) seguem como antes, editaveis via `PATCH /nf/invoices/{id}/notes`.

Campos derivados retornados em `GET /nf/invoices*`: `is_vencida` (bool), `days_overdue` (number), `approvals_pending` (array com slots faltantes).

## Responsavel pela NF

Cada NF tem um campo opcional `assignee_id` (preenchido automaticamente no `POST /invoices` por um adm_campanha aleatorio, com fallback pra admin). Quem esta listado como responsavel ve, no topo da lista, um banner laranja "Voce tem N NFs aguardando voce" enquanto houver NFs `em_analise` atribuidas a ele. Clicar no banner ativa um filtro local ("mine") que mostra so essas. So admin/adm_campanha veem o banner — publisher recebe `pending_assigned_count = 0` do backend.

No detalhe da NF, admin/adm_campanha veem o nome do responsavel e podem reatribuir via `PATCH /nf/invoices/{id}/assignee` (modal com `<select>` listando admins + adms de campanha; opcao "sem responsavel" zera). Publisher so ve o nome em modo read-only, traduzido como "Reviewer".

## Cadastro em nome de publisher ou fornecedor

Admin/adm_campanha podem criar uma NF a pagar vinculada a **um Publisher (usuario)** OU a **um Fornecedor cadastrado** — toggle "Vincular a" no topo do form `/invoice/new`. Na opcao Publisher, o `<select>` lista usuarios com `nf_role === "publisher"` (`GET /nf/users`) e o form envia `publisher_id`. Na opcao Fornecedor, o `<select>` lista fornecedores ativos (`GET /suppliers?active=true`) e o form envia `supplier_id`. Exatamente um dos dois e obrigatorio (o backend valida). Quando a fonte selecionada nao tem registros, o form mostra um warning com link pra `/admin/usuarios-nf` ou `/admin/fornecedores` e desabilita o submit.

Na listagem e no detalhe da NF, a coluna/linha de origem mostra `publisher_name` quando ha publisher, com fallback pra `supplier_name` quando a NF foi vinculada a um fornecedor. O detalhe tambem distingue **publisher/fornecedor** (a fonte da NF) de **submitted_by** (quem cadastrou), exibindo "Cadastrado por: X" abaixo apenas quando `submitted_by !== publisher_id`. O modal de edicao (`/invoice/[id]`, NFs em `em_analise`) tem o mesmo toggle, permitindo trocar de publisher pra fornecedor e vice-versa.

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
