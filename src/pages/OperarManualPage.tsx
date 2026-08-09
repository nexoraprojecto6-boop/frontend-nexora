// ============================================================
// NEXORA FOREX — OperarManualPage
//
// Réplica do layout Over/Under do dtrader.deriv.com.
// Gráfico e percentagens: MESMA lógica do ChartSection.tsx
// (ligação pública direta à Deriv — não passa pelo backend,
// não depende do BotsProvider/TradingContext para os dados).
// Compra: usa useBots().manualBuy() (backend, via useNexoraWs).
//
// Esta página deve ser montada dentro de <BotsProvider> — ver
// instruções para App.tsx.
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBots } from '../contexto/BotsContext'
import type { ManualBuyParams } from '../ganchos/useNexoraWs'

const PUBLIC_WS    = 'wss://api.derivws.com/trading/v1/options/ws/public'
const HISTORY_LOAD = 1000
const ANIM_MS       = 300
const PING_MS       = 25_000
const RECONNECT_MS  = 2_500

const COLOR_HOT     = '#2e7d32'
const COLOR_COLD    = '#c62828'
const COLOR_NEUTRAL = '#b8bcc8'

const SYMBOLS = [
  { value: '1HZ100V', label: 'Vol 100 (1s)' },
  { value: '1HZ10V',  label: 'Vol 10 (1s)'  },
  { value: 'R_100',   label: 'Vol 100'       },
  { value: 'R_75',    label: 'Vol 75'        },
  { value: 'R_50',    label: 'Vol 50'        },
  { value: 'R_25',    label: 'Vol 25'        },
  { value: 'R_10',    label: 'Vol 10'        },
]
const WINDOWS = [25, 50, 100, 250, 500, 1000]
const DURATIONS = [1, 2, 3, 5, 10]

function lastDigit(q: number): number {
  const s = q.toFixed(2)
  return parseInt(s[s.length - 1], 10)
}

function calcAll(hist: number[], win: number) {
  const slice  = hist.slice(-win)
  const n      = slice.length || 1
  const counts = Array(10).fill(0) as number[]
  slice.forEach(d => { counts[d]++ })
  const pcts   = counts.map(c => (c / n) * 100)
  const maxPct = Math.max(...pcts)
  const minPct = Math.min(...pcts)
  return { pcts, maxPct, minPct, total: slice.length }
}

