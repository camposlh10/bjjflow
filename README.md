# BJJ Flow CRM — Desktop (Web)

Painel de gestão para academias, construído em React + TypeScript. Consome o backend
Spring Boot (`bjj-flow-backend`) — o mesmo banco de dados do aplicativo mobile.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS 4 (tema escuro)
- TanStack Query (estado de servidor) + React Router
- Recharts (gráfico de receita)

## Rodando

1. Suba o backend (porta 8090):

   ```
   cd ..\bjj-flow-backend\backend
   .\mvnw.cmd spring-boot:run
   ```

2. Suba o frontend:

   ```
   npm install
   npm run dev
   ```

   Acesse http://localhost:5180 — o Vite faz proxy de `/api` para `http://localhost:8090`.

## Funcionalidades

- **Login / registro** — cria a conta do proprietário e a academia direto pelo CRM.
- **Dashboard** — receita (série diária real via `/crm/payments/revenue-series`),
  alunos, turmas, check-ins, inadimplência, turmas de hoje e últimas faturas.
- **Pagamentos** (somente proprietário) — planos recorrentes, geração de faturas,
  baixa manual com forma de pagamento (PIX, dinheiro, cartão…), cancelamento.
- **Alunos** — lista e perfil do atleta (faixa, presenças, financeiro),
  credenciais de acesso (cartão / digital / QR) para a catraca.
- **Turmas** — grade semanal com professores e modalidades.
- **Frequência** — presenças de hoje, marcação manual e fila de revisão dos
  eventos de hardware não resolvidos.
- **Dispositivos** — registro de catracas/leitores com chave de API
  (exibida uma única vez), troca de chave e desativação.
- **Configurações** — dados da academia compartilhados com o app + código de convite.
- Notificações, Relatórios e Integrações: páginas reservadas (backend ainda não possui esses módulos).
