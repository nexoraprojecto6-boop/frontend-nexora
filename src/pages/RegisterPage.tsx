import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useLoader } from '../context/LoaderContext'
import { api } from '../lib/api'
import { glassCard, inputStyle, labelStyle, errorTextStyle } from '../lib/glass'

const WHATSAPP_REGEX = /^\+?[0-9]{8,15}$/

interface FormState {
  fullName: string
  whatsapp: string
  email: string
  password: string
  confirmPassword: string
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { show, hide } = useLoader() as any // hide pode não existir; tratado com try/catch abaixo

  const [form, setForm] = useState<FormState>({
    fullName: '', whatsapp: '', email: '', password: '', confirmPassword: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const update = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {}
    if (form.fullName.trim().length < 3) next.fullName = 'Indica o teu nome completo.'
    if (!WHATSAPP_REGEX.test(form.whatsapp.trim())) next.whatsapp = 'Usa o formato internacional, ex: +244923456789'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Email inválido.'
    if (form.password.length < 8) next.password = 'A senha precisa de pelo menos 8 caracteres.'
    if (form.confirmPassword !== form.password) next.confirmPassword = 'As senhas não coincidem.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError(null)
    if (!validate()) return

    setIsSubmitting(true)
    show('A criar conta...')
    try {
      await api.register({
        fullName: form.fullName.trim(),
        whatsapp: form.whatsapp.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      navigate('/verify-pending', { state: { email: form.email.trim() } })
    } catch (err: any) {
      setGeneralError(err?.message || 'Não foi possível criar a conta.')
    } finally {
      setIsSubmitting(false)
      try { hide?.() } catch { /* opcional */ }
    }
  }

  return (
    <div style={{ position: 'relative', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: '-25%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(24,87,255,0.18) 0%, transparent 70%)', pointerEvents: 'none',
      }} />

      <div className="card fade-in" style={{ ...glassCard, maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 className="logo-text" style={{ fontSize: 26, marginBottom: 6 }}>Criar conta</h1>
          <p style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>Leva menos de um minuto.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle} htmlFor="fullName">Nome completo</label>
            <input id="fullName" style={inputStyle} value={form.fullName} onChange={update('fullName')} placeholder="O teu nome" disabled={isSubmitting} />
            {errors.fullName && <p style={errorTextStyle}>{errors.fullName}</p>}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle} htmlFor="whatsapp">WhatsApp</label>
            <input id="whatsapp" style={inputStyle} value={form.whatsapp} onChange={update('whatsapp')} placeholder="+244923456789" disabled={isSubmitting} />
            {errors.whatsapp && <p style={errorTextStyle}>{errors.whatsapp}</p>}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle} htmlFor="email">Email</label>
            <input id="email" type="email" style={inputStyle} value={form.email} onChange={update('email')} placeholder="teu@email.com" disabled={isSubmitting} />
            {errors.email && <p style={errorTextStyle}>{errors.email}</p>}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle} htmlFor="password">Senha</label>
            <input id="password" type="password" style={inputStyle} value={form.password} onChange={update('password')} placeholder="Mínimo 8 caracteres" disabled={isSubmitting} />
            {errors.password && <p style={errorTextStyle}>{errors.password}</p>}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle} htmlFor="confirmPassword">Confirmar senha</label>
            <input id="confirmPassword" type="password" style={inputStyle} value={form.confirmPassword} onChange={update('confirmPassword')} placeholder="Repete a senha" disabled={isSubmitting} />
            {errors.confirmPassword && <p style={errorTextStyle}>{errors.confirmPassword}</p>}
          </div>

          {generalError && <p style={{ ...errorTextStyle, marginBottom: 16, textAlign: 'center' }}>{generalError}</p>}

          <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ width: '100%' }}>
            {isSubmitting ? 'A criar...' : 'Criar conta'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/" style={{ color: 'var(--text-faint)', fontSize: 13 }}>
            Já tens conta? <span style={{ color: 'var(--blue-hi)', fontWeight: 600 }}>Entrar</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
