import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IoCheckmark,
  IoArrowForward,
  IoShieldCheckmarkOutline,
  IoEyeOffOutline,
  IoKeyOutline,
  IoLockClosedOutline,
} from 'react-icons/io5'
import { useLoader } from '../context/LoaderContext'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

// ---------------------------------------------------------------------------
// Marca — mesmo logótipo do ecrã de login
// ---------------------------------------------------------------------------
function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" className="brand-mark">
      <path d="M14 1L27 14L14 27L1 14L14 1Z" stroke="url(#nxGradConnect)" strokeWidth="1.6" />
      <path d="M8 16.5L11.5 12L15 15.5L20 9" stroke="url(#nxGradConnect)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="nxGradConnect" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="0.55" stopColor="var(--blue-hi)" />
          <stop offset="1" stopColor="var(--red-hi)" />
        </linearGradient>
      </defs>
    </svg>
  )
}

const STEPS = [
  { label: 'Conta Nexora', state: 'done' as const },
  { label: 'Ligar Deriv', state: 'active' as const },
  { label: 'Negociar', state: 'todo' as const },
]

const TRUST = [
  {
    Icon: IoShieldCheckmarkOutline,
    title: 'Autorização oficial da Deriv',
    text: 'A ligação é feita no site da própria Deriv, através de login autorizado.',
  },
  {
    Icon: IoEyeOffOutline,
    title: 'A tua senha nunca passa por nós',
    text: 'Introduzes as credenciais apenas na Deriv. A Nexora não as vê nem as guarda.',
  },
  {
    Icon: IoKeyOutline,
    title: 'Tu manténs o controlo',
    text: 'Podes revogar o acesso da Nexora a qualquer momento nas definições da tua conta Deriv.',
  },
]

export default function ConnectDerivPage() {
  const navigate = useNavigate()
  const { show } = useLoader()
  const { isLocalAuthenticated, isLocalLoading, isAuthenticated } = useAuth()
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    if (!isLocalLoading && !isLocalAuthenticated) {
      navigate('/')
      return
    }
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isLocalLoading, isLocalAuthenticated, isAuthenticated])

  const handleConnect = async () => {
    setIsConnecting(true)
    show('A ligar à Deriv...')
    try {
      const { authUrl } = await api.startLogin()
      window.location.href = authUrl
    } catch (err) {
      console.error('[ConnectDeriv] error:', err)
      setIsConnecting(false)
    }
  }

  const handleCreateDerivAccount = async () => {
    show('A abrir registo Deriv...')
    try {
      const { authUrl } = await api.startLogin('registration')
      window.location.href = authUrl
    } catch (err) {
      console.error('[ConnectDeriv] register error:', err)
    }
  }

  return (
    <div style={pageStyle}>
      <style>{CONNECT_CSS}</style>

      {/* Fundo: gradiente + grelha + brilho azul */}
      <div style={bgBaseStyle} />
      <div className="cd-grid" style={bgGridStyle} />
      <div className="cd-glow" style={bgGlowStyle} />

      <div className="fade-in" style={wrapStyle}>
        {/* Cabeçalho da marca */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div className="brand" style={{ justifyContent: 'center' }}>
            <BrandMark size={34} />
            <span className="brand-text brand-text--md">NEXORA FOREX</span>
          </div>
        </div>

        {/* Painel principal */}
        <div style={panelStyle}>
          <div style={panelAccentStyle} />

          {/* Progresso */}
          <div style={stepsRowStyle}>
            {STEPS.map((s, i) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={stepDotStyle(s.state)}>
                    {s.state === 'done' ? <IoCheckmark size={13} /> : i + 1}
                  </span>
                  <span style={{
                    fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                    color: s.state === 'todo' ? 'var(--text-faint)' : 'var(--text)',
                  }}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <span style={{
                    flex: 1, height: 1, margin: '0 10px', minWidth: 10,
                    background: s.state === 'done' ? 'var(--green)' : 'var(--border-hi)',
                    opacity: s.state === 'done' ? 0.6 : 1,
                  }} />
                )}
              </div>
            ))}
          </div>

          {/* Título */}
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <h1 style={{ fontSize: 24, color: 'var(--white)', marginBottom: 10 }}>
              Liga a tua conta Deriv
            </h1>
            <p style={{ color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.65 }}>
              A tua conta Nexora já está ativa. Falta um passo para começares a negociar:
              autorizar a ligação à tua conta Deriv.
            </p>
          </div>

          {/* Garantias */}
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {TRUST.map(({ Icon, title, text }) => (
              <div key={title} style={trustItemStyle}>
                <span style={trustIconStyle}>
                  <Icon size={18} />
                </span>
                <div>
                  <p style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{title}</p>
                  <p style={{ color: 'var(--text-faint)', fontSize: 12, lineHeight: 1.55 }}>{text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Ação principal */}
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="btn-primary cd-cta"
            style={{ width: '100%', minHeight: 48, marginTop: 26, fontSize: 15 }}
          >
            {isConnecting ? (
              <>
                <span style={spinnerStyle} />
                A ligar...
              </>
            ) : (
              <>
                Conectar à Deriv
                <IoArrowForward size={18} />
              </>
            )}
          </button>

          {/* Separador */}
          <div style={dividerStyle}>
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ color: 'var(--text-faint)', fontSize: 11, letterSpacing: 0.4 }}>OU</span>
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Ação secundária */}
          <button
            onClick={handleCreateDerivAccount}
            disabled={isConnecting}
            className="btn-ghost"
            style={{ width: '100%', minHeight: 44, fontSize: 13.5, fontWeight: 600 }}
          >
            Ainda não tens conta na Deriv? Criar agora
          </button>
        </div>

        {/* Rodapé de confiança */}
        <div style={footerStyle}>
          <IoLockClosedOutline size={13} />
          <span>Ligação segura e encriptada</span>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 11, marginTop: 6 }}>
          © 2026 Nexora Forex
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CSS local
// ---------------------------------------------------------------------------
const CONNECT_CSS = `
  @keyframes cd-glow-pulse {
    0%, 100% { opacity: 0.55; transform: translateX(-50%) scale(1); }
    50%      { opacity: 0.85; transform: translateX(-50%) scale(1.06); }
  }
  @keyframes cd-grid-drift {
    from { background-position: 0 0, 0 0; }
    to   { background-position: 40px 40px, 40px 40px; }
  }
  .cd-glow { animation: cd-glow-pulse 7s ease-in-out infinite; }
  .cd-grid { animation: cd-grid-drift 18s linear infinite; }
  .cd-cta { box-shadow: 0 8px 24px rgba(37, 99, 235, 0.35); }
  .cd-cta:hover:not(:disabled) { box-shadow: 0 10px 28px rgba(37, 99, 235, 0.5); }
`

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------
const pageStyle: React.CSSProperties = {
  position: 'relative', minHeight: '100dvh',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 'calc(24px + env(safe-area-inset-top, 0px)) 16px calc(24px + env(safe-area-inset-bottom, 0px))',
  overflowX: 'hidden', overflowY: 'auto',
}

const bgBaseStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
  background: 'linear-gradient(160deg, #05070c 0%, #0a0e17 45%, #05070c 100%)',
}

const bgGridStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.5,
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
  backgroundSize: '40px 40px',
  WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, #000 0%, transparent 75%)',
  maskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, #000 0%, transparent 75%)',
}

const bgGlowStyle: React.CSSProperties = {
  position: 'fixed', top: '-18%', left: '50%', transform: 'translateX(-50%)',
  width: 640, height: 640, borderRadius: '50%', zIndex: 0, pointerEvents: 'none',
  background: 'radial-gradient(circle, rgba(37,99,235,0.22) 0%, transparent 70%)',
}

const wrapStyle: React.CSSProperties = {
  position: 'relative', zIndex: 10, width: '100%', maxWidth: 440,
}

const panelStyle: React.CSSProperties = {
  position: 'relative', overflow: 'hidden',
  padding: 'clamp(22px, 5vw, 32px) clamp(18px, 5vw, 28px)',
  background: 'rgba(15,18,23,0.86)',
  border: '1px solid var(--border-hi)',
  borderRadius: 8,
  boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
}

const panelAccentStyle: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0, right: 0, height: 2,
  background: 'linear-gradient(90deg, transparent 0%, var(--blue-hi) 50%, transparent 100%)',
}

const stepsRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
}

const stepDotStyle = (state: 'done' | 'active' | 'todo'): React.CSSProperties => ({
  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
  color: state === 'todo' ? 'var(--text-faint)' : 'var(--white)',
  background:
    state === 'done' ? 'var(--green)' :
    state === 'active' ? 'var(--blue)' : 'transparent',
  border: state === 'todo' ? '1px solid var(--border-hi)' : '1px solid transparent',
  boxShadow: state === 'active' ? '0 0 0 3px var(--blue-glow)' : 'none',
})

const trustItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 12,
  padding: '12px 14px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 6,
}

const trustIconStyle: React.CSSProperties = {
  width: 34, height: 34, flexShrink: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--blue-hi)',
  background: 'rgba(79,139,255,0.1)',
  border: '1px solid rgba(79,139,255,0.25)',
  borderRadius: 6,
}

const spinnerStyle: React.CSSProperties = {
  width: 16, height: 16, borderRadius: '50%',
  border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff',
  animation: 'spin 0.8s linear infinite',
}

const dividerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0',
}

const footerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  marginTop: 18, color: 'var(--text-faint)', fontSize: 12,
}
