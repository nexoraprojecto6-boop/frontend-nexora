// ============================================================
// NEXORA FOREX — App Root
//
// Providers globais (Auth, Trading, Loader) ficam aqui.
// BotsProvider NÃO está aqui para as rotas gerais — cada página
// que precisa dele (Dashboard, OperarManual) monta o seu próprio
// <BotsProvider/> internamente. Isso evita que o WebSocket abra
// antes do login, e evita — CORREÇÃO — dois BotsProvider
// aninhados na mesma árvore, que abriam DUAS ligações WS para a
// mesma conta e entravam num ciclo de reconexão infinito (cada
// uma matava a outra via "sessão duplicada", que reconectava e
// matava a primeira, sem nunca estabilizar — via disso no log:
// "[WS] Sessão duplicada detectada" a repetir a cada poucos
// segundos, sem fim).
//
// CORREÇÃO (Operar Manual): a rota /operar-manual NÃO deve
// envolver <OperarManualPage/> com <BotsProvider/> aqui — o
// próprio OperarManualPage.tsx já o faz internamente (mesmo
// padrão do DashboardPage.tsx). Envolver aqui TAMBÉM criava o
// duplo provider acima descrito.
// ============================================================
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { TradingProvider } from './context/TradingContext'
import { LoaderProvider } from './context/LoaderContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ConnectDerivPage from './pages/ConnectDerivPage'
import CallbackPage from './pages/CallbackPage'
import DashboardPage from './pages/DashboardPage'
import MenuPage from './pages/MenuPage'
import AdminPage from './pages/AdminPage'
import VideoLessonsPage from './pages/VideoLessonsPage'
import OperarManualPage from './pages/OperarManualPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LoaderProvider>
          <TradingProvider>
            <Routes>
              <Route path="/" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/connect-deriv" element={<ConnectDerivPage />} />
              <Route path="/callback" element={<CallbackPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/aprender-a-operar" element={<VideoLessonsPage />} />
              {/* OperarManualPage já monta o seu próprio <BotsProvider/>
                  internamente — NÃO envolver aqui outra vez. */}
              <Route path="/operar-manual" element={<OperarManualPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </TradingProvider>
        </LoaderProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
