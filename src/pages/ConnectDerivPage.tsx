import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLoader } from '../context/LoaderContext'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { glassCardBlood, bloodButton, GLASS_REFLECT_CSS } from '../lib/glass'
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
    <div style={{ position: 'relative', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden' }}>
      <style>{GLASS_REFLECT_CSS}</style>
      <div style={{
        position: 'absolute', top: '-15%', left: '50%', transform: 'translateX(-50%)', width: 560, height: 560, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(160,20,35,0.16) 0%, transparent 70%)', pointerEvents: 'none',
      }} />
      <div className="glass-reflect card fade-in" style={glassCardBlood}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, marginBottom: 8, color: '#fdeceb' }}>Conectar à Deriv</h1>
          <p style={{ color: 'rgba(253,236,235,0.65)', fontSize: 13.5, lineHeight: 1.6 }}>
            A tua conta Sinistro X já está ativa. Falta ligar a tua conta Deriv para começares a negociar.
          </p>
        </div>
        <button onClick={handleConnect} disabled={isConnecting} style={{ ...bloodButton, opacity: isConnecting ? 0.7 : 1 }}>
          {isConnecting ? 'A ligar...' : 'Conectar à Deriv'}
        </button>
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            onClick={handleCreateDerivAccount}
            style={{ color: 'rgba(253,236,235,0.75)', fontSize: 13.5, fontWeight: 600, textDecoration: 'underline' }}
          >
            Ainda não tens conta na Deriv? Criar agora
          </button>
        </div>
      </div>
    </div>
  )
}
