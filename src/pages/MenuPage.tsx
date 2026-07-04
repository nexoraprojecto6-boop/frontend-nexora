import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLoader } from '../context/LoaderContext'
import { api } from '../lib/api'
import { isSoundEnabled, setSoundEnabled, playGainSound } from '../lib/sound'

const WHATSAPP = '976289984'

// ============================================================
// Contagem de "online" SIMULADA (não vem do backend).
//
// Começa perto de BASE_ONLINE (406) e evolui como um "random walk"
// com tendência de subida: a cada tick tem mais probabilidade de
// subir 1 a 4 do que descer, e fica limitada a uma banda razoável
// para nunca parecer absurda. O valor é guardado em localStorage
// para não "saltar" de forma estranha ao recarregar a página —
// continua de onde estava, como uma contagem real continuaria.
// ============================================================
const BASE_ONLINE = 406
const ONLINE_MIN = 380
const ONLINE_MAX = 520
const SIM_STORAGE_KEY = 'nexora_online_sim'
const SIM_MAX_AGE_MS = 12 * 60 * 60 * 1000 // reinicia a simulação após 12h parada

function loadSimulatedOnline(): number {
  try {
    const raw = localStorage.getItem(SIM_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { value: number; ts: number }
      if (Date.now() - parsed.ts < SIM_MAX_AGE_MS) {
        return parsed.value
      }
    }
  } catch { /* ignora e reinicia abaixo */ }
  return BASE_ONLINE + Math.floor(Math.random() * 6) - 3 // 403–409
}

function saveSimulatedOnline(value: number) {
  try {
    localStorage.setItem(SIM_STORAGE_KEY, JSON.stringify({ value, ts: Date.now() }))
  } catch { /* localStorage indisponível — sem problema, é só cosmético */ }
}

function nextSimulatedOnline(current: number): number {
  // 65% sobe (1 a 4), 20% mantém, 15% desce (1 a 2) — tendência
  // de crescimento com oscilação natural, como visto num contador
  // real de utilizadores online.
  const roll = Math.random()
  let delta: number
  if (roll < 0.65) delta = 1 + Math.floor(Math.random() * 4) // +1 a +4
  else if (roll < 0.85) delta = 0
  else delta = -(1 + Math.floor(Math.random() * 2)) // -1 a -2

  let next = current + delta
  if (next < ONLINE_MIN) next = ONLINE_MIN + Math.floor(Math.random() * 5)
  if (next > ONLINE_MAX) next = ONLINE_MAX - Math.floor(Math.random() * 5)
  return next
}

const LOCAL_AVISOS = [
  { id: '1', titulo: 'Manutenção programada', mensagem: 'O sistema estará em manutenção no dia 30/04 das 02h às 04h.', data: '28/04/2026' },
  { id: '2', titulo: 'Nova estratégia disponível', mensagem: 'A estratégia Gpt5.4 foi atualizada com melhorias de precisão.', data: '27/04/2026' },
  { id: '3', titulo: 'Promoção Mentoria VIP', mensagem: 'Vagas limitadas para mentoria VIP de maio. Entre em contacto agora.', data: '25/04/2026' },
]

const TERMOS = `TERMOS E CONDIÇÕES — NEXORA FOREX

1. ACEITAÇÃO DOS TERMOS
Ao utilizar a plataforma Nexora Forex, o utilizador aceita integralmente os presentes termos e condições.

2. RISCOS
O trading envolve riscos elevados de perda de capital. Os resultados passados não garantem resultados futuros. O utilizador é o único responsável pelas suas decisões de investimento.

3. RESPONSABILIDADE
A Nexora Forex não se responsabiliza por perdas financeiras resultantes do uso da plataforma.

4. CONTACTO
Para questões, contacte-nos via WhatsApp: +${WHATSAPP}`

function MenuItem({ icon, label, onClick, href, external = false, color, badge }: {
  icon: React.ReactNode; label: string; onClick?: () => void; href?: string
  external?: boolean; color?: string; badge?: string
}) {
  const content = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
      <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-card-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: color || 'var(--text-dim)', flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ flex: 1, color: 'var(--white)', fontSize: 14, fontWeight: 500, textAlign: 'left' }}>{label}</span>
      {badge && (
        <span style={{ padding: '2px 8px', background: 'rgba(24,87,255,0.18)', color: 'var(--blue-hi)', fontSize: 11, fontWeight: 700, borderRadius: 20 }}>{badge}</span>
      )}
      {external && <svg width="12" height="12" fill="none" stroke="var(--text-faint)" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>}
    </div>
  )

  const commonStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center',
    background: 'transparent', transition: 'background 0.15s', border: 'none',
  }

  if (href) {
    return (
      <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}
        style={commonStyle}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hi)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        {content}
      </a>
    )
  }
  return (
    <button onClick={onClick} style={commonStyle}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hi)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {content}
    </button>
  )
}

