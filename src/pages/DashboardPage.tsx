import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTrading } from '../context/TradingContext'
import { BotsProvider } from '../context/BotsContext'
import { ChartSection } from '../components/ChartSection'
import { BalanceCard } from '../components/BalanceCard'
import { ControlsSection } from '../components/ControlsSection'
import { TradesTable } from '../components/TradesTable'
import { Footer } from '../components/Footer'
import { useLoader } from '../context/LoaderContext'

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
  const { isLoading: authLoading } = useAuth()
  const { isConnected } = useTrading()
  const { show, complete } = useLoader()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { show('A redirecionar...'); navigate('/'); return }
    if (!authLoading) complete('Pronto!')
  }, [authLoading])

  if (authLoading) return <DashboardLoader />

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── Header ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="logo-text" style={{ fontSize: 16 }}>NEXORA FOREX</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={`dot ${isConnected ? 'live' : 'off'}`} />
            <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: isConnected ? 'var(--text-faint)' : 'var(--red-hi)', display: 'none' }} className="sm-show">
              {isConnected ? 'live' : 'offline'}
            </span>
          </div>
        </div>
        <button onClick={() => { show('A carregar...'); navigate('/menu') }}
          style={{ color: 'var(--green)', fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>
          MENU
        </button>
      </header>

      {/* ── Desktop layout (≥1024px): chart+controls à esquerda, trades à direita ── */}
      <main style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {/* Coluna esquerda */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 16px', gap: 12, overflowY: 'auto', minWidth: 0 }}>
          <ChartSection />
          <BalanceCard />
          <ControlsSection />
          <Footer />
        </div>
        {/* Coluna direita — trades table (só desktop) */}
        <div style={{ width: 380, flexShrink: 0, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <TradesTable />
        </div>
      </main>

      <style>{`
        @media (max-width: 1023px) {
          main { flex-direction: column !important; }
          main > div:last-child { width: 100% !important; border-left: none !important; border-top: 1px solid var(--border) !important; min-height: 220px !important; max-height: 280px !important; }
        }
        .sm-show { display: inline !important; }
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
