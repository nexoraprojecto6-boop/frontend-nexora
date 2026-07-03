import { useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { glassCard, bloodButton, SUPPORT_WHATSAPP_URL } from '../lib/glass'

export default function VerifyPendingPage() {
  const location = useLocation() as { state?: { email?: string } }
  const email = location.state?.email ?? ''

  const [resent, setResent] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleResend = async () => {
    if (!email) return
    setIsResending(true)
    setError(null)
    try {
      await api.resendVerification(email)
      setResent(true)
    } catch (err: any) {
      setError(err?.message || 'Não foi possível reenviar. Tenta novamente.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div style={{ position: 'relative', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(24,87,255,0.15) 0%, transparent 70%)', pointerEvents: 'none',
      }} />

      <div className="card fade-in" style={{ ...glassCard, textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(24,87,255,0.12)', border: '1px solid rgba(24,87,255,0.3)', fontSize: 26,
        }}>
          ✉️
        </div>

        <h1 style={{ fontSize: 21, marginBottom: 10, color: 'var(--text-dim, #e6eaf5)' }}>
          Falta pouco!
        </h1>
        <p style={{ color: 'var(--text-faint)', fontSize: 14, lineHeight: 1.6, marginBottom: 4 }}>
          Enviámos um link de verificação{email ? <> para <strong style={{ color: 'var(--text-dim, #e6eaf5)' }}>{email}</strong></> : ''}.
        </p>
        <p style={{ color: 'var(--text-faint)', fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
          Abre o email e clica no link para ativar a tua conta. Não encontras? Verifica também as pastas <strong>Spam</strong> ou <strong>Lixo</strong>.
        </p>

        <button
          onClick={handleResend}
          disabled={isResending || !email}
          className="btn-primary"
          style={{ width: '100%', marginBottom: 12, opacity: !email ? 0.5 : 1 }}
        >
          {isResending ? 'A reenviar...' : resent ? 'Email reenviado ✓' : 'Reenviar email de verificação'}
        </button>

        {error && <p style={{ color: '#ff6b7a', fontSize: 12.5, marginBottom: 12 }}>{error}</p>}

        <a
          href={SUPPORT_WHATSAPP_URL('Olá! Preciso de ajuda para verificar a minha conta na Nexora Forex.')}
          target="_blank" rel="noreferrer"
          style={{ ...bloodButton, display: 'block', textDecoration: 'none', textAlign: 'center', marginBottom: 20 }}
        >
          Falar com o suporte via WhatsApp
        </a>

        <Link to="/" style={{ color: 'var(--text-faint)', fontSize: 13 }}>
          Voltar ao login
        </Link>
      </div>
    </div>
  )
}
