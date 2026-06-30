# NEXORA FOREX — Frontend

Frontend React + Vite do projeto Nexora Forex. Liga ao backend
Express/WebSocket existente em `banckend-nexora.onrender.com`.

## Stack

- **React 18** + **TypeScript** (sem Next.js — React puro + Vite)
- **react-router-dom v6** — SPA routing
- **Vite** — build e dev server
- **Express** — serve o build em produção (SPA routing)
- **Chart.js** — gráfico de dígitos (sem WS própria à Deriv)

## Estrutura

```
src/
  lib/          # tipos, env, API client
  context/      # AuthContext, TradingContext, BotsContext, LoaderContext
  hooks/        # useNexoraWs (WebSocket com reconexão robusta)
  components/   # BalanceCard, ChartSection, ControlsSection, TradesTable, Footer
  pages/        # LoginPage, CallbackPage, DashboardPage, MenuPage
  styles/       # index.css (design tokens + utilitários)
```

## Desenvolvimento local

```bash
cp .env.example .env.local
# editar .env.local com os valores reais

npm install
npm run dev
# http://localhost:5173
```

## Deploy no Render

1. Criar novo **Web Service** no Render
2. Ligar ao repositório GitHub
3. Em **Settings → Environment Variables**, adicionar:
   - `VITE_API_URL` = `https://banckend-nexora.onrender.com`
   - `VITE_DERIV_APP_ID` = (o teu App ID da Deriv)
4. **Build Command**: `npm install && npm run build`
5. **Start Command**: `node server.js`

O `render.yaml` já tem tudo configurado — se o Render o
detectar automaticamente, só precisas de definir as env vars.

## Correcções vs versão Next.js anterior

| Bug antigo | Correcção aqui |
|---|---|
| `wss://https://...` URL duplicada | `env.ts` deriva WS URL automaticamente do API URL |
| `ChartSection` abria WS própria para a Deriv | Consome dados do `TradingContext` (backend via BotsProvider) |
| `BotsProvider` montado globalmente (login, menu…) | Apenas em `DashboardPage` — WS só abre quando logado no dashboard |
| `authLimiter` bloqueava logins (5 req/15min) | Corrigido no backend — este frontend não altera o backend |
| `loading` ficava `true` para sempre se WS falhasse | `LOADING_SAFETY_TIMEOUT_MS = 8000` garante que o loader termina |
| StrictMode causava double-mount do WS | `StrictMode` removido do `main.tsx` |
