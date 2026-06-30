// ============================================================
// NEXORA FOREX — App Root
//
// Providers globais (Auth, Trading, Loader) ficam aqui.
// BotsProvider NÃO está aqui — está apenas dentro do
// DashboardPage. Isso evita que o WebSocket abra antes do
// login, desperdiçando sessões no backend e causando loops de
// reconexão em rotas que não precisam de dados de trading.
// ============================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { TradingProvider } from './context/TradingContext'
import { LoaderProvider } from './context/LoaderContext'
import LoginPage from './pages/LoginPage'
import CallbackPage from './pages/CallbackPage'
import DashboardPage from './pages/DashboardPage'
import MenuPage from './pages/MenuPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LoaderProvider>
          <TradingProvider>
            <Routes>
              <Route path="/" element={<LoginPage />} />
              <Route path="/callback" element={<CallbackPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </TradingProvider>
        </LoaderProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
