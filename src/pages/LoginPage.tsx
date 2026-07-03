import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useLoader } from '../context/LoaderContext'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { glassCard, inputStyle, labelStyle, errorTextStyle } from '../lib/glass'

export default function LoginPage() {
  const navigate = useNavigate()
  const { show } = useLoader()
  const { isLocalAuthenticated, isLocalLoading, loginLocal } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      const msg = err?.message || 'Não foi possível entrar.'
      if (msg.toLowerCase().includes('verific')) {
        navigate('/verify-pending', { state: { email: email.trim() } })
      } else {
        setError(msg)
      }
    } finally {
      setIsSubmitting(false)
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
    <div style={{ position: 'relative', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: '-25%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(24,87,255,0.18) 0%, transparent 70%)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: 0, right: 0, width: 420, height: 420, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(233,32,63,0.12) 0%, transparent 70%)', pointerEvents: 'none',
      }} />

      <div className="card fade-in" style={glassCard}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 className="logo-text" style={{ fontSize: 30, marginBottom: 6 }}>NEXORA</h1>
          <p style={{ color: 'var(--text-faint)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 3 }}>Forex Trading Platform</p>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: 24 }} />

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle} htmlFor="email">Email</label>
            <input
              id="email" type="email" autoComplete="email" style={inputStyle}
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="teu@email.com" disabled={isSubmitting}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle} htmlFor="password">Senha</label>
            <input
              id="password" type="password" autoComplete="current-password" style={inputStyle}
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" disabled={isSubmitting}
            />
          </div>

          <div style={{ textAlign: 'right', marginBottom: 20 }}>
            <button type="button" onClick={handleForgotPassword} style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>
              Esqueci a senha
            </button>
          </div>

          {error && <p style={{ ...errorTextStyle, marginBottom: 16, textAlign: 'center' }}>{error}</p>}

          <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ width: '100%' }}>
            {isSubmitting ? 'A entrar...' : 'Entrar'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '24px 0' }}>
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <p style={{ color: 'var(--text-faint)', fontSize: 12 }}>Não tem conta?</p>
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link to="/register" style={{ color: 'var(--blue-hi)', fontSize: 14, fontWeight: 600 }}>
            Criar conta
          </Link>
        </div>

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-faint)', fontSize: 11 }}>© 2026 Nexora Forex</p>
        </div>
      </div>
    </div>
  )
}
