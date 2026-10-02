import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BotsProvider } from '../context/BotsContext'
import { ChartSection } from '../components/ChartSection'
import { BalanceCard } from '../components/BalanceCard'
import { ControlsSection } from '../components/ControlsSection'
import { TradesTable } from '../components/TradesTable'
import { Footer } from '../components/Footer'
import { NotificationBar } from '../components/NotificationBar'
import NotificationCenterFloating from '../components/NotificationCenterFloating'
import { DepositModal } from '../components/DepositModal'
import { useLoader } from '../context/LoaderContext'
import { useNotifications } from '../hooks/useNotifications'

// Formata "há X min/h/dias" a partir de um timestamp — só usado
// para o campo `time` exibido no modal de notificações.
function formatRelative(ts: number): string {
  const diffMs = Date.now() - ts
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'agora mesmo'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

// Ícone de sino pequeno para o badge sobre o botão MENU
function IconBellSmall() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

// ── DashboardLoader exibido enquanto o auth ainda carrega ─────
function DashboardLoader() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20,
      background: 'rgba(7,11,20,0.97)', backdropFilter: 'blur(10px)',
    }}>
      <h1 className="logo-text" style={{ fontSize: 20 }}>NEXORA FOREX</h1>
      <div style={{ position: 'relative', width: 56, height: 56 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'var(--blue-hi)', borderRightColor: 'rgba(24,87,255,0.15)', animation: 'spin 0.85s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 9, borderRadius: '50%', border: '2px solid transparent', borderBottomColor: 'var(--red-hi)', borderLeftColor: 'rgba(233,32,63,0.15)', animation: 'spin 0.65s linear infinite reverse' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue-hi)', boxShadow: '0 0 12px var(--blue)' }} />
        </div>
      </div>
      <div style={{ width: 140, height: 2, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, var(--red), var(--blue-hi))', animation: 'loadBar 1.4s ease-in-out infinite' }} />
      </div>
      <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-faint)' }}>A carregar...</p>
      <style>{`
        @keyframes loadBar {
          0%   { width: 0%;  margin-left: 0%; }
          50%  { width: 70%; margin-left: 15%; }
          100% { width: 0%;  margin-left: 100%; }
        }
      `}</style>
    </div>
  )
}

// ── Inner usa os contextos que só existem após BotsProvider ───
function DashboardInner() {
  const navigate = useNavigate()
  const { isLoading: authLoading, isLocalAuthenticated } = useAuth()
  const { show, complete } = useLoader()
  const { notifications, hasUnread, markAllRead } = useNotifications()
  const [notifOpen, setNotifOpen] = useState(false)
  const [depositOpen, setDepositOpen] = useState(false)

  // Sem sessão Deriv não há dashboard. Quem já entrou com email/senha
  // vai direto para ligar a Deriv (sem passar pelo ecrã de entrada), e
  // `replace` evita que o botão "voltar" prenda o utilizador num ciclo.
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      show('A redirecionar...')
      navigate(isLocalAuthenticated ? '/connect-deriv' : '/', { replace: true })
      return
    }
    if (!authLoading) complete('Pronto!')
  }, [authLoading])

  if (authLoading) return <DashboardLoader />

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── Aba de notificações — flutua por cima de tudo, estilo vidro ── */}
      <NotificationBar />

      {/* ── Header ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="logo-text" style={{ fontSize: 16 }}>NEXORA FOREX</span>
        </div>

        {/* Botão DEPOSITAR + Botão MENU + sino de notificação sobreposto no canto ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setDepositOpen(true)}
            style={{
              padding: '6px 12px', borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'rgba(24,87,255,0.10)',
              color: 'var(--blue-hi)', fontWeight: 700, fontSize: 12, letterSpacing: 0.5,
              cursor: 'pointer',
            }}
          >
            DEPOSITAR
          </button>

          <div style={{ position: 'relative', display: 'flex' }}>
            <button onClick={() => { show('A carregar...'); navigate('/menu') }}
              style={{ color: 'var(--green)', fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>
              MENU
            </button>
            {hasUnread && (
              <button
                onClick={(e) => { e.stopPropagation(); setNotifOpen(true) }}
                aria-label="Notificações"
                style={{
                  position: 'absolute', top: -9, right: -13, width: 19, height: 19, borderRadius: '50%',
                  background: 'var(--red-hi)', color: '#fff', border: '2px solid var(--bg-elevated)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  cursor: 'pointer', boxShadow: '0 2px 8px rgba(233,32,63,0.5)',
                }}
              >
                <IconBellSmall />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Modal glass de notificações — o gatilho é o sino acima,
          por isso `hideBellTrigger` (não mostra o botão fixo próprio) */}
      <NotificationCenterFloating
        hideBellTrigger
        open={notifOpen}
        onOpenChange={(v) => {
          setNotifOpen(v)
          if (v) markAllRead()
        }}
        notifications={notifications.map((n) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          time: formatRelative(n.createdAt),
        }))}
      />

      {/* Modal glass de depósito/transferência/levantamento — abre no centro do dashboard */}
      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} />

      {/* ── Desktop layout (≥1024px): chart+controls à esquerda, trades à direita ──
          Mobile (<1024px): ordem controlada via CSS (order), ver <style> abaixo.
          Ordem mobile: Chart → Balance → Controls (conexão Deriv) → Trades (rolável) → Footer */}
      <main className="dash-main" style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {/* Coluna esquerda */}
        <div className="dash-left-col" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 16px', gap: 12, overflowY: 'auto', minWidth: 0 }}>
          <div className="dash-chart">
            <ChartSection />
          </div>
          <div className="dash-balance">
            <BalanceCard />
          </div>
          <div className="dash-controls">
            <ControlsSection />
          </div>
          <div className="dash-footer">
            <Footer />
          </div>
        </div>
        {/* Coluna direita — trades table (desktop) / vira card rolável no mobile */}
        <div className="dash-trades" style={{ width: 380, flexShrink: 0, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <TradesTable />
        </div>
      </main>

      <style>{`
        @media (max-width: 1023px) {
          .dash-main {
            flex-direction: column !important;
            gap: 6px;
            padding: 6px 8px;
            overflow-y: auto; /* rede de segurança — só entra em ação se, mesmo compacto, algo não couber */
          }
          .dash-left-col {
            display: contents !important;
          }
          .dash-chart    { order: 1; flex-shrink: 0; }
          .dash-balance  { order: 2; flex-shrink: 0; }
          .dash-controls { order: 3; flex-shrink: 0; }
          .dash-trades   { order: 4; }
          .dash-footer   { order: 5; flex-shrink: 0; }

          .dash-trades {
            width: 100% !important;
            border-left: none !important;
            border-top: 1px solid var(--border) !important;
            flex: 1 1 auto !important;
            min-height: 320px !important;
            max-height: none !important;
          }
        }
        @media (max-width: 1023px) and (max-height: 720px) {
          .dash-trades { min-height: 260px !important; }
        }
        @media (max-width: 480px) {
          .dash-trades { min-height: 150px !important; }
        }
      `}</style>
    </div>
  )
}

// ── BotsProvider apenas no dashboard (não na raiz) ─────────────
export default function DashboardPage() {
  return (
    <BotsProvider>
      <DashboardInner />
    </BotsProvider>
  )
}
