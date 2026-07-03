# BJJ Flow

Plataforma de jiu-jitsu com dois produtos que compartilham o mesmo backend e banco de dados:

- **App do atleta** (mobile) — treinos, check-ins, graduações, social.
- **CRM da academia** (desktop web) — alunos, pagamentos, turmas, frequência e hardware de acesso (catraca, biometria).

## Estrutura

```
backend/   Java 21 + Spring Boot 4 · PostgreSQL (prod) / H2 (dev) · Flyway
desktop/   CRM web · Vite + React 18 + TypeScript + Tailwind CSS 4
mobile/    App do atleta · React Native (Expo) + TypeScript
```

## Rodando em desenvolvimento

Backend (porta **8090**):

```
cd backend
.\mvnw.cmd spring-boot:run
```

CRM desktop (porta **5180**, com proxy de `/api` para o backend):

```
cd desktop
npm install
npm run dev
```

Detalhes de cada projeto nos READMEs de `backend/` e `desktop/`.
