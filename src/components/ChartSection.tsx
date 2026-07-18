// ============================================================
// NEXORA FOREX — ChartSection  v4
// Design: igual à imagem de referência
//   - Barras neutras: cinza azulado (paleta Bertoni)
//   - Barra hot (máx): verde sólido (#2e7d32)
//   - Barras cold (mín): vermelho sólido (#c62828)
//   - Sem gradientes, sem glow, sem neon — flat e limpo
//   - Header: ícone | Last Digits: X | N ticks | selector
// Lógica de dados: idêntica (WS pública + ticks_history)
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react'

// ── Config ───────────────────────────────────────────────────
const PUBLIC_WS    = 'wss://api.derivws.com/trading/v1/options/ws/public'
const HISTORY_LOAD = 1000
const ANIM_MS       = 300   // duração fixa da animação linear das barras/percentagens
const PING_MS       = 25_000
const RECONNECT_MS  = 2_500

// Cores exactas da imagem de referência
const COLOR_HOT     = '#2e7d32'   // verde sólido — barra dominante
const COLOR_COLD    = '#c62828'   // vermelho sólido — barras mais fracas
const COLOR_NEUTRAL = '#b8bcc8'   // cinza claro — barras neutras (exato da imagem de referência)

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

// ── Utilitários ───────────────────────────────────────────────
function lastDigit(q: number): number {
  const s = q.toFixed(2)
  return parseInt(s[s.length - 1], 10)
}

function calcPcts(hist: number[], win: number): number[] {
  const slice  = hist.slice(-win)
  const counts = Array(10).fill(0) as number[]
  slice.forEach(d => counts[d]++)
  const n = slice.length || 1
  return counts.map(c => (c / n) * 100)
}

function calcAll(hist: number[], win: number) {
  const slice  = hist.slice(-win)
  const n      = slice.length || 1
  const counts = Array(10).fill(0) as number[]
  let even = 0, over = 0
  slice.forEach(d => { counts[d]++; if (d % 2 === 0) even++; if (d >= 5) over++ })
  const pcts   = counts.map(c => (c / n) * 100)
  const maxPct = Math.max(...pcts)
  const minPct = Math.min(...pcts)
  return {
    pcts, maxPct, minPct,
    hotDigit:  pcts.indexOf(maxPct),
    coldDigit: pcts.indexOf(minPct),
    evenPct:   (even / n) * 100,
    overPct:   (over / n) * 100,
    total:     slice.length,
  }
}

