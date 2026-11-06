import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  IoSwapHorizontal, IoPlay, IoPause, IoInformationCircleOutline,
  IoSettingsOutline, IoClose, IoChevronDown,
} from 'react-icons/io5'
import { useAuth } from '../context/AuthContext'
import { useBots } from '../context/BotsContext'
import {
  getCommonConfigFields, STRATEGY_PARAMS_FIELDS, STRATEGY_LABELS,
} from '../lib/types'
import type { BotConfig, CatalogBot, StrategyFieldDef } from '../lib/types'
import { useLoader } from '../context/LoaderContext'
import { api } from '../lib/api'

// ── Portal: monta o conteúdo direto no <body>, fora de qualquer
//    container com overflow/scroll, para evitar o bug de mobile
//    onde position:fixed aninhado em overflow:auto não centraliza
//    corretamente (comum em iOS Safari / alguns WebViews Android) ──
function Portal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body)
}

// Altura/tamanhos fluidos dos botões da grelha de controlo
const CTRL_H = 'clamp(40px, 10.5vw, 46px)'
const CTRL_LABEL: React.CSSProperties = {
  color: '#e5e5ea', fontSize: 'clamp(11px, 3vw, 13px)', marginBottom: 6, fontWeight: 500,
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}
const CTRL_ICON_BOX: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  width: 'clamp(22px, 6vw, 30px)', height: 'clamp(22px, 6vw, 30px)', borderRadius: 4,
  background: 'rgba(255,255,255,0.08)', color: 'var(--text-dim)',
}