export default function OperarManualPage() {
  const navigate = useNavigate()
  const { manualBuy, manualPendingTrade, manualBuyError } = useBots()

  // ── Estado do gráfico / dígitos (idêntico ao ChartSection) ──
  const [symbol, setSymbol] = useState('1HZ100V')
  const [win, setWin] = useState(25)
  const [phase, setPhase] = useState<'connecting' | 'loading' | 'live' | 'error'>('connecting')
  const [tkCnt, setTkCnt] = useState(0)
  const [info, setInfo] = useState(() => calcAll([], 25))
  const [bars, setBars] = useState<number[]>(Array(10).fill(0))
  const [winOpen, setWinOpen] = useState(false)

  const hist = useRef<number[]>([])
  const target = useRef<number[]>(Array(10).fill(0))
  const current = useRef<number[]>(Array(10).fill(0))
  const animating = useRef(false)
  const animStart = useRef<number[]>(Array(10).fill(0))
  const animT0 = useRef(0)
  const wsRef = useRef<WebSocket | null>(null)
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(true)
  const winRef = useRef(win)
  const symRef = useRef(symbol)
  winRef.current = win
  symRef.current = symbol

  const startRaf = useCallback(() => {
    animStart.current = [...current.current]
    animT0.current = performance.now()
    if (animating.current) return
    animating.current = true
    const tick = (now: number) => {
      if (!mounted.current) { animating.current = false; return }
      const p = Math.min(1, (now - animT0.current) / ANIM_MS)
      const s = animStart.current, t = target.current, c = current.current
      for (let i = 0; i < 10; i++) c[i] = s[i] + (t[i] - s[i]) * p
      setBars([...c])
      if (p < 1) requestAnimationFrame(tick)
      else animating.current = false
    }
    requestAnimationFrame(tick)
  }, [])

  const applyPcts = useCallback((pcts: number[], snap = false) => {
    target.current = [...pcts]
    if (snap) { current.current = [...pcts]; setBars([...pcts]) }
    else startRaf()
  }, [startRaf])

  const onTick = useCallback((price: number) => {
    const d = lastDigit(price)
    hist.current.push(d)
    if (hist.current.length > 5000) hist.current = hist.current.slice(-5000)
    const all = calcAll(hist.current, winRef.current)
    applyPcts(all.pcts, false)
    setInfo(all)
    setTkCnt(hist.current.length)
    setPhase('live')
  }, [applyPcts])

  const connect = useCallback((sym: string) => {
    if (pingRef.current) clearInterval(pingRef.current)
    if (reconnRef.current) clearTimeout(reconnRef.current)
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }

    setPhase('connecting')
    const ws = new WebSocket(PUBLIC_WS)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mounted.current) { ws.close(); return }
      setPhase('loading')
      ws.send(JSON.stringify({ ticks_history: sym, end: 'latest', count: HISTORY_LOAD, style: 'ticks', req_id: 1 }))
      ws.send(JSON.stringify({ ticks: sym, subscribe: 1, req_id: 2 }))
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ ping: 1 }))
      }, PING_MS)
    }

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string)
      if (msg.error) return
      if (msg.msg_type === 'history' && Array.isArray(msg.history?.prices)) {
        hist.current = (msg.history.prices as number[]).map(lastDigit)
        const all = calcAll(hist.current, winRef.current)
        applyPcts(all.pcts, true)
        setInfo(all)
        setTkCnt(hist.current.length)
        setPhase('live')
        return
      }
      if (msg.msg_type === 'tick' && msg.tick?.quote != null) onTick(msg.tick.quote as number)
    }

    ws.onerror = () => { if (mounted.current) setPhase('error') }
    ws.onclose = () => {
      if (!mounted.current) return
      if (pingRef.current) clearInterval(pingRef.current)
      reconnRef.current = setTimeout(() => connect(symRef.current), RECONNECT_MS)
    }
  }, [applyPcts, onTick])

  useEffect(() => {
    hist.current = []
    target.current = Array(10).fill(0)
    current.current = Array(10).fill(0)
    setBars(Array(10).fill(0))
    setTkCnt(0)
    setInfo(calcAll([], win))
    connect(symbol)
  }, [symbol]) // eslint-disable-line

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (pingRef.current) clearInterval(pingRef.current)
      if (reconnRef.current) clearTimeout(reconnRef.current)
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
    }
  }, [])

  useEffect(() => {
    if (hist.current.length === 0) return
    const all = calcAll(hist.current, win)
    applyPcts(all.pcts, false)
    setInfo(all)
  }, [win, applyPcts])

  // ── Estado do painel de operação ─────────────────────────────
  const [tradeType, setTradeType] = useState<'over' | 'under'>('over')
  const [selectedDigit, setSelectedDigit] = useState(5)
  const [duration, setDuration] = useState(2)
  const [stake, setStake] = useState(2)

  const isBusy = !!manualPendingTrade
  const maxBar = Math.max(...bars, 10)

  function getBarColor(pct: number): string {
    if (Math.abs(pct - info.maxPct) < 0.01) return COLOR_HOT
    if (Math.abs(pct - info.minPct) < 0.01) return COLOR_COLD
    return COLOR_NEUTRAL
  }

  const handleBuy = () => {
    if (isBusy) return
    const params: ManualBuyParams = {
      symbol,
      contractType: tradeType === 'over' ? 'DIGITOVER' : 'DIGITUNDER',
      duration,
      durationUnit: 'ticks',
      stake,
      barrier: selectedDigit,
    }
    manualBuy(params)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #0b0e14)', padding: 16 }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)',
          borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontSize: 13, marginBottom: 14,
        }}
      >
        ← Voltar ao Dashboard
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16 }}>
        {/* ---------------- Gráfico + dígitos ---------------- */}
        <div className="card">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '10px 14px', borderBottom: '1px solid var(--border)',
          }}>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              style={{ background: 'var(--border)', color: 'var(--text)', border: 'none', borderRadius: 4, padding: '6px 10px', fontSize: 13 }}
            >
              {SYMBOLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: phase === 'live' ? '#3ddc84' : phase === 'error' ? '#ff5c5c' : '#e0a63d',
            }} />
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {phase === 'live' ? 'Ligado' : phase === 'error' ? 'Erro' : 'A ligar…'}
            </span>

            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-dim)' }}>
              {phase === 'loading' ? '...' : `${Math.min(info.total, win)} ticks`}
            </span>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setWinOpen(o => !o)}
                style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}
              >
                {win} ▾
              </button>
              {winOpen && (
                <div className="card" style={{ position: 'absolute', top: '110%', right: 0, zIndex: 30, padding: 4, minWidth: 90 }}>
                  {WINDOWS.map(w => (
                    <button
                      key={w}
                      onClick={() => { setWin(w); setWinOpen(false) }}
                      style={{ width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 6, fontSize: 13, background: 'transparent', color: win === w ? '#3ddc84' : 'var(--text)', fontWeight: win === w ? 700 : 400, cursor: 'pointer' }}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: 220 }}>
            {bars.map((pct, digit) => {
              const color = getBarColor(pct)
              const ratio = pct / (maxBar + 2)
              return (
                <div key={digit} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%' }}>
                  <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1 }}>{pct.toFixed(1)}%</span>
                  <div style={{ width: '100%', height: `max(4px, calc(180px * ${ratio.toFixed(4)}))`, background: color }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--white)', lineHeight: 1 }}>{digit}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ---------------- Painel de operação manual ---------------- */}
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', background: 'var(--border)', borderRadius: 20, padding: 4 }}>
            <button
              onClick={() => setTradeType('over')}
              style={{ flex: 1, padding: '8px 0', background: tradeType === 'over' ? '#3ddc84' : 'transparent', color: tradeType === 'over' ? '#0b0e14' : 'var(--text-dim)', border: 'none', borderRadius: 16, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Over
            </button>
            <button
              onClick={() => setTradeType('under')}
              style={{ flex: 1, padding: '8px 0', background: tradeType === 'under' ? '#3ddc84' : 'transparent', color: tradeType === 'under' ? '#0b0e14' : 'var(--text-dim)', border: 'none', borderRadius: 16, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Under
            </button>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>Previsão do último dígito</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {bars.map((pct, digit) => {
              const isSelected = digit === selectedDigit
              const isHigh = Math.abs(pct - info.maxPct) < 0.01
              const isLow = Math.abs(pct - info.minPct) < 0.01
              return (
                <button
                  key={digit}
                  onClick={() => setSelectedDigit(digit)}
                  style={{
                    background: 'var(--border)', border: isSelected ? '1px solid #3ddc84' : '1px solid transparent',
                    borderRadius: 6, padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--white)' }}>{digit}</span>
                  <span style={{ fontSize: 11, marginTop: 2, color: isHigh ? '#3ddc84' : isLow ? '#ff5c5c' : 'var(--text-dim)' }}>
                    {pct.toFixed(1)}%
                  </span>
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, color: 'var(--text-dim)' }}>Duração</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              style={{ background: 'var(--border)', color: 'var(--text)', border: 'none', borderRadius: 6, padding: '8px 10px', fontSize: 14 }}
            >
              {DURATIONS.map(d => <option key={d} value={d}>{d} ticks</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, color: 'var(--text-dim)' }}>Stake (USD)</label>
            <input
              type="number"
              min={0.35}
              step={0.5}
              value={stake}
              onChange={(e) => setStake(Number(e.target.value))}
              style={{ background: 'var(--border)', color: 'var(--text)', border: 'none', borderRadius: 6, padding: '8px 10px', fontSize: 14 }}
            />
          </div>

          {manualBuyError && <p style={{ fontSize: 12, color: '#ff5c5c', margin: 0 }}>{manualBuyError}</p>}

          <button
            onClick={handleBuy}
            disabled={isBusy}
            style={{ marginTop: 'auto', background: '#3ddc84', border: 'none', borderRadius: 6, padding: '12px 0', color: '#0b0e14', fontWeight: 700, fontSize: 14, cursor: isBusy ? 'default' : 'pointer', opacity: isBusy ? 0.6 : 1 }}
          >
            {isBusy ? 'Contrato em aberto…' : 'Comprar'}
          </button>
        </div>
      </div>
    </div>
  )
}
