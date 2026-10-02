import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IoChevronBack, IoChevronDown, IoGridOutline, IoHardwareChipOutline, IoPersonAddOutline,
  IoSchoolOutline, IoLogoWhatsapp, IoHeadsetOutline, IoVolumeHighOutline, IoVolumeMuteOutline,
  IoNotificationsOutline, IoDocumentTextOutline, IoLogOutOutline, IoShieldCheckmarkOutline,
  IoPersonOutline, IoPulseOutline, IoOpenOutline,
} from 'react-icons/io5'
import { useAuth } from '../context/AuthContext'
import { useLoader } from '../context/LoaderContext'
import { api } from '../lib/api'
import { isSoundEnabled, setSoundEnabled, playGainSound } from '../lib/sound'

const WHATSAPP = '976289984'
const MENTORIA_VIP_LINK = 'https://chat.whatsapp.com/GaFZpRc5w7C4uX8rusX4bO'

// ============================================================
// Contagem de "online" SIMULADA (não vem do backend).
// Começa perto de BASE_ONLINE e evolui como um "random walk"
// com tendência de subida, limitada a uma banda razoável.
// O valor é guardado em localStorage para não "saltar" ao recarregar.
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
  const roll = Math.random()
  let delta: number
  if (roll < 0.65) delta = 1 + Math.floor(Math.random() * 4)
  else if (roll < 0.85) delta = 0
  else delta = -(1 + Math.floor(Math.random() * 2))

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

const ICON = 18

// Caixa do ícone — igual em todos os itens
const iconBoxStyle = (color?: string, bg = 'var(--bg-card-hi)'): React.CSSProperties => ({
  width: 38, height: 38, borderRadius: 12, background: bg,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: color || 'var(--text-dim)', flexShrink: 0,
})

const rowBtnStyle: React.CSSProperties = {
  width: '100%', minHeight: 52, padding: '8px 12px', borderRadius: 12, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 12,
  background: 'transparent', border: 'none',
}