export default function MenuPage() {
  const navigate = useNavigate()
  const { currentAccount, logout, localUser } = useAuth()
  const { show, complete, hide } = useLoader()

  const [onlineCount, setOnlineCount] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [avisosOpen, setAvisosOpen] = useState(false)
  const [termosOpen, setTermosOpen] = useState(false)
  const [soundOn, setSoundOn] = useState(true)

  useEffect(() => { setSoundOn(isSoundEnabled()) }, [])

  const handleToggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    setSoundEnabled(next)
    if (next) playGainSound() // dá um preview do som ao ligar
  }

  // O role vem do token de sessão local (login com email + senha),
  // não do check antigo por conta Deriv — reflete diretamente
  // ADMIN_EMAILS do backend.
  const isAdmin = localUser?.role === 'admin'

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { navigate('/'); return }

    // Contagem simulada — ver funções no topo do ficheiro.
    setOnlineCount(loadSimulatedOnline())
    loadData()

    const iv = setInterval(() => {
      setOnlineCount((prev) => {
        const next = nextSimulatedOnline(prev ?? BASE_ONLINE)
        saveSimulatedOnline(next)
        return next
      })
    }, 4000 + Math.random() * 4000) // a cada 4–8s, para não parecer um timer perfeito

    return () => clearInterval(iv)
  }, [])

  const loadData = async () => {
    show('A carregar perfil...')
    try {
      complete('Pronto!')
    } catch { hide() } finally { setIsLoading(false) }
  }

  const goBack = () => { show('A carregar...'); navigate('/dashboard') }
  const handleLogout = async () => { show('A sair...'); await logout() }
  const goToAdmin = () => { show('A carregar painel admin...'); navigate('/admin') }

  if (isLoading) return null

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div style={{ position: 'sticky', top: 0, background: 'rgba(7,11,20,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', zIndex: 10 }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={goBack} className="btn-ghost" style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="logo-text" style={{ fontSize: 18 }}>NEXORA</h1>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 12px 40px' }}>
        {/* Online count */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" fill="none" stroke="var(--green)" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" /></svg>
            <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>ONLINES</span>
            <span className="dot live" />
          </div>
          <span className="tabular" style={{ color: 'var(--green)', fontSize: 18, fontWeight: 700 }}>
            {onlineCount === null ? '—' : onlineCount}
          </span>
        </div>

        {/* Profile */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-card-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" fill="none" stroke="var(--text-dim)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div>
            <p style={{ color: 'var(--white)', fontWeight: 600, fontSize: 14 }}>
              {localUser?.fullName || currentAccount?.full_name || currentAccount?.name || 'Utilizador'}
            </p>
            <p style={{ color: 'var(--text-faint)', fontSize: 12 }}>
              {localUser?.email || currentAccount?.account_id || currentAccount?.loginid || '-'}
            </p>
          </div>
          {isAdmin && (
            <span style={{ marginLeft: 'auto', padding: '2px 10px', background: 'rgba(245,166,35,0.15)', color: '#f5a623', fontSize: 11, fontWeight: 700, borderRadius: 20, border: '1px solid rgba(245,166,35,0.3)' }}>
              ADMIN
            </span>
          )}
        </div>

        {/* Botão Admin — só aparece para quem tem role 'admin' */}
        {isAdmin && (
          <div className="card" style={{ marginBottom: 12, padding: 8 }}>
            <MenuItem onClick={goToAdmin}
              icon={<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
              label="PAINEL ADMIN" color="#f5a623" />
          </div>
        )}

        {/* Secção principal */}
        <div className="card" style={{ marginBottom: 12, padding: 8 }}>
          <MenuItem onClick={() => { show('A carregar...'); navigate('/dashboard') }}
            icon={<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>}
            label="DASHBOARD" color="var(--blue-hi)" />
          <MenuItem onClick={() => { show('A carregar...'); navigate('/dashboard') }}
            icon={<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><line x1="12" y1="7" x2="12" y2="11" /></svg>}
            label="OPERAR COM ROBÔS" color="var(--green)" />
          <MenuItem
            href={`https://hub.deriv.com/tradershub/signup?t=hCp-xUFsKsktJe5FDKcTD2Nd7ZgqdRLk&utm_campaign=NEXORA&utm_medium=affiliate&utm_source=hCp-xUFsKsktJe5FDKcTD2Nd7ZgqdRLk`}
            external icon={<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>}
            label="CADASTRO NA CORRETORA" color="var(--red-hi)" />
          <MenuItem onClick={() => { show('A carregar...'); navigate('/aprender-a-operar') }}
            icon={<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422A12.083 12.083 0 0119 15.5V19a1 1 0 01-1 1H6a1 1 0 01-1-1v-3.5a12.083 12.083 0 011.84-4.922L12 14z" /></svg>}
            label="APRENDE A OPERAR" color="#f5a623" />
          <MenuItem
            href={`https://wa.me/${WHATSAPP}?text=Ol%C3%A1%2C%20quero%20saber%20mais%20sobre%20a%20Mentoria%20VIP`}
            external icon={<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
            label="MENTORIA VIP WHATSAPP" color="var(--green)" />
        </div>

        {/* Som de ganho (gain) */}
        <div className="card" style={{ marginBottom: 12, padding: 8 }}>
          <button onClick={handleToggleSound} style={{
            width: '100%', padding: '12px 14px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', cursor: 'pointer', border: 'none',
          }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-card-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: soundOn ? 'var(--green)' : 'var(--text-faint)', flexShrink: 0 }}>
              {soundOn ? (
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M6 8v8H4a1 1 0 01-1-1V9a1 1 0 011-1h2zm0 0l5.5-4.5A1 1 0 0113 4.29v15.42a1 1 0 01-1.5.79L6 16" /></svg>
              ) : (
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 8v8H4a1 1 0 01-1-1V9a1 1 0 011-1h2zm0 0l5.5-4.5A1 1 0 0113 4.29v15.42a1 1 0 01-1.5.79L6 16m9-6l4 4m0-4l-4 4" /></svg>
              )}
            </span>
            <span style={{ flex: 1, color: 'var(--white)', fontSize: 14, fontWeight: 500, textAlign: 'left' }}>SOM DE GANHO</span>
            <span style={{
              position: 'relative', width: 40, height: 20, borderRadius: 10,
              background: soundOn ? 'var(--blue)' : 'var(--border-hi)', transition: 'background .15s', flexShrink: 0,
            }}>
              <span style={{
                position: 'absolute', top: 2, left: soundOn ? 22 : 2, width: 16, height: 16, borderRadius: '50%',
                background: 'white', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
              }} />
            </span>
          </button>
        </div>

        {/* Avisos */}
        <div className="card" style={{ marginBottom: 12, padding: 8 }}>
          <button onClick={() => setAvisosOpen(o => !o)} style={{
            width: '100%', padding: '12px 14px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', cursor: 'pointer',
          }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-card-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f5a623', flexShrink: 0 }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </span>
            <span style={{ flex: 1, color: 'var(--white)', fontSize: 14, fontWeight: 500, textAlign: 'left' }}>AVISOS</span>
            {LOCAL_AVISOS.length > 0 && (
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--red)', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {LOCAL_AVISOS.length}
              </span>
            )}
            <svg width="12" height="12" fill="none" stroke="var(--text-faint)" viewBox="0 0 24 24" style={{ transform: avisosOpen ? 'rotate(180deg)' : undefined, transition: 'transform .2s', flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {avisosOpen && (
            <div style={{ margin: '4px 8px 8px', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
              {LOCAL_AVISOS.map((aviso, idx) => (
                <div key={aviso.id} style={{ padding: '12px 14px', background: 'var(--bg-card-hi)', borderBottom: idx < LOCAL_AVISOS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--white)', fontSize: 12, fontWeight: 600 }}>{aviso.titulo}</span>
                    <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>{aviso.data}</span>
                  </div>
                  <p style={{ color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.5 }}>{aviso.mensagem}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Termos */}
        <div className="card" style={{ marginBottom: 12, padding: 8 }}>
          <button onClick={() => setTermosOpen(o => !o)} style={{
            width: '100%', padding: '12px 14px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', cursor: 'pointer',
          }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-card-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', flexShrink: 0 }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </span>
            <span style={{ flex: 1, color: 'var(--white)', fontSize: 14, fontWeight: 500, textAlign: 'left' }}>TERMOS E CONDIÇÕES</span>
            <svg width="12" height="12" fill="none" stroke="var(--text-faint)" viewBox="0 0 24 24" style={{ transform: termosOpen ? 'rotate(180deg)' : undefined, transition: 'transform .2s', flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {termosOpen && (
            <div style={{ margin: '4px 8px 8px', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-card-hi)', padding: '14px 16px', maxHeight: 240, overflowY: 'auto' }}>
              <pre style={{ color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)' }}>{TERMOS}</pre>
            </div>
          )}
        </div>

        {/* Logout */}
        <div className="card" style={{ padding: 8 }}>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '12px 14px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12,
            background: 'transparent', cursor: 'pointer', border: 'none',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(233,32,63,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(233,32,63,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red-hi)', flexShrink: 0 }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </span>
            <span style={{ color: 'var(--red-hi)', fontSize: 14, fontWeight: 600 }}>SAIR</span>
          </button>
        </div>
      </div>
    </div>
  )
}
