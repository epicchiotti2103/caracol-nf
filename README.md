# Caracol NF

Sistema interno de controle de notas fiscais da Caracol.

Faz parte da suite Caracol — entrada pelo [Hub](https://github.com/epicchiotti2103/caracol-hub).

## Status: esqueleto inicial

UI montada, login conectado ao mesmo Supabase Auth do Tracker. Backend de NF ainda **nao existe** — vai ser construido depois.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- js-cookie para sessao
- Mesma API de autenticacao do Tracker (`/api/v1/auth/login`)

## Telas criadas

- `/` — Dashboard com KPI cards placeholder
- `/notas` — Lista de NFs (placeholder)
- `/emitentes` — Lista de emitentes (placeholder)
- `/login` — Login conectado ao Supabase
- Sidebar com link "Voltar ao hub"

## Como rodar (Codespaces ou local)

```bash
cp .env.example .env.local
# preencha as variaveis
npm install
npm run dev
```

App em http://localhost:3000.

## Proximos passos

1. **Definir modelo de dados** — quais campos da NF guardar (numero, emitente, destinatario, valor, vencimento, status, XML, etc).
2. **Criar tabelas no Supabase** — pode ser na mesma instancia do Tracker (basta nao colidir nomes) ou em projeto separado.
3. **Backend FastAPI** — pode ser uma rota nova no backend do Tracker ou um servico separado. Sugestao: comecar dentro do mesmo backend para reusar auth, e separar depois se crescer.
4. **Integracao com SEFAZ / emissor** — pra emitir NFe real eventualmente (ou so cadastrar manualmente no inicio).

## Deploy

Vercel detecta o repo e builda. Configurar dominio `nf.aeobr.com.br` apontando para o projeto.

Env vars necessarias na Vercel:
- `NEXT_PUBLIC_API_URL` — `https://trk.aeobr.com.br/api/v1`
- `NEXT_PUBLIC_HUB_URL` — `https://app.aeobr.com.br`

## Helpers reaproveitados do Tracker

- `lib/api.ts`, `lib/auth-context.tsx`, `lib/config.ts`, `lib/toast-context.tsx`, `lib/use-table-state.ts`
- `components/app-shell.tsx` (adaptado), `components/ui.tsx`, `components/table-controls.tsx`

Quando o terceiro app aparecer, vale a pena extrair esses arquivos pra um pacote `@caracol/ui` compartilhado.
