import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useLoader } from '../context/LoaderContext'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { inputStyle, labelStyle, errorTextStyle } from '../lib/glass'

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

// ---------------------------------------------------------------------------
// Termos e Condições — mostrados no modal flutuante depois do login.
// O texto da Nexora fica embutido; o da Deriv só é linkado (é a Deriv quem
// detém e atualiza o próprio documento legal).
// ---------------------------------------------------------------------------
const TERMOS_NEXORA = `TERMOS E CONDIÇÕES — NEXORA FOREX

1. ACEITAÇÃO DOS TERMOS
Ao utilizar a plataforma Nexora Forex, o utilizador aceita integralmente os presentes termos e condições.

2. RISCOS
O trading envolve riscos elevados de perda de capital. Os resultados passados não garantem resultados futuros. O utilizador é o único responsável pelas suas decisões de investimento.

3. RESPONSABILIDADE
A Nexora Forex não se responsabiliza por perdas financeiras resultantes do uso da plataforma.

4. CONTACTO
Para questões, contacte-nos via WhatsApp: +244976289984`

const DERIV_TERMS_URL = 'https://deriv.com/tnc/general-terms.pdf'
const TERMS_ACCEPTED_KEY = 'nexora_terms_accepted_v1'

// ---------------------------------------------------------------------------
// Marca — logótipo 100% em SVG/código, sem ficheiro de imagem (evita
// builds partidos por falta de logo.png e escala em qualquer ecrã).
// ---------------------------------------------------------------------------
function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" className="brand-mark">
      <path d="M14 1L27 14L14 27L1 14L14 1Z" stroke="url(#nxGradLogin)" strokeWidth="1.6" />
      <path d="M8 16.5L11.5 12L15 15.5L20 9" stroke="url(#nxGradLogin)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="nxGradLogin" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="0.55" stopColor="var(--blue-hi)" />
          <stop offset="1" stopColor="var(--red-hi)" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { show, hide } = useLoader() as any // hide pode não existir consoante a versão do contexto
  const { isLocalAuthenticated, isLocalLoading, loginLocal, logout } = useAuth() as any

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeLang, setActiveLang] = useState('ao')
  const [showTerms, setShowTerms] = useState(false)

  // Distingue "já estava autenticado ao abrir a página" (ex: refresh)
  // de "acabou de fazer login agora mesmo, aqui, neste formulário".
  // Sem isto, o useEffect abaixo navega sozinho para /connect-deriv
  // assim que loginLocal() atualiza o contexto — antes do modal de
  // termos ter hipótese de aparecer.
  const justLoggedInRef = useRef(false)

  useEffect(() => {
    if (!isLocalLoading && isLocalAuthenticated && !justLoggedInRef.current) {
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

      // Marca ANTES de atualizar o contexto de auth, para o useEffect
      // não disparar a navegação automática enquanto decidimos aqui
      // se é preciso mostrar o modal de termos primeiro.
      justLoggedInRef.current = true
      loginLocal(res.token, res.user)

      // Depois de autenticar, mostra o modal de Termos e Condições no
      // centro do ecrã antes de avançar — só passa para a próxima página
      // quando o utilizador confirmar que leu e aceita.
      let alreadyAccepted = false
      try { alreadyAccepted = localStorage.getItem(TERMS_ACCEPTED_KEY) === '1' } catch { /* ignora */ }

      try { hide?.() } catch { /* opcional */ }

      if (alreadyAccepted) {
        navigate('/connect-deriv')
      } else {
        setShowTerms(true)
      }
    } catch (err: any) {
      // Credenciais erradas → 401 do backend. Mostramos a mensagem certa
      // em vez de deixar o loader a girar para sempre.
      const msg = err?.message || 'Não foi possível entrar.'
      if (msg.includes('401') || msg.toLowerCase().includes('inválid') || msg.toLowerCase().includes('incorret')) {
        setError('Email ou senha incorretos.')
      } else {
        setError(msg)
      }
      justLoggedInRef.current = false
      try { hide?.() } catch { /* opcional, LoaderContext pode não ter hide() */ }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleForgotPassword = () => {
    alert('Recuperação de senha em breve. Por agora, contacta o suporte via WhatsApp para reativar o acesso.')
  }

  const handleAcceptTerms = () => {
    try { localStorage.setItem(TERMS_ACCEPTED_KEY, '1') } catch { /* ignora */ }
    setShowTerms(false)
    navigate('/connect-deriv')
  }

  const handleDeclineTerms = () => {
    // Sem aceitar os termos não há acesso — termina a sessão local e
    // volta ao ecrã de login.
    setShowTerms(false)
    justLoggedInRef.current = false
    try {
      if (typeof logout === 'function') {
        logout()
      } else {
        localStorage.removeItem('token')
      }
    } catch { /* ignora */ }
    navigate('/login', { replace: true })
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
          <div className="brand" style={{ justifyContent: 'center', marginBottom: 10 }}>
            <BrandMark size={40} />
          </div>
          <h1 className="brand-text brand-text--lg">NEXORA FOREX</h1>
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
      </div>

      {/* Modal flutuante, centrado — Termos e Condições da Nexora e da Deriv,
          exigido logo após o login antes de continuar */}
      {showTerms && <TermsModal onAccept={handleAcceptTerms} onDecline={handleDeclineTerms} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal de Termos e Condições — flutua no centro da página
// ---------------------------------------------------------------------------
function TermsModal({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  const [tab, setTab] = useState<'nexora' | 'deriv'>('nexora')

  return (
    <div className="glass-overlay" style={{ zIndex: 900 }}>
      <div className="glass-sheet" style={{ maxWidth: 460 }}>
        <div className="glass-sheet-header">
          <p style={{ color: 'var(--white)', fontWeight: 700, fontSize: 16 }}>Termos e Condições</p>
        </div>

        {/* Tabs — Nexora / Deriv */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <button
            onClick={() => setTab('nexora')}
            style={{
              flex: 1, padding: '12px 0', fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
              color: tab === 'nexora' ? 'var(--white)' : 'var(--text-faint)',
              borderBottom: tab === 'nexora' ? '2px solid var(--blue-hi)' : '2px solid transparent',
            }}
          >
            NEXORA FOREX
          </button>
          <button
            onClick={() => setTab('deriv')}
            style={{
              flex: 1, padding: '12px 0', fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
              color: tab === 'deriv' ? 'var(--white)' : 'var(--text-faint)',
              borderBottom: tab === 'deriv' ? '2px solid var(--blue-hi)' : '2px solid transparent',
            }}
          >
            DERIV
          </button>
        </div>

        <div className="glass-sheet-body" style={{ maxHeight: 320, padding: 18 }}>
          {tab === 'nexora' ? (
            <pre style={{ color: 'var(--text-dim)', fontSize: 11.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)' }}>
              {TERMOS_NEXORA}
            </pre>
          ) : (
            <div>
              <p style={{ color: 'var(--text-dim)', fontSize: 12.5, lineHeight: 1.7, marginBottom: 14 }}>
                Ao ligar a tua conta Deriv através da Nexora Forex, estás também
                sujeito aos termos e condições gerais da Deriv, que regulam a
                abertura de conta, depósitos, levantamentos e a negociação de
                contratos na própria Deriv. A Nexora Forex não altera nem
                substitui esses termos.
              </p>
              <a
                href={DERIV_TERMS_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  color: 'var(--blue-hi)', fontSize: 13, fontWeight: 600,
                }}
              >
                Ver termos completos da Deriv
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                  <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, padding: 16, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={onDecline} className="btn-ghost" style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>
            Não aceito
          </button>
          <button onClick={onAccept} className="btn-primary" style={{ flex: 1 }}>
            Li e aceito os termos
          </button>
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
  padding: 'clamp(28px, 6vw, 48px) clamp(20px, 5vw, 36px) clamp(24px, 5vw, 36px)',
  borderRadius: 28,
  border: 'none',
  boxShadow: 'none',
  background: 'rgba(255,255,255,0.035)',
  backdropFilter: 'blur(28px) saturate(150%)',
  WebkitBackdropFilter: 'blur(28px) saturate(150%)',
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