// ── Input numérico controlado por texto local ──────────────────
function NumberField({ f, value, onChange }: { f: StrategyFieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const toText = (v: unknown) => (v === undefined || v === null || Number.isNaN(v as number) ? '' : String(v))
  const [raw, setRaw] = useState<string>(toText(value))

  const userClearedRef = useRef(false)
  useEffect(() => {
    if (userClearedRef.current) return
    setRaw(toText(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <input
      type="number"
      value={raw}
      min={f.min}
      max={f.max}
      step={f.step ?? 1}
      onChange={(e) => {
        const v = e.target.value
        setRaw(v)

        if (v === '' || v === '-') {
          userClearedRef.current = true
          onChange(undefined)
          return
        }

        userClearedRef.current = false
        const parsed = parseFloat(v)
        if (!Number.isNaN(parsed)) onChange(parsed)
      }}
      onBlur={() => {}}
      className="btn-ghost tabular"
      style={{ width: '100%', padding: '10px 12px', fontSize: 14, minHeight: 40 }}
    />
  )
}

function Field({ f, value, onChange }: { f: StrategyFieldDef; value: unknown; onChange: (v: unknown) => void }) {
  if (f.type === 'toggle') {
    return (
      <button type="button" onClick={() => onChange(!value)} aria-pressed={!!value} style={{
        position: 'relative', width: 40, height: 22, borderRadius: 4, flexShrink: 0,
        background: value ? 'var(--blue)' : 'var(--border-hi)', transition: 'background .15s',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: value ? 20 : 2, width: 18, height: 18, borderRadius: 2,
          background: 'white', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }} />
      </button>
    )
  }
  if (f.type === 'select') {
    return (
      <div style={{ position: 'relative' }}>
        <select value={value as string} onChange={e => onChange(e.target.value)} className="btn-ghost" style={{
          width: '100%', padding: '10px 36px 10px 12px', fontSize: 14, minHeight: 40, appearance: 'none', cursor: 'pointer',
        }}>
          {f.options?.map(o => <option key={o.value} value={o.value} style={{ background: 'var(--bg-card)' }}>{o.label}</option>)}
        </select>
        <IoChevronDown size={16} color="var(--text-faint)" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
      </div>
    )
  }
  return <NumberField f={f} value={value} onChange={onChange} />
}

function sanitizeNumericValues(
  vals: Record<string, unknown>,
  fields: StrategyFieldDef[],
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...vals }
  fields.forEach((f) => {
    if (f.type === 'toggle' || f.type === 'select') return
    const v = out[f.key]
    if (v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v))) {
      out[f.key] = f.defaultValue !== undefined ? f.defaultValue : 0
    }
  })
  return out
}

const groupTitle: React.CSSProperties = {
  color: 'var(--text-faint)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12,
}

function ConfigModal({ bot, onClose, onConfirm }: { bot: CatalogBot; onClose: () => void; onConfirm: (c: Partial<BotConfig>) => void }) {
  const commonFields = useMemo(() => getCommonConfigFields(bot.strategy), [bot.strategy])

  const [cfgVals, setCfgVals] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {}
    commonFields.forEach(f => {
      const catalogVal = (bot.defaultConfig as unknown as Record<string, unknown>)[f.key]
      v[f.key] = catalogVal !== undefined ? catalogVal : f.defaultValue
    })
    return v
  })

  const [prmVals, setPrmVals] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {}
    const fields = STRATEGY_PARAMS_FIELDS[bot.strategy] ?? []
    fields.forEach(f => {
      const catalogVal = (bot.defaultConfig.strategyParams ?? {})[f.key]
      v[f.key] = catalogVal !== undefined ? catalogVal : f.defaultValue
    })
    return v
  })

  const configGroups = useMemo(() => {
    const g: Record<string, StrategyFieldDef[]> = {}
    commonFields.forEach(f => { const k = f.group ?? 'Geral'; (g[k] ||= []).push(f) })
    return g
  }, [commonFields])

  const strategyFields = STRATEGY_PARAMS_FIELDS[bot.strategy] ?? []

  // Aviso (só informativo): perda máxima muito acima do take profit significa
  // muitas pequenas vitórias contra uma perda grande — com contratos de
  // dígitos (sem vantagem estatística) isso acaba quase sempre em saldo negativo.
  const riskWarning = useMemo(() => {
    const loss = Number(cfgVals.maxLoss)
    const profit = Number(cfgVals.maxProfit)
    if (!(loss > 0) || !(profit > 0)) return null
    const ratio = loss / profit
    if (ratio < 3) return null
    return `A perda máxima (${loss}) é ${ratio.toFixed(0)}× o take profit (${profit}). Cada sessão ganha pouco e pode perder muito — reduza a perda máxima ou aumente o take profit.`
  }, [cfgVals.maxLoss, cfgVals.maxProfit])

  const handleConfirm = () => {
    const cfg = sanitizeNumericValues(cfgVals, commonFields)
    const prm = sanitizeNumericValues(prmVals, strategyFields)

    onConfirm({
      symbol: cfg.symbol as string,
      contractType: cfg.contractType as string,
      duration: cfg.duration as number,
      durationUnit: cfg.durationUnit as BotConfig['durationUnit'],
      initialStake: cfg.initialStake as number,
      currency: 'USD',
      maxTrades: cfg.maxTrades as number,
      maxLoss: cfg.maxLoss as number,
      maxProfit: cfg.maxProfit as number,
      strategyParams: prm,
    })
    onClose()
  }

  // Usa o mesmo overlay/sheet do resto da app: nunca passa da altura do
  // ecrã (dvh), o corpo rola e os botões Cancelar/Confirmar ficam sempre
  // visíveis; no telemóvel abre como bottom-sheet.
  return (
    <Portal>
      <div className="glass-overlay" onClick={onClose}>
        <div className="glass-sheet" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
          <div className="glass-sheet-header">
            <div style={{ minWidth: 0 }}>
              <p style={{ color: 'var(--white)', fontWeight: 700, fontSize: 15 }}>{bot.name}</p>
              <p style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 2 }}>{STRATEGY_LABELS[bot.strategy]}</p>
            </div>
            <button onClick={onClose} aria-label="Fechar" className="btn-ghost" style={{ width: 36, height: 36, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IoClose size={18} />
            </button>
          </div>

          <div className="glass-sheet-body" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {riskWarning && (
              <div role="alert" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.45)', color: '#f59e0b', borderRadius: 6, padding: '10px 12px', fontSize: 12, lineHeight: 1.45 }}>
                ⚠️ {riskWarning}
              </div>
            )}
            {Object.entries(configGroups).map(([group, fields]) => (
              <div key={group}>
                <p style={groupTitle}>{group}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {fields.map(f => (
                    <div key={f.key}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                        <label style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>{f.label}</label>
                        {f.type === 'toggle' && <Field f={f} value={cfgVals[f.key]} onChange={v => setCfgVals(p => ({ ...p, [f.key]: v }))} />}
                      </div>
                      {f.type !== 'toggle' && <Field f={f} value={cfgVals[f.key]} onChange={v => setCfgVals(p => ({ ...p, [f.key]: v }))} />}
                      {f.description && <p style={{ color: 'var(--text-faint)', fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>{f.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {strategyFields.length > 0 && (
              <div>
                <p style={groupTitle}>Parâmetros da Estratégia</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {strategyFields.map(f => (
                    <div key={f.key}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                        <div style={{ minWidth: 0 }}>
                          <label style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>{f.label}</label>
                          {f.description && <p style={{ color: 'var(--text-faint)', fontSize: 11, lineHeight: 1.4 }}>{f.description}</p>}
                        </div>
                        {f.type === 'toggle' && <Field f={f} value={prmVals[f.key]} onChange={v => setPrmVals(p => ({ ...p, [f.key]: v }))} />}
                      </div>
                      {f.type !== 'toggle' && <Field f={f} value={prmVals[f.key]} onChange={v => setPrmVals(p => ({ ...p, [f.key]: v }))} />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <button onClick={onClose} className="btn-ghost" style={{ padding: '10px 20px', fontSize: 14, fontWeight: 500 }}>Cancelar</button>
            <button onClick={handleConfirm} className="btn-primary" style={{ flex: 1, padding: '10px 0', fontSize: 14 }}>Confirmar</button>
          </div>
        </div>
      </div>
    </Portal>
  )
}

// Passos da barra de progresso (estado real do bot)
const PROGRESS_STEPS = ['Analisando', 'Contrato aberto', 'Contrato fechado']
// Tempo mínimo a mostrar "Contrato fechado" após fechar (0 = sem confirmação).
// Se um novo contrato abrir, o estado muda de imediato para "aberto".
const CLOSED_CONFIRM_MS = 700

export function ControlsSection() {
  const navigate = useNavigate()
  const { accounts, currentAccount, setCurrentAccount, localUser } = useAuth()
  const loader = useLoader()
  // Para administradores, os nomes das contas ficam mais explícitos:
  // Demo -> "Virtual", Real -> "Ao Vivo" — independente das labels
  // globais configuráveis em accLabels (essas continuam a valer
  // para utilizadores normais, definidas em /api/admin/labels).
  const isAdmin = localUser?.role === 'admin'

  const {
    catalogBots, sessionBots, trades, openTrades, wsStatus, isLoadingCatalog,
    lastError, statusMessage, listCatalogBots, startCatalogBot, stopBot, resumeBot,
  } = useBots()
  void lastError; void statusMessage; void listCatalogBots

  const [accLabels, setAccLabels] = useState({ realLabel: 'REAL', demoLabel: 'DEMO' })
  useEffect(() => { api.getAccountLabels().then(setAccLabels).catch(() => {}) }, [])

  // Forçar maiúsculas no que aparece no ecrã, independentemente de como
  // a label vier guardada (config admin ou fallback)
  const demoLabelDisplay = (isAdmin ? 'REAL' : accLabels.demoLabel).toUpperCase()
  const realLabelDisplay = (isAdmin ? 'DEMO' : accLabels.realLabel).toUpperCase()

  // Cores também invertidas para admin: Virtual fica verde,
  // Ao Vivo fica azul (utilizadores normais: Demo=azul / Real=verde).
  const demoColorDisplay = isAdmin ? 'var(--green)' : 'var(--blue-hi)'
  const realColorDisplay = isAdmin ? 'var(--blue-hi)' : 'var(--green)'

  // ── Sheets (substituem os antigos dropdowns) ──
  const [showAccSheet, setShowAccSheet] = useState(false)
  const [showBotSheet, setShowBotSheet] = useState(false)
  const [switchingAcc, setSwitchingAcc] = useState(false)
  const [switchingBot, setSwitchingBot] = useState(false)

  const [showConfig, setShowConfig] = useState(false)
  const [selectedBot, setSelectedBot] = useState<CatalogBot | null>(null)
  const [pendingConfig, setPendingConfig] = useState<Partial<BotConfig> | null>(null)

  const [sessionBotId, setSessionBotId] = useState<string | null>(null)
  const sessionBotIdRef = useRef<string | null>(null)
  const setSessionBotIdSync = (id: string | null) => { sessionBotIdRef.current = id; setSessionBotId(id) }

  const startInFlightRef = useRef(false)
  const [isStarting, setIsStarting] = useState(false)

  useEffect(() => { if (!selectedBot && catalogBots.length > 0) setSelectedBot(catalogBots[0]) }, [catalogBots, selectedBot])

  useEffect(() => {
    const running = sessionBots.find(b => b.status === 'running' || b.status === 'paused')
    if (running && !sessionBotIdRef.current) {
      setSessionBotIdSync(running.id); startInFlightRef.current = false; setIsStarting(false)
    }
    if (sessionBotIdRef.current) {
      const tracked = sessionBots.find(b => b.id === sessionBotIdRef.current)
      if (tracked && (tracked.status === 'stopped' || tracked.status === 'error')) setSessionBotIdSync(null)
    }
  }, [sessionBots])

  const liveBot = sessionBotId ? sessionBots.find(b => b.id === sessionBotId) ?? null : null
  const isRunning = liveBot?.status === 'running'
  const isPaused = liveBot?.status === 'paused'

  const openCountForBot = sessionBotId ? Object.values(openTrades).filter(t => t.botId === sessionBotId).length : 0
  const closedCountForBot = sessionBotId ? trades.filter(t => t.botId === sessionBotId).length : 0

  // ── Barra de progresso: reflete SEMPRE o estado real do bot ──────────
  //   Analisando      → bot a correr, sem contrato aberto
  //   Contrato aberto → existe pelo menos 1 contrato aberto (prioridade máxima)
  //   Contrato fechado→ um contrato acabou de fechar; confirmação curta.
  //                     Se abrir outro, passa logo a "aberto" (nunca prende).
  // Nenhuma animação própria decide o estado — só os dados reais.
  const [showClosed, setShowClosed] = useState(false)
  const prevOpenRef = useRef(0)
  const prevClosedRef = useRef<{ id: string | null; n: number }>({ id: null, n: 0 })
  const closedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const prev = prevClosedRef.current
    const sameBot = prev.id === sessionBotId
    const closedIncreased = sameBot && closedCountForBot > prev.n
    const openFinished = sameBot && prevOpenRef.current > 0 && openCountForBot === 0

    prevClosedRef.current = { id: sessionBotId, n: closedCountForBot }
    prevOpenRef.current = openCountForBot

    if (!sameBot) {
      // Mudou de bot (ou parou): limpa qualquer "fechado" pendente
      if (closedTimerRef.current) clearTimeout(closedTimerRef.current)
      setShowClosed(false)
      return
    }
    if (closedIncreased || openFinished) {
      setShowClosed(true)
      if (closedTimerRef.current) clearTimeout(closedTimerRef.current)
      closedTimerRef.current = setTimeout(() => setShowClosed(false), CLOSED_CONFIRM_MS)
    }
  }, [openCountForBot, closedCountForBot, sessionBotId])

  useEffect(() => () => { if (closedTimerRef.current) clearTimeout(closedTimerRef.current) }, [])

  // -1 = parado/pausado sem contratos | 0 = analisando | 1 = aberto | 2 = fechado
  const progressStep = !liveBot ? -1
    : openCountForBot > 0 ? 1
    : showClosed ? 2
    : isRunning ? 0
    : -1
  const steps = PROGRESS_STEPS
  const fillPct = progressStep === 1 ? 50 : progressStep === 2 ? 100 : 0

  const { netPnL, totalWins, totalLosses } = useMemo(() => {
    const active = sessionBots.filter(b => b.stats.totalTrades > 0 || b.status === 'running')
    return {
      netPnL: active.reduce((s, b) => s + b.stats.netPnL, 0),
      totalWins: active.reduce((s, b) => s + b.stats.wins, 0),
      totalLosses: active.reduce((s, b) => s + b.stats.losses, 0),
    }
  }, [sessionBots])
  void netPnL; void totalWins; void totalLosses

  const handleToggle = () => {
    if (!selectedBot) return
    const currentId = sessionBotIdRef.current
    const currentBot = currentId ? sessionBots.find(b => b.id === currentId) : null
    if (currentBot?.status === 'running') { stopBot(currentId!); return }
    if (currentBot?.status === 'paused') { resumeBot(currentId!); return }
    if (startInFlightRef.current) return
    startInFlightRef.current = true
    setIsStarting(true)
    startCatalogBot(selectedBot.id, undefined, pendingConfig ?? undefined)
    setTimeout(() => { startInFlightRef.current = false; setIsStarting(false) }, 8000)
  }

  // ── Selecionar conta via sheet + loader ──
  const handleAccSelectSheet = async (acc: typeof accounts[number]) => {
    if (currentAccount?.account_id === acc.account_id) { setShowAccSheet(false); return }
    setSwitchingAcc(true)
    const label = acc.is_virtual ? `Conta ${demoLabelDisplay}` : `Conta ${realLabelDisplay}`
    loader.show(`A ligar a ${label}…`)
    try {
      await setCurrentAccount(acc)
      loader.complete(`${label} activa!`)
    } catch {
      loader.hide()
    } finally {
      setSwitchingAcc(false)
      setShowAccSheet(false)
    }
  }

  // ── Selecionar estratégia via sheet + loader ──
  const handleBotSelectSheet = (b: CatalogBot) => {
    if (selectedBot?.id === b.id) { setShowBotSheet(false); return }
    setSwitchingBot(true)
    loader.show('A carregar estratégia…')
    setTimeout(() => {
      setSelectedBot(b)
      setPendingConfig(null)
      setSessionBotIdSync(null)
      loader.complete('Estratégia selecionada!')
      setSwitchingBot(false)
      setShowBotSheet(false)
    }, 600)
  }

  // ── Vídeo Aula: mesma rota que "Aprende a Operar" (MenuPage) ──
  const goToAprenderAOperar = () => {
    loader.show('A abrir aula...')
    navigate('/aprender-a-operar')
    loader.complete('Pronto!')
  }

  const accLabel = !currentAccount ? 'Selecionar' : currentAccount.is_virtual ? demoLabelDisplay : realLabelDisplay
  const accColor = !currentAccount ? 'var(--text-faint)' : currentAccount.is_virtual ? demoColorDisplay : realColorDisplay

  const toggleDisabled = !selectedBot || wsStatus !== 'connected' || isStarting
  const toggleColor = toggleDisabled ? 'var(--border)' : isRunning ? 'var(--red-hi)' : isPaused ? 'var(--amber)' : 'var(--green)'

  const ctrlBtn: React.CSSProperties = {
    width: '100%', height: CTRL_H, padding: '0 clamp(6px, 2vw, 12px)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, minWidth: 0,
  }
  const ctrlText: React.CSSProperties = {
    fontSize: 'clamp(12px, 3.4vw, 15px)', fontWeight: 700,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="controls-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'clamp(6px, 2vw, 10px)' }}>
          <div style={{ minWidth: 0 }}>
            <p style={CTRL_LABEL}>Tipo de Conta</p>
            <button onClick={() => setShowAccSheet(true)} className="btn-ghost" style={ctrlBtn}>
              <span style={{ ...ctrlText, color: accColor }}>{accLabel}</span>
              <span style={CTRL_ICON_BOX}><IoSwapHorizontal size={16} /></span>
            </button>
          </div>

          <div style={{ minWidth: 0 }}>
            <p style={CTRL_LABEL}>Estratégia</p>
            <button onClick={() => setShowBotSheet(true)} className="btn-ghost" style={ctrlBtn}>
              {selectedBot ? (
                <span style={{ ...ctrlText, color: 'var(--white)' }}>{selectedBot.name}</span>
              ) : (
                <span style={{ ...ctrlText, color: 'var(--text-faint)', fontSize: 'clamp(11px, 3vw, 15px)', fontWeight: 500 }}>{isLoadingCatalog ? 'A carregar…' : 'Selecionar'}</span>
              )}
              <span style={CTRL_ICON_BOX}><IoSwapHorizontal size={16} /></span>
            </button>
          </div>

          <div style={{ minWidth: 0 }}>
            <p style={CTRL_LABEL}>Vídeo Aula</p>
            <button onClick={goToAprenderAOperar} aria-label="Vídeo Aula" style={{
              width: '100%', height: CTRL_H, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(5px, 2vw, 10px)',
              background: 'var(--red-hi)', color: '#fff',
            }}>
              <IoPlay size={18} />
              <IoInformationCircleOutline size={20} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 3vw, 16px)' }}>
          <button onClick={() => selectedBot && setShowConfig(true)} disabled={!selectedBot} title="Configurar parâmetros" aria-label="Configurar parâmetros"
            className="btn-ghost" style={{
              width: 'clamp(38px, 9.5vw, 44px)', height: 'clamp(38px, 9.5vw, 44px)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0,
              opacity: !selectedBot ? 0.4 : 1, cursor: !selectedBot ? 'not-allowed' : 'pointer',
              borderColor: pendingConfig ? 'var(--blue)' : undefined,
              color: pendingConfig ? 'var(--blue-hi)' : undefined,
            }}>
            <IoSettingsOutline size={20} />
          </button>

          <button onClick={handleToggle} disabled={toggleDisabled}
            title={isStarting ? 'A iniciar…' : undefined}
            aria-label={isRunning ? 'Parar' : 'Iniciar'}
            style={{
              width: 'clamp(40px, 10.5vw, 46px)', height: 'clamp(40px, 10.5vw, 46px)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              border: `2.5px solid ${toggleColor}`,
              background: 'transparent',
              color: toggleColor,
              opacity: toggleDisabled ? 0.4 : 1,
              cursor: toggleDisabled ? 'not-allowed' : 'pointer',
            }}>
            {isStarting ? (
              <span style={{ width: 18, height: 18, border: '2px solid var(--text-dim)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            ) : isRunning ? (
              <IoPause size={22} />
            ) : (
              <IoPlay size={22} />
            )}
          </button>

          {/* Progresso — estado real; rótulos alinhados com as bolinhas */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginBottom: 10, gap: 4 }}>
              {steps.map((s, i) => (
                <span key={s} style={{
                  fontSize: 'clamp(9px, 2.6vw, 13px)',
                  fontWeight: i === progressStep ? 700 : 500,
                  textAlign: i === 0 ? 'left' : i === steps.length - 1 ? 'right' : 'center',
                  color: i === progressStep ? 'var(--white)' : i < progressStep ? 'var(--text-dim)' : 'var(--text-faint)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  transition: 'color .2s',
                }}>{s}</span>
              ))}
            </div>
            <div style={{ position: 'relative', height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 7px' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 2,
                background: progressStep === 2 ? 'var(--green)' : 'var(--blue)',
                width: `${fillPct}%`,
                transition: 'width .3s ease, background .2s',
              }} />
              {steps.map((_, i) => {
                const reached = i <= progressStep
                const active = i === progressStep
                return (
                  <div key={i} className={active ? 'nx-step-active' : undefined} style={{
                    position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%',
                    border: `2px solid ${reached ? (progressStep === 2 && i === 2 ? 'var(--green)' : 'var(--blue)') : 'var(--border-hi)'}`,
                    background: reached ? 'white' : 'var(--bg-card-hi)',
                    left: `calc(${(i / (steps.length - 1)) * 100}% - 7px)`,
                    transition: 'background .2s, border-color .2s',
                  }} />
                )
              })}
            </div>
            <style>{`
              @keyframes nxStepPulse {
                0%   { box-shadow: 0 0 0 0 rgba(79,139,255,0.55); }
                100% { box-shadow: 0 0 0 7px rgba(79,139,255,0); }
              }
              .nx-step-active { animation: nxStepPulse 1.2s ease-out infinite; }
            `}</style>
          </div>
        </div>
      </div>

      {/* ── Sheet: Selecionar Tipo de Conta (via Portal) ── */}
      {showAccSheet && (
        <Portal>
          <div className="glass-overlay" onClick={() => !switchingAcc && setShowAccSheet(false)}>
            <div className="glass-sheet" onClick={e => e.stopPropagation()}>
              <div className="glass-sheet-header">
                <p style={{ color: 'var(--white)', fontWeight: 700, fontSize: 15 }}>Selecionar Tipo de Conta</p>
                {!switchingAcc && (
                  <button onClick={() => setShowAccSheet(false)} aria-label="Fechar" style={{ color: 'var(--text-faint)', padding: 6, display: 'inline-flex' }}>
                    <IoClose size={20} />
                  </button>
                )}
              </div>
              {switchingAcc ? (
                <div className="glass-sheet-loader">
                  <span style={{ width: 30, height: 30, border: '3px solid var(--border)', borderTopColor: 'var(--blue-hi)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>A ligar à conta…</span>
                </div>
              ) : (
                <div className="glass-sheet-body">
                  {accounts.map(a => (
                    <button key={a.account_id}
                      className={`glass-option ${currentAccount?.account_id === a.account_id ? 'active' : ''}`}
                      onClick={() => handleAccSelectSheet(a)}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: a.is_virtual ? demoColorDisplay : realColorDisplay }}>
                        {a.is_virtual ? `Conta ${demoLabelDisplay}` : `Conta ${realLabelDisplay}`}
                      </p>
                      <p style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 2 }}>
                        Saldo: <span className="tabular">${Number(a.balance ?? 0).toFixed(2)}</span>
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Portal>
      )}

      {/* ── Sheet: Selecionar Estratégia (via Portal) ── */}
      {showBotSheet && (
        <Portal>
          <div className="glass-overlay" onClick={() => !switchingBot && setShowBotSheet(false)}>
            <div className="glass-sheet" onClick={e => e.stopPropagation()}>
              <div className="glass-sheet-header">
                <p style={{ color: 'var(--white)', fontWeight: 700, fontSize: 15 }}>Selecionar Estratégia</p>
                {!switchingBot && (
                  <button onClick={() => setShowBotSheet(false)} aria-label="Fechar" style={{ color: 'var(--text-faint)', padding: 6, display: 'inline-flex' }}>
                    <IoClose size={20} />
                  </button>
                )}
              </div>
              {switchingBot ? (
                <div className="glass-sheet-loader">
                  <span style={{ width: 30, height: 30, border: '3px solid var(--border)', borderTopColor: 'var(--blue-hi)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>A carregar estratégia…</span>
                </div>
              ) : catalogBots.length === 0 ? (
                <div className="glass-sheet-loader">
                  <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>{isLoadingCatalog ? 'A carregar…' : 'Nenhuma estratégia disponível'}</span>
                </div>
              ) : (
                <div className="glass-sheet-body">
                  {catalogBots.map(b => (
                    <button key={b.id}
                      className={`glass-option ${selectedBot?.id === b.id ? 'active' : ''}`}
                      onClick={() => handleBotSelectSheet(b)}>
                      <p style={{ fontSize: 14, color: 'var(--white)', fontWeight: 700 }}>{b.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{STRATEGY_LABELS[b.strategy]}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Portal>
      )}

      {showConfig && selectedBot && (
        <ConfigModal bot={selectedBot} onClose={() => setShowConfig(false)} onConfirm={setPendingConfig} />
      )}
    </>
  )
}