function MenuItem({ icon, label, onClick, href, external = false, color, badge }: {
  icon: React.ReactNode; label: string; onClick?: () => void; href?: string
  external?: boolean; color?: string; badge?: string
}) {
  const content = (
    <>
      <span style={iconBoxStyle(color)}>{icon}</span>
      <span style={{ flex: 1, color: 'var(--white)', fontSize: 14, fontWeight: 600, textAlign: 'left' }}>{label}</span>
      {badge && (
        <span style={{ padding: '2px 8px', background: 'rgba(24,87,255,0.18)', color: 'var(--blue-hi)', fontSize: 11, fontWeight: 700, borderRadius: 20 }}>{badge}</span>
      )}
      {external && <IoOpenOutline size={14} color="var(--text-faint)" />}
    </>
  )

  const hoverOn = (e: React.MouseEvent<HTMLElement>) => (e.currentTarget.style.background = 'var(--bg-card-hi)')
  const hoverOff = (e: React.MouseEvent<HTMLElement>) => (e.currentTarget.style.background = 'transparent')

  if (href) {
    return (
      <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}
        style={rowBtnStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
        {content}
      </a>
    )
  }
  return (
    <button onClick={onClick} style={rowBtnStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
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
    if (next) playGainSound()
  }

  const isAdmin = localUser?.role === 'admin'

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { navigate('/'); return }

    setOnlineCount(loadSimulatedOnline())
    loadData()

    const iv = setInterval(() => {
      setOnlineCount((prev) => {
        const next = nextSimulatedOnline(prev ?? BASE_ONLINE)
        saveSimulatedOnline(next)
        return next
      })
    }, 4000 + Math.random() * 4000)

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

  const goToAprenderAOperar = () => {
    show('A abrir aula...')
    navigate('/aprender-a-operar')
    complete('Pronto!')
  }

  if (isLoading) return null

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div style={{ position: 'sticky', top: 0, background: 'rgba(11,13,18,0.95)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', zIndex: 10 }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: 'calc(14px + env(safe-area-inset-top, 0px)) 16px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={goBack} aria-label="Voltar" className="btn-ghost" style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
            <IoChevronBack size={20} />
          </button>
          <h1 className="logo-text" style={{ fontSize: 18 }}>NEXORA</h1>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 12px calc(40px + env(safe-area-inset-bottom, 0px))' }}>
        {/* Online count */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IoPulseOutline size={ICON} color="var(--green)" />
            <span style={{ color: 'var(--text-dim)', fontSize: 14, fontWeight: 600 }}>ONLINES</span>
            <span className="dot live" />
          </div>
          <span className="tabular" style={{ color: 'var(--green)', fontSize: 18, fontWeight: 700 }}>
            {onlineCount === null ? '—' : onlineCount}
          </span>
        </div>

        {/* Profile */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--bg-card-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IoPersonOutline size={22} color="var(--text-dim)" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ color: 'var(--white)', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {localUser?.fullName || currentAccount?.full_name || currentAccount?.name || 'Utilizador'}
            </p>
            <p style={{ color: 'var(--text-faint)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {localUser?.email || currentAccount?.account_id || currentAccount?.loginid || '-'}
            </p>
          </div>
          {isAdmin && (
            <span style={{ flexShrink: 0, padding: '2px 10px', background: 'rgba(245,166,35,0.15)', color: '#f5a623', fontSize: 11, fontWeight: 700, borderRadius: 20, border: '1px solid rgba(245,166,35,0.3)' }}>
              ADMIN
            </span>
          )}
        </div>

        {/* Secção principal */}
        <div className="card" style={{ marginBottom: 12, padding: 6 }}>
          <MenuItem onClick={() => { show('A carregar...'); navigate('/dashboard') }}
            icon={<IoGridOutline size={ICON} />}
            label="DASHBOARD" color="var(--blue-hi)" />
          <MenuItem onClick={() => { show('A carregar...'); navigate('/dashboard') }}
            icon={<IoHardwareChipOutline size={ICON} />}
            label="OPERAR COM ROBÔS" color="var(--green)" />
          <MenuItem
            href={`https://hub.deriv.com/tradershub/signup?t=hCp-xUFsKsktJe5FDKcTD2Nd7ZgqdRLk&utm_campaign=NEXORA&utm_medium=affiliate&utm_source=hCp-xUFsKsktJe5FDKcTD2Nd7ZgqdRLk`}
            external icon={<IoPersonAddOutline size={ICON} />}
            label="CADASTRO NA CORRETORA" color="var(--red-hi)" />
          <MenuItem onClick={goToAprenderAOperar}
            icon={<IoSchoolOutline size={ICON} />}
            label="APRENDE A OPERAR" color="#f5a623" />
          <MenuItem
            href={MENTORIA_VIP_LINK}
            external icon={<IoLogoWhatsapp size={ICON} />}
            label="MENTORIA VIP WHATSAPP" color="var(--green)" />
          <MenuItem
            href={`https://wa.me/${WHATSAPP}?text=Ol%C3%A1%2C%20preciso%20de%20suporte`}
            external icon={<IoHeadsetOutline size={ICON} />}
            label="FALAR COM SUPORTE" color="var(--blue-hi)" />
        </div>

        {/* Som de ganho (gain) */}
        <div className="card" style={{ marginBottom: 12, padding: 6 }}>
          <button onClick={handleToggleSound} style={rowBtnStyle}>
            <span style={iconBoxStyle(soundOn ? 'var(--green)' : 'var(--text-faint)')}>
              {soundOn ? <IoVolumeHighOutline size={ICON} /> : <IoVolumeMuteOutline size={ICON} />}
            </span>
            <span style={{ flex: 1, color: 'var(--white)', fontSize: 14, fontWeight: 600, textAlign: 'left' }}>SOM DE GANHO</span>
            <span style={{
              position: 'relative', width: 44, height: 24, borderRadius: 12,
              background: soundOn ? 'var(--blue)' : 'var(--border-hi)', transition: 'background .15s', flexShrink: 0,
            }}>
              <span style={{
                position: 'absolute', top: 2, left: soundOn ? 22 : 2, width: 20, height: 20, borderRadius: '50%',
                background: 'white', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
              }} />
            </span>
          </button>
        </div>

        {/* Avisos */}
        <div className="card" style={{ marginBottom: 12, padding: 6 }}>
          <button onClick={() => setAvisosOpen(o => !o)} style={rowBtnStyle}>
            <span style={iconBoxStyle('#f5a623')}>
              <IoNotificationsOutline size={ICON} />
            </span>
            <span style={{ flex: 1, color: 'var(--white)', fontSize: 14, fontWeight: 600, textAlign: 'left' }}>AVISOS</span>
            {LOCAL_AVISOS.length > 0 && (
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--red)', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {LOCAL_AVISOS.length}
              </span>
            )}
            <IoChevronDown size={16} color="var(--text-faint)" style={{ transform: avisosOpen ? 'rotate(180deg)' : undefined, transition: 'transform .2s', flexShrink: 0 }} />
          </button>
          {avisosOpen && (
            <div style={{ margin: '4px 8px 8px', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
              {LOCAL_AVISOS.map((aviso, idx) => (
                <div key={aviso.id} style={{ padding: '12px 14px', background: 'var(--bg-card-hi)', borderBottom: idx < LOCAL_AVISOS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <span style={{ color: 'var(--white)', fontSize: 12, fontWeight: 600 }}>{aviso.titulo}</span>
                    <span style={{ color: 'var(--text-faint)', fontSize: 11, flexShrink: 0 }}>{aviso.data}</span>
                  </div>
                  <p style={{ color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.5 }}>{aviso.mensagem}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Termos */}
        <div className="card" style={{ marginBottom: 12, padding: 6 }}>
          <button onClick={() => setTermosOpen(o => !o)} style={rowBtnStyle}>
            <span style={iconBoxStyle()}>
              <IoDocumentTextOutline size={ICON} />
            </span>
            <span style={{ flex: 1, color: 'var(--white)', fontSize: 14, fontWeight: 600, textAlign: 'left' }}>TERMOS E CONDIÇÕES</span>
            <IoChevronDown size={16} color="var(--text-faint)" style={{ transform: termosOpen ? 'rotate(180deg)' : undefined, transition: 'transform .2s', flexShrink: 0 }} />
          </button>
          {termosOpen && (
            <div style={{ margin: '4px 8px 8px', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-card-hi)', padding: '14px 16px', maxHeight: 240, overflowY: 'auto' }}>
              <pre style={{ color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)' }}>{TERMOS}</pre>
            </div>
          )}
        </div>

        {/* Logout */}
        <div className="card" style={{ marginBottom: isAdmin ? 12 : 0, padding: 6 }}>
          <button onClick={handleLogout} style={rowBtnStyle}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(233,32,63,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <span style={iconBoxStyle('var(--red-hi)', 'rgba(233,32,63,0.1)')}>
              <IoLogOutOutline size={ICON} />
            </span>
            <span style={{ color: 'var(--red-hi)', fontSize: 14, fontWeight: 600 }}>SAIR</span>
          </button>
        </div>

        {/* Botão Admin — só aparece para quem tem role 'admin' */}
        {isAdmin && (
          <div className="card" style={{ padding: 6 }}>
            <MenuItem onClick={goToAdmin}
              icon={<IoShieldCheckmarkOutline size={ICON} />}
              label="PAINEL ADMIN" color="#f5a623" />
          </div>
        )}
      </div>
    </div>
  )
}
