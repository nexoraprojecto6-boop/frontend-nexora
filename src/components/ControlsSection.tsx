import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useBots } from '../context/BotsContext'
import {
  getCommonConfigFields, STRATEGY_PARAMS_FIELDS, STRATEGY_LABELS,
} from '../lib/types'
import type { BotConfig, CatalogBot, StrategyFieldDef } from '../lib/types'
import { useLoader } from '../context/LoaderContext'
import { api } from '../lib/api'

function Field({ f, value, onChange }: { f: StrategyFieldDef; value: unknown; onChange: (v: unknown) => void }) {
  if (f.type === 'toggle') {
    return (
      <button type="button" onClick={() => onChange(!value)} style={{
        position: 'relative', width: 40, height: 20, borderRadius: 10,
        background: value ? 'var(--blue)' : 'var(--border-hi)', transition: 'background .15s',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: value ? 22 : 2, width: 16, height: 16, borderRadius: '50%',
          background: 'white', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }} />
      </button>
    )
  }
  if (f.type === 'select') {
    return (
      <select value={value as string} onChange={e => onChange(e.target.value)} className="btn-ghost" style={{
        width: '100%', padding: '10px 12px', fontSize: 14, appearance: 'none', cursor: 'pointer',
      }}>
        {f.options?.map(o => <option key={o.value} value={o.value} style={{ background: 'var(--bg-card)' }}>{o.label}</option>)}
      </select>
    )
  }
  return (
    <input type="number" value={value as number} min={f.min} max={f.max} step={f.step ?? 1}
      onChange={e => onChange(parseFloat(e.target.value) || 0)} className="btn-ghost"
      style={{ width: '100%', padding: '10px 12px', fontSize: 14 }} />
  )
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

  const handleConfirm = () => {
    onConfirm({
      symbol: cfgVals.symbol as string,
      contractType: cfgVals.contractType as string,
      duration: cfgVals.duration as number,
      durationUnit: cfgVals.durationUnit as BotConfig['durationUnit'],
      initialStake: cfgVals.initialStake as number,
      currency: 'USD',
      maxTrades: cfgVals.maxTrades as number,
      maxLoss: cfgVals.maxLoss as number,
      maxProfit: cfgVals.maxProfit as number,
      strategyParams: prmVals,
    })
    onClose()
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', zIndex: 40 }} />
      <div style={{ position: 'fixed', inset: '16px 16px auto', top: 16, zIndex: 50, maxWidth: 520, margin: '0 auto' }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <p style={{ color: 'var(--white)', fontWeight: 700, fontSize: 14 }}>{bot.name}</p>
              <p style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 2 }}>{STRATEGY_LABELS[bot.strategy]}</p>
            </div>
            <button onClick={onClose} className="btn-ghost" style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>

          <div style={{ padding: '16px 20px', maxHeight: '65vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {Object.entries(configGroups).map(([group, fields]) => (
              <div key={group}>
                <p style={{ color: 'var(--text-faint)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>{group}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {fields.map(f => (
                    <div key={f.key}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <label style={{ color: 'var(--text)', fontSize: 12, fontWeight: 500 }}>{f.label}</label>
                        {f.type === 'toggle' && <Field f={f} value={cfgVals[f.key]} onChange={v => setCfgVals(p => ({ ...p, [f.key]: v }))} />}
                      </div>
                      {f.type !== 'toggle' && <Field f={f} value={cfgVals[f.key]} onChange={v => setCfgVals(p => ({ ...p, [f.key]: v }))} />}
                      {f.description && <p style={{ color: 'var(--text-faint)', fontSize: 10, marginTop: 4 }}>{f.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {strategyFields.length > 0 && (
              <div>
                <p style={{ color: 'var(--text-faint)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Parâmetros da Estratégia</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {strategyFields.map(f => (
                    <div key={f.key}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div>
                          <label style={{ color: 'var(--text)', fontSize: 12, fontWeight: 500 }}>{f.label}</label>
                          {f.description && <p style={{ color: 'var(--text-faint)', fontSize: 10 }}>{f.description}</p>}
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

          <div style={{ display: 'flex', gap: 12, padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
            <button onClick={onClose} className="btn-ghost" style={{ padding: '10px 20px', fontSize: 14, fontWeight: 500 }}>Cancelar</button>
            <button onClick={handleConfirm} className="btn-primary" style={{ flex: 1, padding: '10px 0', fontSize: 14 }}>Confirmar</button>
          </div>
        </div>
      </div>
    </>
  )
}

export function ControlsSection() {
  const { accounts, currentAccount, setCurrentAccount } = useAuth()
  const {
    catalogBots, sessionBots, trades, openTrades, wsStatus, isLoadingCatalog,
    lastError, statusMessage, listCatalogBots, startCatalogBot, stopBot, resumeBot,
  } = useBots()
  const loader = useLoader()

  const [accLabels, setAccLabels] = useState({ realLabel: 'Real', demoLabel: 'Demo' })
  useEffect(() => { api.getAccountLabels().then(setAccLabels).catch(() => {}) }, [])

  const [showAccDrop, setShowAccDrop] = useState(false)
  const [showBotDrop, setShowBotDrop] = useState(false)
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

  const [flashClosed, setFlashClosed] = useState(false)
  const prevClosedCountRef = useRef<number>(0)

  useEffect(() => {
    const prev = prevClosedCountRef.current
    prevClosedCountRef.current = closedCountForBot
    if (closedCountForBot > prev && prev !== 0) {
      setFlashClosed(true)
      const t = setTimeout(() => setFlashClosed(false), 1200)
      return () => clearTimeout(t)
    }
  }, [closedCountForBot])

  const progressStep = !isRunning ? -1 : flashClosed ? 2 : openCountForBot > 0 ? 1 : 0
  const steps = ['Analisando', 'Contrato aberto', 'Contrato fechado']
  const [animProgress, setAnimProgress] = useState(0)

  useEffect(() => {
    const target = isRunning && progressStep >= 0 ? ((progressStep + 1) / steps.length) * 100 : 0
    const id = setInterval(() => setAnimProgress(p => { const d = target - p; return Math.abs(d) < 0.5 ? target : p + d * 0.1 }), 16)
    return () => clearInterval(id)
  }, [isRunning, progressStep])

  const { netPnL, totalWins, totalLosses } = useMemo(() => {
    const active = sessionBots.filter(b => b.stats.totalTrades > 0 || b.status === 'running')
    return {
      netPnL: active.reduce((s, b) => s + b.stats.netPnL, 0),
      totalWins: active.reduce((s, b) => s + b.stats.wins, 0),
      totalLosses: active.reduce((s, b) => s + b.stats.losses, 0),
    }
  }, [sessionBots])

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

  const handleAccSelect = async (acc: typeof accounts[number]) => {
    setShowAccDrop(false)
    if (currentAccount?.account_id === acc.account_id) return
    const label = acc.is_virtual ? `Conta ${accLabels.demoLabel}` : `Conta ${accLabels.realLabel}`
    loader.show(`A ligar a ${label}…`)
    try { await setCurrentAccount(acc); loader.complete(`${label} activa!`) } catch { loader.hide() }
  }

  const accLabel = !currentAccount ? 'Selecionar' : currentAccount.is_virtual ? accLabels.demoLabel : accLabels.realLabel
  const accColor = !currentAccount ? 'var(--text-faint)' : currentAccount.is_virtual ? 'var(--blue-hi)' : 'var(--green)'

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {lastError && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(233,32,63,0.1)', border: '1px solid rgba(233,32,63,0.25)', color: 'var(--red-hi)', fontSize: 12 }}>
            ⚠ {lastError}
          </div>
        )}
        {statusMessage && (
          <div style={{
            padding: '8px 12px', borderRadius: 8, fontSize: 12, border: '1px solid',
            background: statusMessage.kind === 'success' ? 'rgba(24,201,122,0.1)' : statusMessage.kind === 'warning' ? 'rgba(245,166,35,0.1)' : 'rgba(233,32,63,0.1)',
            borderColor: statusMessage.kind === 'success' ? 'rgba(24,201,122,0.25)' : statusMessage.kind === 'warning' ? 'rgba(245,166,35,0.25)' : 'rgba(233,32,63,0.25)',
            color: statusMessage.kind === 'success' ? 'var(--green)' : statusMessage.kind === 'warning' ? '#f5a623' : 'var(--red-hi)',
          }}>
            {statusMessage.text}
          </div>
        )}

        <div className="controls-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 8, fontWeight: 500 }}>Tipo de Conta</p>
            <button onClick={() => setShowAccDrop(!showAccDrop)} className="btn-ghost" style={{
              width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: accColor }}>{accLabel}</span>
            </button>
            {showAccDrop && (
              <div className="card" style={{ position: 'absolute', top: '105%', left: 0, right: 0, padding: 4, zIndex: 50 }}>
                {accounts.map(a => (
                  <button key={a.account_id} onClick={() => handleAccSelect(a)} style={{
                    width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13, borderRadius: 8,
                    color: currentAccount?.account_id === a.account_id ? 'var(--green)' : 'var(--text)',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {a.is_virtual ? `Conta ${accLabels.demoLabel}` : `Conta ${accLabels.realLabel}`}
                    <span style={{ color: 'var(--text-faint)', fontSize: 11 }}> — ${Number(a.balance ?? 0).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ color: 'var(--text-dim)', fontSize: 12, fontWeight: 500 }}>Estratégia</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`dot ${wsStatus === 'connected' ? 'live' : wsStatus === 'connecting' ? 'warn' : 'off'}`} />
                <button onClick={listCatalogBots} title="Recarregar" style={{ color: 'var(--text-faint)' }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={isLoadingCatalog ? { animation: 'spin 1s linear infinite' } : undefined}>
                    <path d="M1 4v5h5" /><path d="M15 12V7h-5" />
                    <path d="M13.51 5.87a6 6 0 0 0-10.16 2.14" /><path d="M2.49 10.13a6 6 0 0 0 10.16-2.14" />
                  </svg>
                </button>
              </div>
            </div>
            <button onClick={() => setShowBotDrop(!showBotDrop)} className="btn-ghost" style={{
              width: '100%', padding: '12px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0,
            }}>
              {selectedBot ? (
                <span style={{ color: 'var(--white)', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedBot.name}</span>
              ) : (
                <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>{isLoadingCatalog ? 'A carregar…' : 'Selecionar'}</span>
              )}
            </button>
            {showBotDrop && catalogBots.length > 0 && (
              <div className="card" style={{ position: 'absolute', top: '105%', left: 0, right: 0, padding: 4, zIndex: 50, maxHeight: 220, overflowY: 'auto' }}>
                {catalogBots.map(b => (
                  <button key={b.id}
                    onClick={() => { setSelectedBot(b); setPendingConfig(null); setSessionBotIdSync(null); setShowBotDrop(false) }}
                    style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 8, background: selectedBot?.id === b.id ? 'var(--border)' : 'transparent' }}>
                    <p style={{ fontSize: 13, color: 'var(--white)', fontWeight: 500 }}>{b.name}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>{STRATEGY_LABELS[b.strategy]}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 8, fontWeight: 500 }}>Risco</p>
            <button className="btn-ghost" style={{ width: '100%', padding: '12px', fontSize: 12, color: 'var(--text)' }}>
              {pendingConfig ? 'Personalizado' : 'Padrão'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => selectedBot && setShowConfig(true)} disabled={!selectedBot} title="Configurar parâmetros"
            className="btn-ghost" style={{
              width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              opacity: !selectedBot ? 0.4 : 1, cursor: !selectedBot ? 'not-allowed' : 'pointer',
              borderColor: pendingConfig ? 'var(--blue)' : undefined,
            }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={pendingConfig ? 'var(--blue-hi)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          <button onClick={handleToggle} disabled={!selectedBot || wsStatus !== 'connected' || isStarting}
            title={isStarting ? 'A iniciar…' : undefined}
            style={{
              width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              border: `2px solid ${!selectedBot || wsStatus !== 'connected' || isStarting ? 'var(--border)' : isRunning ? 'var(--red)' : isPaused ? '#f5a623' : 'var(--green)'}`,
              background: !selectedBot || wsStatus !== 'connected' || isStarting ? 'transparent' : isRunning ? 'rgba(233,32,63,0.1)' : isPaused ? 'rgba(245,166,35,0.1)' : 'rgba(24,201,122,0.1)',
              opacity: !selectedBot || wsStatus !== 'connected' || isStarting ? 0.4 : 1,
              cursor: !selectedBot || wsStatus !== 'connected' || isStarting ? 'not-allowed' : 'pointer',
            }}>
            {isStarting ? (
              <span style={{ width: 16, height: 16, border: '2px solid var(--text-dim)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            ) : isRunning ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red-hi)" strokeWidth="3" strokeLinecap="round">
                <line x1="8" y1="5" x2="8" y2="19" /><line x1="16" y1="5" x2="16" y2="19" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill={isPaused ? '#f5a623' : 'var(--green)'}><path d="M6 4l14 8-14 8V4z" /></svg>
            )}
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              {steps.map((s, i) => (
                <span key={s} style={{ fontSize: 11, fontWeight: 500, color: i <= progressStep ? 'var(--white)' : 'var(--text-faint)' }}>{s}</span>
              ))}
            </div>
            <div style={{ position: 'relative', height: 4, background: 'var(--border)', borderRadius: 4 }}>
              <div style={{ position: 'absolute', height: '100%', background: 'var(--blue)', borderRadius: 4, width: `${animProgress}%`, transition: 'width 0.5s' }} />
              {steps.map((_, i) => (
                <div key={i} style={{
                  position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, borderRadius: '50%',
                  border: `2px solid ${i <= progressStep ? 'var(--blue)' : 'var(--border-hi)'}`,
                  background: i <= progressStep ? 'white' : 'var(--bg-card-hi)',
                  left: `calc(${(i / (steps.length - 1)) * 100}% - 6px)`,
                }} />
              ))}
            </div>
          </div>
        </div>

        {sessionBots.some(b => b.stats.totalTrades > 0 || b.status === 'running') && (
          <div className="stats-strip" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 12px', borderRadius: 12, background: 'var(--bg-card-hi)', border: '1px solid var(--border)' }}>
            <div>
              <p style={{ color: 'var(--text-faint)', fontSize: 10 }}>Lucro/Prejuízo</p>
              <p className="tabular" style={{ fontSize: 15, fontWeight: 700, color: netPnL >= 0 ? 'var(--green)' : 'var(--red-hi)' }}>
                {netPnL < 0 ? '-' : ''}${Math.abs(netPnL).toFixed(2)}
              </p>
            </div>
            <div style={{ height: 32, width: 1, background: 'var(--border)' }} />
            <div>
              <p style={{ color: 'var(--text-faint)', fontSize: 10 }}>Operações</p>
              <p className="tabular" style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--green)', fontWeight: 700 }}>{totalWins}</span>
                <span style={{ color: 'var(--text-faint)', margin: '0 2px' }}>/</span>
                <span style={{ color: 'var(--red-hi)', fontWeight: 700 }}>{totalLosses}</span>
              </p>
            </div>
            <div style={{ height: 32, width: 1, background: 'var(--border)' }} />
            <div>
              <p style={{ color: 'var(--text-faint)', fontSize: 10 }}>Trades</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)' }}>{trades.length}</p>
            </div>
          </div>
        )}
      </div>

      {showConfig && selectedBot && (
        <ConfigModal bot={selectedBot} onClose={() => setShowConfig(false)} onConfirm={setPendingConfig} />
      )}
    </>
  )
}
