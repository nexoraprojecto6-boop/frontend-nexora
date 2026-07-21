import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useLoader } from '../context/LoaderContext'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { inputStyle, labelStyle, errorTextStyle } from '../lib/glass'
import derivLogo from './deriv-assets/deriv-logo.png'

// ---------------------------------------------------------------------------
// Bandeiras (apenas visual — não altera nenhuma lógica de autenticação/i18n
// já existente. Se um dia quiseres ligar a um sistema de idiomas real, basta
// usar o `activeLang` abaixo).
// ---------------------------------------------------------------------------
const FLAGS = [
  { code: 'ao', emoji: '🇦🇴', label: 'Angola' },
  { code: 'br', emoji: '🇧🇷', label: 'Brasil' },
  { code: 'pt', emoji: '🇵🇹', label: 'Portugal' },
  { code: 'us', emoji: '🇺🇸', label: 'English' },
  { code: 'es', emoji: '🇪🇸', label: 'Español' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const { show, hide } = useLoader() as any // hide pode não existir consoante a versão do contexto
  const { isLocalAuthenticated, isLocalLoading, loginLocal } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeLang, setActiveLang] = useState('ao')

  useEffect(() => {
    if (!isLocalLoading && isLocalAuthenticated) {
      navigate('/connect-deriv')
    }
  }, [isLocalLoading, isLocalAuthenticated])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Preenche o email e a senha.')
      return
    }

    setIsSubmitting(true)
    show('A entrar...')
    try {
      const res = await api.loginLocal(email.trim(), password)
      loginLocal(res.token, res.user)
      navigate('/connect-deriv')
    } catch (err: any) {
      // Credenciais erradas → 401 do backend. Mostramos a mensagem certa
      // em vez de deixar o loader a girar para sempre.
      const msg = err?.message || 'Não foi possível entrar.'
      if (msg.toLowerCase().includes('verific')) {
        navigate('/verify-pending', { state: { email: email.trim() } })
      } else if (msg.includes('401') || msg.toLowerCase().includes('inválid') || msg.toLowerCase().includes('incorret')) {
        setError('Email ou senha incorretos.')
      } else {
        setError(msg)
      }
    } finally {
      setIsSubmitting(false)
      try { hide?.() } catch { /* opcional, LoaderContext pode não ter hide() */ }
    }
  }

  const handleForgotPassword = () => {
    alert('Recuperação de senha em breve. Por agora, contacta o suporte via WhatsApp para reativar o acesso.')
  }

  if (isLocalLoading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid var(--blue-hi)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={pageWrapStyle}>
      {/* Fundo total em vidro, com reflexo fosco tipo gráfico de trading */}
      <GlassChartBackground />

      {/* Bandeiras — topo, centradas na horizontal */}
      <div style={flagsRowStyle}>
        {FLAGS.map((f) => (
          <button
            key={f.code}
            type="button"
            title={f.label}
            aria-label={f.label}
            onClick={() => setActiveLang(f.code)}
            style={flagBtnStyle(activeLang === f.code)}
          >
            <span style={{ fontSize: 17, lineHeight: 1 }}>{f.emoji}</span>
          </button>
        ))}
      </div>

      {/* Cartão de login — liso, sem moldura */}
      <div className="card fade-in" style={cardStyle}>
        <div style={{ textAlign: 'center' }}>
          <h1 className="logo-text" style={{ fontSize: 30, marginBottom: 4, fontWeight: 700, letterSpacing: 0.5 }}>NEXORA FOREX</h1>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 26 }}>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle} htmlFor="email">Email</label>
            <input
              id="email" type="email" autoComplete="email" style={cleanInputStyle}
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="teu@email.com" disabled={isSubmitting}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle} htmlFor="password">Senha</label>
            <input
              id="password" type="password" autoComplete="current-password" style={cleanInputStyle}
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" disabled={isSubmitting}
            />
          </div>

          <div style={{ textAlign: 'right', marginBottom: 22 }}>
            <button type="button" onClick={handleForgotPassword} style={linkBtnStyle}>
              Esqueci a senha
            </button>
          </div>

          {error && <p style={{ ...errorTextStyle, marginBottom: 16, textAlign: 'center' }}>{error}</p>}

          <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ width: '100%' }}>
            {isSubmitting ? 'A entrar...' : 'Entrar'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '26px 0' }}>
          <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          <p style={{ color: 'var(--text-faint)', fontSize: 12 }}>Não tem conta?</p>
          <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link to="/register" style={{ color: 'var(--blue-hi)', fontSize: 14, fontWeight: 600 }}>
            Criar conta
          </Link>
        </div>

        <div style={{ marginTop: 30, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-faint)', fontSize: 11 }}>© 2026 Nexora Forex</p>
        </div>

        {/* Badge / logótipo da Deriv — no final de tudo */}
        <div style={derivBadgeStyle}>
          <div style={derivLogoBoxStyle}>
            <img
              src={derivLogo}
              alt="Deriv"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
            />
          </div>
          <span style={{ fontSize: 10.5, color: 'var(--text-faint)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
            From Deriv API
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fundo de vidro com reflexo de gráfico (puramente decorativo)
// ---------------------------------------------------------------------------
function GlassChartBackground() {
  return (
    <>
      <style>{`
        @keyframes nexora-drift {
          0%   { transform: translate3d(0, 0, 0) scale(1); }
          50%  { transform: translate3d(-1.5%, 1%, 0) scale(1.03); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes nexora-sheen {
          0%   { opacity: 0.35; }
          50%  { opacity: 0.6; }
          100% { opacity: 0.35; }
        }
      `}</style>

      {/* base escura em vidro */}
      <div style={{
        position: 'fixed', inset: 0,
        background: 'linear-gradient(160deg, #05070c 0%, #0a0e17 45%, #05070c 100%)',
        zIndex: 0,
      }} />

      {/* reflexo de gráfico, fosco, tipo água/vidro */}
      <svg
        viewBox="0 0 1200 800"
        preserveAspectRatio="none"
        style={{
          position: 'fixed', inset: 0, width: '100%', height: '100%',
          filter: 'blur(22px)', opacity: 0.5, zIndex: 0,
          animation: 'nexora-drift 22s ease-in-out infinite',
        }}
      >
        <defs>
          <linearGradient id="nexoraLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(24,87,255,0)" />
            <stop offset="45%" stopColor="rgba(24,87,255,0.55)" />
            <stop offset="70%" stopColor="rgba(233,32,63,0.4)" />
            <stop offset="100%" stopColor="rgba(24,87,255,0)" />
          </linearGradient>
          <linearGradient id="nexoraFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(24,87,255,0.18)" />
            <stop offset="100%" stopColor="rgba(24,87,255,0)" />
          </linearGradient>
        </defs>

        <path
          d="M0,520 L60,500 L120,540 L180,470 L240,510 L300,430 L360,460 L420,380 L480,420 L540,340 L600,390 L660,300 L720,350 L780,260 L840,300 L900,230 L960,270 L1020,200 L1080,240 L1140,180 L1200,220"
          fill="none" stroke="url(#nexoraLine)" strokeWidth="3"
        />
        <path
          d="M0,520 L60,500 L120,540 L180,470 L240,510 L300,430 L360,460 L420,380 L480,420 L540,340 L600,390 L660,300 L720,350 L780,260 L840,300 L900,230 L960,270 L1020,200 L1080,240 L1140,180 L1200,220 L1200,800 L0,800 Z"
          fill="url(#nexoraFill)"
        />
      </svg>

      {/* véu de vidro por cima de tudo — dá o efeito "vidro limpo" */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1,
        background: 'radial-gradient(circle at 50% 20%, rgba(255,255,255,0.05), transparent 60%)',
        backdropFilter: 'blur(0.5px)',
        animation: 'nexora-sheen 8s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------
const pageWrapStyle: React.CSSProperties = {
  position: 'relative', minHeight: '100dvh',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16, overflow: 'hidden',
}

const flagsRowStyle: React.CSSProperties = {
  position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
  display: 'flex', gap: 10, zIndex: 20,
}

const flagBtnStyle = (active: boolean): React.CSSProperties => ({
  width: 34, height: 34, borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)',
  backdropFilter: 'blur(10px)',
  border: 'none',
  cursor: 'pointer', transition: 'all 0.2s ease',
  boxShadow: active ? '0 0 0 3px rgba(24,87,255,0.15)' : 'none',
})

const cardStyle: React.CSSProperties = {
  position: 'relative', zIndex: 10,
  width: '100%', maxWidth: 400,
  padding: '48px 36px 36px',
  borderRadius: 28,
  border: 'none',
  boxShadow: 'none',
  background: 'rgba(255,255,255,0.035)',
  backdropFilter: 'blur(28px) saturate(150%)',
  WebkitBackdropFilter: 'blur(28px) saturate(150%)',
}

const derivBadgeStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
  marginTop: 28,
}

const derivLogoBoxStyle: React.CSSProperties = {
  width: 56, height: 56, borderRadius: 12, overflow: 'hidden',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent',
  border: 'none',
}

const cleanInputStyle: React.CSSProperties = {
  ...inputStyle,
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 0,
  padding: '10px 2px',
}

const linkBtnStyle: React.CSSProperties = {
  color: 'var(--text-faint)', fontSize: 12.5,
  background: 'none', border: 'none', cursor: 'pointer',
}
