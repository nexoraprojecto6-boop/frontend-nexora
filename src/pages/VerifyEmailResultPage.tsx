import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { glassCard, bloodButton, SUPPORT_WHATSAPP_URL } from '../lib/glass'

export default function VerifyEmailResultPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { loginLocal } = useAuth()

  const status = params.get('status')
  const token = params.get('token')
  const message = params.get('message')

  const [countdown, setCountdown] = useState(2)

  useEffect(() => {
    if (status === 'success' && token) {
      api.getLocalMe()
        .then(({ user }) => {
          loginLocal(token, user)
        })
        .catch(() => {
          // Mesmo sem conseguir buscar o utilizador, guardamos o token —
          // o ecrã seguinte trata de validar o acesso.
          loginLocal(token, { id: '', fullName: '', whatsapp: '', email: '', role: 'user' })
        })

      const interval = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(interval)
            navigate('/connect-deriv')
            return 0
          }
          return c - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [status, token])

  const isSuccess = status === 'success'

  return (
    <div style={{ position: 'relative', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%',
        background: `radial-gradient(circle, ${isSuccess ? 'rgba(24,87,255,0.15)' : 'rgba(233,32,63,0.15)'} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div className="card fade-in" style={{ ...glassCard, textAlign: 'center' }}>
        {isSuccess ? (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(24,87,255,0.12)', border: '1px solid rgba(24,87,255,0.3)', fontSize: 26,
            }}>
              ✓
            </div>
            <h1 style={{ fontSize: 21, marginBottom: 10, color: 'var(--text-dim, #e6eaf5)' }}>
              Email verificado!
            </h1>
            <p style={{ color: 'var(--text-faint)', fontSize: 14, marginBottom: 4 }}>
              A tua conta está ativa.
            </p>
            <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>
              A avançar em {countdown}s...
            </p>
          </>
        ) : (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(233,32,63,0.12)', border: '1px solid rgba(233,32,63,0.3)', fontSize: 26,
            }}>
              ✕
            </div>
            <h1 style={{ fontSize: 21, marginBottom: 10, color: 'var(--text-dim, #e6eaf5)' }}>
              Não foi possível verificar
            </h1>
            <p style={{ color: 'var(--text-faint)', fontSize: 13.5, marginBottom: 24, lineHeight: 1.6 }}>
              {message || 'O link pode ter expirado ou já foi usado. Pede um novo email de verificação ou fala com o suporte.'}
            </p>

            <a
              href={SUPPORT_WHATSAPP_URL('Olá! O link de verificação da minha conta não está a funcionar.')}
              target="_blank" rel="noreferrer"
              style={{ ...bloodButton, display: 'block', textDecoration: 'none', marginBottom: 14 }}
            >
              Falar com o suporte via WhatsApp
            </a>

            <Link to="/" style={{ color: 'var(--text-faint)', fontSize: 13 }}>
              Voltar ao login
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
