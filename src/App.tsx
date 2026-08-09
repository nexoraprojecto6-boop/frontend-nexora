// ============================================================
// NEXORA FOREX — App Root
//
// Providers globais (Auth, Trading, Loader) ficam aqui.
// BotsProvider NÃO está aqui para as rotas gerais — está apenas
// dentro do DashboardPage. Isso evita que o WebSocket abra antes
// do login.
//
// ALTERAÇÃO (Operar Manual): a rota /operar-manual precisa do
// BotsProvider (para o manualBuy), por isso é envolvida
// localmente, só nessa rota — sem afetar o comportamento das
// restantes.
// ============================================================
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { TradingProvider } from './context/TradingContext'
import { LoaderProvider } from './context/LoaderContext'
import { BotsProvider } from './context/BotsContext'
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
              <Route
                path="/operar-manual"
                element={
                  <BotsProvider>
                    <OperarManualPage />
                  </BotsProvider>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </TradingProvider>
        </LoaderProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
