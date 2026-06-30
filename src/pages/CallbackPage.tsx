import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLoader } from '../context/LoaderContext'
import { useAuth } from '../context/AuthContext'

export default function CallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { show, complete, hide } = useLoader()
  const { login } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    handleCallback()
  }, [])

  const handleCallback = async () => {
    show('A processar autenticação...')

    const error = searchParams.get('error')
    if (error) {
      setStatus('error')
      setErrorMessage(searchParams.get('error_description') || `Erro: ${error}`)
      hide()
      return
    }

    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setErrorMessage('Token não encontrado. Tenta fazer login novamente.')
      hide()
      return
    }

    const ok = await login(token)
    if (!ok) {
      setStatus('error')
      setErrorMessage('Não foi possível validar a conta. Tenta fazer login novamente.')
      hide()
      return
    }

    sessionStorage.removeItem('pkce_code_verifier')
    sessionStorage.removeItem('oauth_state')
    setStatus('success')
    complete('Autenticação bem sucedida!')
    navigate('/dashboard')
  }

  const handleRetry = () => {
    sessionStorage.clear()
    localStorage.removeItem('token')
    navigate('/')
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        {status === 'loading' && (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div className="logo-text" style={{ fontSize: 22 }}>NEXORA</div>
            <div style={{ position: 'relative', width: 56, height: 56 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'var(--blue-hi)', borderRightColor: 'rgba(24,87,255,0.2)', animation: 'spin 0.9s linear infinite' }} />
              <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: '2px solid transparent', borderBottomColor: 'var(--red-hi)', borderLeftColor: 'rgba(233,32,63,0.2)', animation: 'spin 0.7s linear infinite reverse' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--blue-hi)', boxShadow: '0 0 10px var(--blue-hi)' }} />
              </div>
            </div>
            <div>
              <p style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, marginBottom: 6 }}>A processar autenticação...</p>
              <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Por favor, aguarde enquanto validamos as suas credenciais.</p>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(24,201,122,0.15)', border: '2px solid rgba(24,201,122,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" fill="none" stroke="var(--green)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p style={{ color: 'var(--green)', fontSize: 20, fontWeight: 700 }}>Autenticação bem sucedida!</p>
            <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>A redirecionar para o dashboard...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(233,32,63,0.15)', border: '2px solid rgba(233,32,63,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" fill="none" stroke="var(--red-hi)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p style={{ color: 'var(--red-hi)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Erro de autenticação</p>
              <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>{errorMessage}</p>
            </div>
            <button onClick={handleRetry} className="btn-ghost" style={{ padding: '12px 28px', fontSize: 14, fontWeight: 600 }}>
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
