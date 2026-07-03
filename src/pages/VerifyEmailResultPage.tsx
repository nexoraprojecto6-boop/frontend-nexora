import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { glassCard, bloodButton, SUPPORT_WHATSAPP_URL } from '../lib/glass'

export default function VerifyEmailResultPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { loginLocal } = useAuth()

  // O link do email chega como /verify-email?token=<token cru>.
  // É esta página (frontend) que consome o token chamando o backend,
  // em vez do backend fazer isso sozinho num simples GET — assim
  // scanners de segurança de email (que "clicam" nos links do email
  // automaticamente) não gastam o token antes do utilizador real abrir.
  const rawToken = params.get('token')

  const [state, setState] = useState<'loading' | 'success' | 'error'>(
    rawToken ? 'loading' : 'error',
  )
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [countdown, setCountdown] = useState(2)

  // Evita chamar a verificação duas vezes (React StrictMode em dev
  // corre efeitos 2x; isto garante que só a primeira chamada conta).
  const calledRef = useRef(false)

  useEffect(() => {
    if (!rawToken) {
      setState('error')
      setErrorMessage('Link de verificação inválido — falta o token.')
      return
    }
    if (calledRef.current) return
    calledRef.current = true

    api.verifyEmail(rawToken)
      .then(({ token, user }) => {
        loginLocal(token, user)
        setState('success')
      })
      .catch((err: Error) => {
        setState('error')
        setErrorMessage(err.message || 'O link pode ter expirado ou já foi usado.')
      })
  }, [rawToken])

  useEffect(() => {
    if (state !== 'success') return
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
  }, [state])

  return (
    <div style={{ position: 'relative', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%',
        background: `radial-gradient(circle, ${state === 'success' ? 'rgba(24,87,255,0.15)' : 'rgba(233,32,63,0.15)'} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div className="card fade-in" style={{ ...glassCard, textAlign: 'center' }}>
        {state === 'loading' && (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(24,87,255,0.12)', border: '1px solid rgba(24,87,255,0.3)', fontSize: 22,
            }}>
              ⏳
            </div>
            <h1 style={{ fontSize: 21, marginBottom: 10, color: 'var(--text-dim, #e6eaf5)' }}>
              A verificar o teu email...
            </h1>
            <p style={{ color: 'var(--text-faint)', fontSize: 13.5 }}>
              Aguarda só um momento.
            </p>
          </>
        )}

        {state === 'success' && (
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
        )}

        {state === 'error' && (
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
              {errorMessage || 'O link pode ter expirado ou já foi usado. Pede um novo email de verificação ou fala com o suporte.'}
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
