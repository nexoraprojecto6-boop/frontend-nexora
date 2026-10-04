import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoOpenOutline, IoMailOutline, IoLockClosedOutline } from 'react-icons/io5'
import { AO, BR, PT, US, ES } from 'country-flag-icons/react/3x2'
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
  { code: 'ao', Flag: AO, label: 'Angola' },
  { code: 'br', Flag: BR, label: 'Brasil' },
  { code: 'pt', Flag: PT, label: 'Portugal' },
  { code: 'us', Flag: US, label: 'English' },
  { code: 'es', Flag: ES, label: 'Español' },
]

// ---------------------------------------------------------------------------
// Termos e Condições — mostrados no modal depois do login.
// O texto da Nexora fica embutido; o da Deriv só é linkado.
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

function termsAlreadyAccepted(): boolean {
  try { return localStorage.getItem(TERMS_ACCEPTED_KEY) === '1' } catch { return false }
}

// ---------------------------------------------------------------------------
// Marca — logótipo 100% em SVG/código, sem ficheiro de imagem
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
  const { isLocalAuthenticated, isLocalLoading, loginLocal, logoutLocal } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeLang, setActiveLang] = useState('ao')
  const [showTerms, setShowTerms] = useState(false)

  // Fonte única de verdade para "o que acontece quando há sessão local":
  //   - termos já aceites  -> segue para /connect-deriv
  //   - termos por aceitar -> mostra o modal
  useEffect(() => {
    if (isLocalLoading || !isLocalAuthenticated) return
    if (termsAlreadyAccepted()) {
      navigate('/connect-deriv', { replace: true })
    } else {
      setShowTerms(true)
    }
  }, [isLocalLoading, isLocalAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const cleanEmail = email.trim()
    if (!cleanEmail || !password) {
      setError('Preenche o email e a senha.')
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError('Email inválido.')
      return
    }

    setIsSubmitting(true)
    show('A entrar...')
    try {
      // O backend entra se o email existe e cria a conta se for novo.
      const res = await api.loginLocal(cleanEmail, password)
      loginLocal(res.token, res.user) // o useEffect acima decide o passo seguinte
    } catch (err: any) {
      setError(err?.message || 'Não foi possível entrar.')
    } finally {
      setIsSubmitting(false)
      try { hide?.() } catch { /* LoaderContext pode não ter hide() */ }
    }
  }

  const handleForgotPassword = () => {
    alert('Recuperação de senha em breve. Por agora, contacta o suporte via WhatsApp para reativar o acesso.')
  }

  const handleAcceptTerms = () => {
    try { localStorage.setItem(TERMS_ACCEPTED_KEY, '1') } catch { /* ignora */ }
    setShowTerms(false)
    navigate('/connect-deriv', { replace: true })
  }

  const handleDeclineTerms = () => {
    // Sem aceitar os termos não há acesso: termina só a sessão local
    // (não mexe na sessão Deriv) e fica no ecrã de entrada.
    setShowTerms(false)
    logoutLocal()
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
      {/* Fundo com reflexo tipo gráfico de trading */}
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
            <f.Flag style={{ width: 20, height: 14, borderRadius: 2, display: 'block' }} />
          </button>
        ))}
      </div>

      {/* Contentor de entrada (sem quadrado/borda) */}
      <div className="fade-in" style={cardStyle}>
        <div style={{ textAlign: 'center' }}>
          <div className="brand" style={{ justifyContent: 'center', marginBottom: 10 }}>
            <BrandMark size={40} />
          </div>
          <h1 className="brand-text brand-text--lg">NEXORA FOREX</h1>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 26 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle} htmlFor="email">Email</label>
            <div style={fieldWrapStyle}>
              <IoMailOutline size={18} style={fieldIconStyle} />
              <input
                id="email" type="email" autoComplete="email" style={cleanInputStyle}
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="teu@email.com" disabled={isSubmitting}
              />
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle} htmlFor="password">Senha</label>
            <div style={fieldWrapStyle}>
              <IoLockClosedOutline size={18} style={fieldIconStyle} />
              <input
                id="password" type="password" autoComplete="current-password" style={cleanInputStyle}
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres" disabled={isSubmitting}
              />
            </div>
          </div>

          <div style={{ textAlign: 'right', marginBottom: 20 }}>
            <button type="button" onClick={handleForgotPassword} style={linkBtnStyle}>
              Esqueci a senha
            </button>
          </div>

          {error && <p style={{ ...errorTextStyle, marginBottom: 16, textAlign: 'center' }}>{error}</p>}

          <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ width: '100%' }}>
            {isSubmitting ? 'A entrar...' : 'Entrar'}
          </button>
        </form>

        <p style={{ color: 'var(--text-faint)', fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
          Primeira vez aqui? Basta escrever o teu email e uma senha — a conta é criada automaticamente.
        </p>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-faint)', fontSize: 11 }}>© 2026 Nexora Forex</p>
        </div>
      </div>

      {/* Modal — Termos e Condições da Nexora e da Deriv */}
      {showTerms && <TermsModal onAccept={handleAcceptTerms} onDecline={handleDeclineTerms} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal de Termos e Condições
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
              flex: 1, padding: '14px 0', fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
              color: tab === 'nexora' ? 'var(--white)' : 'var(--text-faint)',
              borderBottom: tab === 'nexora' ? '2px solid var(--blue-hi)' : '2px solid transparent',
            }}
          >
            NEXORA FOREX
          </button>
          <button
            onClick={() => setTab('deriv')}
            style={{
              flex: 1, padding: '14px 0', fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
              color: tab === 'deriv' ? 'var(--white)' : 'var(--text-faint)',
              borderBottom: tab === 'deriv' ? '2px solid var(--blue-hi)' : '2px solid transparent',
            }}
          >
            DERIV
          </button>
        </div>

        <div className="glass-sheet-body" style={{ padding: 18 }}>
          {tab === 'nexora' ? (
            <pre style={{ color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)' }}>
              {TERMOS_NEXORA}
            </pre>
          ) : (
            <div>
              <p style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.7, marginBottom: 14 }}>
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
                <IoOpenOutline size={14} />
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
// Fundo com reflexo de gráfico (puramente decorativo)
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

      <div style={{
        position: 'fixed', inset: 0,
        background: 'linear-gradient(160deg, #05070c 0%, #0a0e17 45%, #05070c 100%)',
        zIndex: 0,
      }} />

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

      <div style={{
        position: 'fixed', inset: 0, zIndex: 1,
        background: 'radial-gradient(circle at 50% 20%, rgba(255,255,255,0.05), transparent 60%)',
        animation: 'nexora-sheen 8s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

// O wrapper rola em vez de cortar: com teclado aberto ou ecrã baixo
// o contentor nunca fica escondido em cima/baixo.
const pageWrapStyle: React.CSSProperties = {
  position: 'relative', minHeight: '100dvh',
  display: 'flex', justifyContent: 'center',
  padding: 'calc(64px + env(safe-area-inset-top, 0px)) 16px calc(24px + env(safe-area-inset-bottom, 0px))',
  overflowY: 'auto', overflowX: 'hidden',
}

const flagsRowStyle: React.CSSProperties = {
  position: 'fixed', top: 'calc(16px + env(safe-area-inset-top, 0px))', left: '50%', transform: 'translateX(-50%)',
  display: 'flex', gap: 10, zIndex: 20,
}

const flagBtnStyle = (active: boolean): React.CSSProperties => ({
  width: 38, height: 38, borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: active ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)',
  border: 'none',
  cursor: 'pointer', transition: 'all 0.2s ease',
  boxShadow: active ? '0 0 0 3px rgba(118,131,255,0.35)' : 'none',
})

const cardStyle: React.CSSProperties = {
  position: 'relative', zIndex: 10,
  width: '100%', maxWidth: 400,
  margin: 'auto 0',
  padding: 'clamp(24px, 6vw, 44px) clamp(18px, 5vw, 32px) clamp(22px, 5vw, 32px)',
}

const fieldWrapStyle: React.CSSProperties = {
  position: 'relative', display: 'flex', alignItems: 'center',
}

const fieldIconStyle: React.CSSProperties = {
  position: 'absolute', left: 14, color: 'var(--text-faint)', pointerEvents: 'none',
}

const cleanInputStyle: React.CSSProperties = {
  ...inputStyle,
  width: '100%',
  minHeight: 48,
  background: 'var(--bg-card-hi)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '12px 14px 12px 42px',
}

const linkBtnStyle: React.CSSProperties = {
  color: 'var(--text-faint)', fontSize: 13,
  background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0',
}
