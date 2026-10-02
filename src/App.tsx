// ============================================================
// NEXORA FOREX — App Root
//
// Providers globais (Auth, Trading, Loader) ficam aqui.
// BotsProvider NÃO está aqui para as rotas gerais — cada página
// que precisa dele (Dashboard, OperarManual) monta o seu próprio
// <BotsProvider/> internamente. Isso evita que o WebSocket abra
// antes do login e evita dois BotsProvider aninhados na mesma
// árvore, que abriam DUAS ligações WS para a mesma conta e
// entravam num ciclo de reconexão infinito ("sessão duplicada").
//
// Entrada: o ecrã "/" (LoginPage) aceita email + senha e cria a
// conta automaticamente se o email for novo. Não há página de
// registo; /register redireciona para "/".
// ============================================================
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { TradingProvider } from './context/TradingContext'
import { LoaderProvider } from './context/LoaderContext'
import LoginPage from './pages/LoginPage'
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
              <Route path="/register" element={<Navigate to="/" replace />} />
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