// ── Ícones inline (sem dependências externas) ─────────────────
const IconBar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="2"  y="12" width="4" height="10" rx="1"/>
    <rect x="9"  y="7"  width="4" height="15" rx="1"/>
    <rect x="16" y="3"  width="4" height="19" rx="1"/>
  </svg>
)
const IconChevron = ({ up }: { up?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d={up ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'}/>
  </svg>
)
const IconLandscape = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <path d="M21 15l-5-5L5 21"/>
  </svg>
)

// ── Componente principal ──────────────────────────────────────
export function ChartSection() {
  const [symbol,  setSymbol]  = useState('1HZ100V')
  const [win,     setWin]     = useState(25)
  const [phase,   setPhase]   = useState<'connecting'|'loading'|'live'|'error'>('connecting')
  const [quote,   setQuote]   = useState<number | null>(null)
  const [tkCnt,   setTkCnt]   = useState(0)
  const [info,    setInfo]    = useState(() => calcAll([], 25))
  const [bars,    setBars]    = useState<number[]>(Array(10).fill(0))
  const [winOpen, setWinOpen] = useState(false)

  // Refs internas
  const hist      = useRef<number[]>([])
  const target    = useRef<number[]>(Array(10).fill(0))
  const current   = useRef<number[]>(Array(10).fill(0))
  const animating = useRef(false)
  const animStart = useRef<number[]>(Array(10).fill(0))
  const animT0    = useRef(0)
  const wsRef     = useRef<WebSocket | null>(null)
  const pingRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted   = useRef(true)
  const winRef    = useRef(win)
  const symRef    = useRef(symbol)
  winRef.current  = win
  symRef.current  = symbol

  // ── RAF — animação linear (normal), sem easing/curva cúbica ─
  const startRaf = useCallback(() => {
    animStart.current = [...current.current]
    animT0.current = performance.now()
    if (animating.current) return
    animating.current = true
    const tick = (now: number) => {
      if (!mounted.current) { animating.current = false; return }
      const elapsed = now - animT0.current
      const p = Math.min(1, elapsed / ANIM_MS) // progresso linear, 0→1
      const s = animStart.current
      const t = target.current
      const c = current.current
      for (let i = 0; i < 10; i++) {
        c[i] = s[i] + (t[i] - s[i]) * p
      }
      setBars([...c])
      if (p < 1) { requestAnimationFrame(tick) }
      else       { animating.current = false }
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
    const pcts = calcPcts(hist.current, winRef.current)
    const all  = calcAll(hist.current, winRef.current)
    applyPcts(pcts, false)
    setInfo(all)
    setQuote(price)
    setTkCnt(hist.current.length)

    setPhase('live')
  }, [applyPcts])

  const connect = useCallback((sym: string) => {
    if (pingRef.current)   clearInterval(pingRef.current)
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
        const pcts = calcPcts(hist.current, winRef.current)
        const all  = calcAll(hist.current, winRef.current)
        applyPcts(pcts, true)   // snap — sem animar do zero
        setInfo(all)
        setTkCnt(hist.current.length)

        setPhase('live')
        return
      }
      if (msg.msg_type === 'tick' && msg.tick?.quote != null) {
        onTick(msg.tick.quote as number)
      }
    }

    ws.onerror = () => { if (mounted.current) setPhase('error') }
    ws.onclose = () => {
      if (!mounted.current) return
      if (pingRef.current) clearInterval(pingRef.current)
      reconnRef.current = setTimeout(() => connect(symRef.current), RECONNECT_MS)
    }
  }, [applyPcts, onTick])

  useEffect(() => {
    hist.current    = []
    target.current  = Array(10).fill(0)
    current.current = Array(10).fill(0)
    setBars(Array(10).fill(0))
    setTkCnt(0)
    setQuote(null)
    setInfo(calcAll([], win))
    connect(symbol)
  }, [symbol]) // eslint-disable-line

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (pingRef.current)   clearInterval(pingRef.current)
      if (reconnRef.current) clearTimeout(reconnRef.current)
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
    }
  }, [])

  useEffect(() => {
    if (hist.current.length === 0) return
    const pcts = calcPcts(hist.current, win)
    const all  = calcAll(hist.current, win)
    applyPcts(pcts, false)
    setInfo(all)
  }, [win, applyPcts])

  // Cor de cada barra — flat, sem gradiente
  const maxPct = info.maxPct
  const minPct = info.minPct

  function getBarColor(pct: number): string {
    if (Math.abs(pct - maxPct) < 0.01) return COLOR_HOT
    if (Math.abs(pct - minPct) < 0.01) return COLOR_COLD
    return COLOR_NEUTRAL
  }

  const lastD    = hist.current.length > 0 ? hist.current[hist.current.length - 1] : null
  const maxBar   = Math.max(...bars, 10)
  const symLabel = SYMBOLS.find(s => s.value === symbol)?.label ?? symbol

  return (
    <div className="card" style={{ overflow: 'visible' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'clamp(4px, 1.5vw, 10px)',
        padding: 'clamp(8px, 2vw, 10px) clamp(8px, 3vw, 14px)', borderBottom: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        {/* Ícone + estado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <div style={{
            width: 'clamp(26px, 7vw, 34px)', height: 'clamp(26px, 7vw, 34px)', borderRadius: 8,
            background: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#1a1a1a', flexShrink: 0,
          }}>
            <IconBar />
          </div>
          <div style={{
            width: 'clamp(26px, 7vw, 34px)', height: 'clamp(26px, 7vw, 34px)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-dim)', flexShrink: 0,
          }}>
            <IconLandscape />
          </div>
        </div>

        {/* Label central */}
        <div style={{ flex: 1, textAlign: 'center', minWidth: 0, overflow: 'hidden' }}>
          <span style={{ fontSize: 'clamp(12px, 3.6vw, 17px)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--white)' }}>Last Digits: </span>
            <span style={{ color: lastD !== null ? COLOR_HOT : 'var(--text-dim)' }}>
              {lastD !== null ? lastD : '—'}
            </span>
          </span>
        </div>

        {/* Contagem + selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 'clamp(11px, 3.2vw, 16px)', fontWeight: 400, whiteSpace: 'nowrap' }}>
            {phase === 'loading' ? '...' : `${Math.min(info.total, win)} ticks`}
          </span>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setWinOpen(o => !o)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24,
              background: 'transparent', border: 'none',
              cursor: 'pointer', color: 'rgba(255,255,255,0.7)',
            }}>
              <IconChevron up={winOpen} />
            </button>
            {winOpen && (
              <div className="card" style={{ position: 'absolute', top: '110%', right: 0, zIndex: 70, padding: 4, minWidth: 100 }}>
                {WINDOWS.map(w => (
                  <button key={w} onClick={() => { setWin(w); setWinOpen(false) }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8,
                      fontSize: 13, background: 'transparent',
                      color: win === w ? 'var(--blue-hi)' : 'var(--text)',
                      fontWeight: win === w ? 700 : 400,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {w}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Gráfico de barras ─────────────────────────────── */}
      <div className="chart-bars-wrap" style={{ padding: 'clamp(6px, 2vw, 8px) clamp(6px, 3vw, 14px) 4px', display: 'flex', alignItems: 'flex-end', gap: 'clamp(2px, 1.2vw, 6px)', overflow: 'hidden' }}>
        {bars.map((pct, digit) => {
          const color = getBarColor(pct)
          const ratio = pct / (maxBar + 2)

          return (
            <div key={digit} style={{
              flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%',
            }}>
              {/* Percentagem — topo da barra */}
              <span className="tabular" style={{
                fontSize: 'clamp(8.5px, 2.6vw, 12px)', fontWeight: 500,
                color: 'rgba(255,255,255,0.92)', lineHeight: 1, minHeight: 14, whiteSpace: 'nowrap',
              }}>
                {pct.toFixed(1)}%
              </span>

              {/* Barra — flat, sem sombra. Altura via CSS var, ajustável por breakpoint */}
              <div style={{
                width: '100%',
                height: `max(4px, calc(var(--chart-bar-max) * ${ratio.toFixed(4)}))`,
                background: color,
                borderRadius: 0,
                flexShrink: 0,
              }} />

              {/* Dígito */}
              <span className="tabular" style={{
                fontSize: 'clamp(10px, 3vw, 15px)', fontWeight: 700,
                color: 'var(--white)', lineHeight: 1,
              }}>
                {digit}
              </span>
            </div>
          )
        })}
      </div>

    </div>
  )
}
