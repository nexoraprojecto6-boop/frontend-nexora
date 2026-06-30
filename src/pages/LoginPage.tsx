import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLoader } from '../context/LoaderContext'
import { api } from '../lib/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const { show } = useLoader()
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      show('A carregar...')
      navigate('/dashboard')
    } else {
      setIsChecking(false)
    }
  }, [])

  const handleLogin = async () => {
    setIsLoading(true)
    show('A redirecionar para Deriv...')
    try {
      const { authUrl } = await api.startLogin()
      window.location.href = authUrl
    } catch (err) {
      console.error('[Login] error:', err)
      setIsLoading(false)
    }
  }

  const handleRegister = async () => {
    show('A redirecionar para registo...')
    try {
      const { authUrl } = await api.startLogin('registration')
      window.location.href = authUrl
    } catch (err) {
      console.error('[Register] error:', err)
    }
  }

  if (isChecking) {
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

      <div className="card fade-in" style={{
        position: 'relative', width: '100%', maxWidth: 380, padding: 32,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        background: 'rgba(16,25,46,0.7)', backdropFilter: 'blur(20px) saturate(140%)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 className="logo-text" style={{ fontSize: 30, marginBottom: 6 }}>NEXORA</h1>
          <p style={{ color: 'var(--text-faint)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 3 }}>Forex Trading Platform</p>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: 24 }} />

        <p style={{ color: 'var(--text-dim)', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
          Entre com sua conta Deriv para começar a negociar.
        </p>

        <button onClick={handleLogin} disabled={isLoading} className="btn-primary" style={{ width: '100%' }}>
          {isLoading ? 'A carregar...' : 'Entrar com Deriv'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '24px 0' }}>
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <p style={{ color: 'var(--text-faint)', fontSize: 12 }}>Não tem conta?</p>
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <button onClick={handleRegister} style={{ color: 'var(--blue-hi)', fontSize: 14, fontWeight: 600 }}>
            Criar conta Deriv
          </button>
        </div>

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-faint)', fontSize: 11, marginBottom: 6 }}>© 2026 Nexora Forex · Powered by Deriv API</p>
          <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>OAuth 2.0 + PKCE</span>
        </div>
      </div>
    </div>
  )
}
