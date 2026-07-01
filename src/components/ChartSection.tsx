// ============================================================
// NEXORA FOREX — Chart Section
//
// Abre a sua própria WebSocket pública da Deriv
// (wss://api.derivws.com/trading/v1/options/ws/public)
// para receber ticks em tempo real do símbolo escolhido.
//
// Porquê WS própria e não via backend?
//   - O endpoint /ws/public não requer autenticação e não usa
//     o limite de 5 ligações autenticadas por conta.
//   - O backend não subscreve ticks automaticamente (só balance
//     e transaction). O chart precisa de dados contínuos mesmo
//     sem bots a correr.
//   - Ticks públicos são dados de mercado abertos — não há
//     dados privados do utilizador expostos.
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react'

const PUBLIC_WS = 'wss://api.derivws.com/trading/v1/options/ws/public'
const PING_INTERVAL = 25_000
const RECONNECT_DELAY = 2_000

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

// ── Helpers ──────────────────────────────────────────────────

function lastDigit(quote: number): number {
  const s = quote.toFixed(2)
  return parseInt(s[s.length - 1], 10)
}

function computeStats(digits: number[], window: number) {
  const slice  = digits.slice(-window)
  const counts = Array(10).fill(0) as number[]
  slice.forEach(d => counts[d]++)
  const total  = slice.length || 1
  const pcts   = counts.map(c => (c / total) * 100)
  const maxPct = Math.max(...pcts)
  const minPct = Math.min(...pcts)

  // Análise de paridade e magnitude
  let even = 0, odd = 0, over = 0, under = 0
  slice.forEach(d => {
    if (d % 2 === 0) even++; else odd++
    if (d >= 5) over++; else under++
  })

  return {
    counts,
    pcts,
    maxPct,
    minPct,
    evenPct:  total ? (even  / total) * 100 : 50,
    oddPct:   total ? (odd   / total) * 100 : 50,
    overPct:  total ? (over  / total) * 100 : 50,
    underPct: total ? (under / total) * 100 : 50,
    total: slice.length,
  }
}

// ── Tipos de análise rápida ───────────────────────────────────

function getBias(pct: number, label: string, opposite: string) {
  if (pct > 58) return { label, strength: 'Forte', color: 'var(--blue-hi)' }
  if (pct > 53) return { label, strength: 'Leve',  color: 'var(--blue-hi)' }
  if (pct < 42) return { label: opposite, strength: 'Forte', color: 'var(--red-hi)' }
  if (pct < 47) return { label: opposite, strength: 'Leve',  color: 'var(--red-hi)' }
  return { label: 'Neutro', strength: '', color: 'var(--text-faint)' }
}

// ── Componente principal ──────────────────────────────────────

export function ChartSection() {
  const [symbol, setSymbol]     = useState('1HZ100V')
  const [window, setWindow]     = useState(100)
  const [wsState, setWsState]   = useState<'connecting'|'live'|'error'>('connecting')
  const [lastQuote, setLastQ]   = useState<number | null>(null)
  const [lastDigits, setLDs]    = useState<number[]>([])
  const [tickCount, setTkCnt]   = useState(0)
  const [smooth, setSmooth]     = useState<number[]>(Array(10).fill(10))
  const [stats, setStats]       = useState(() => computeStats([], 100))

  const [showSymDrop, setShowSD]  = useState(false)
  const [showWinDrop, setShowWD]  = useState(false)

  const histRef   = useRef<number[]>([])
  const wsRef     = useRef<WebSocket | null>(null)
  const pingRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted   = useRef(true)
  const symRef    = useRef(symbol)
  symRef.current  = symbol

  // RAF para animação suave das barras
  const targetRef = useRef<number[]>(Array(10).fill(10))
  const smoothRef = useRef<number[]>(Array(10).fill(10))
  const rafRef    = useRef<number | null>(null)

  // ── Loop RAF — anima as barras suavemente ─────────────────
  useEffect(() => {
    let running = true
    const loop = () => {
      if (!running) return
      const s = smoothRef.current
      const t = targetRef.current
      let dirty = false
      for (let i = 0; i < 10; i++) {
        const d = t[i] - s[i]
        if (Math.abs(d) > 0.015) { s[i] += d * 0.14; dirty = true }
        else s[i] = t[i]
      }
      if (dirty) setSmooth([...s])
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { running = false; if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  // ── Conexão WebSocket pública ─────────────────────────────
  const connect = useCallback(() => {
    if (!mounted.current) return
    if (pingRef.current) clearInterval(pingRef.current)
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }

    const ws = new WebSocket(PUBLIC_WS)
    wsRef.current = ws
    setWsState('connecting')

    ws.onopen = () => {
      if (!mounted.current) { ws.close(); return }
      setWsState('live')
      ws.send(JSON.stringify({ ticks: symRef.current, subscribe: 1, req_id: 1 }))
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ ping: 1 }))
      }, PING_INTERVAL)
    }

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data as string)
      if (data.error || data.msg_type !== 'tick' || !data.tick) return
      const quote = data.tick.quote as number
      const digit = lastDigit(quote)

      histRef.current.push(digit)
      if (histRef.current.length > 2000) histRef.current = histRef.current.slice(-2000)

      const s = computeStats(histRef.current, window)
      targetRef.current = s.pcts
      setStats(s)
      setLastQ(quote)
      setTkCnt(c => c + 1)
      setLDs(prev => { const n = [...prev, digit]; return n.length > 30 ? n.slice(-30) : n })
    }

    ws.onerror = () => { if (!mounted.current) return; setWsState('error') }
    ws.onclose = () => {
      if (!mounted.current) return
      setWsState('connecting')
      if (pingRef.current) clearInterval(pingRef.current)
      reconnRef.current = setTimeout(connect, RECONNECT_DELAY)
    }
  }, [window]) // eslint-disable-line

  // Reconectar quando o símbolo muda
  useEffect(() => {
    histRef.current = []
    setLDs([])
    setTkCnt(0)
    setLastQ(null)
    targetRef.current = Array(10).fill(10)
    smoothRef.current = Array(10).fill(10)
    setSmooth(Array(10).fill(10))
    connect()
    return () => {
      if (pingRef.current) clearInterval(pingRef.current)
      if (reconnRef.current) clearTimeout(reconnRef.current)
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
    }
  }, [symbol]) // eslint-disable-line

  // Montar/desmontar
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (pingRef.current) clearInterval(pingRef.current)
      if (reconnRef.current) clearTimeout(reconnRef.current)
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
    }
  }, [])

  // Recalcular stats quando a janela muda (sem reconectar)
  useEffect(() => {
    const s = computeStats(histRef.current, window)
    targetRef.current = s.pcts
    setStats(s)
  }, [window])

  const symLabel  = SYMBOLS.find(s => s.value === symbol)?.label ?? symbol
  const maxSmooth = Math.max(...smooth)
  const minSmooth = Math.min(...smooth)

  const evenBias  = getBias(stats.evenPct,  'Par',   'Ímpar')
  const overBias  = getBias(stats.overPct,  'Over5', 'Under5')

  // Dígito mais quente e mais frio
  const hotDigit  = stats.pcts.indexOf(stats.maxPct)
  const coldDigit = stats.pcts.indexOf(stats.minPct)

  return (
    <div className="card" style={{ overflow: 'hidden' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        background: 'rgba(0,0,0,0.2)',
      }}>
        {/* Estado + símbolo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={`dot ${wsState === 'live' ? 'live' : wsState === 'error' ? 'off' : 'warn'}`} />
          {/* Seletor de símbolo */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => { setShowSD(o => !o); setShowWD(false) }} style={{
              background: 'var(--bg-card-hi)', border: '1px solid var(--border-hi)', borderRadius: 8,
              padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            }}>
              <span style={{ color: 'var(--white)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{symLabel}</span>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none"
                style={{ transform: showSymDrop ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}>
                <path d="M3 4.5L6 7.5L9 4.5" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showSymDrop && (
              <div className="card" style={{ position: 'absolute', top: '110%', left: 0, padding: 4, zIndex: 60, minWidth: 140 }}>
                {SYMBOLS.map(s => (
                  <button key={s.value} onClick={() => { setSymbol(s.value); setShowSD(false) }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8, fontSize: 13,
                      color: symbol === s.value ? 'var(--blue-hi)' : 'var(--text)',
                      fontWeight: symbol === s.value ? 700 : 400, background: 'transparent',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Cotação actual */}
          {lastQuote !== null && (
            <span className="tabular" style={{ color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
              {lastQuote.toFixed(2)}
            </span>
          )}
          <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>{tickCount} ticks</span>
        </div>

        {/* Seletor de janela */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => { setShowWD(o => !o); setShowSD(false) }} style={{
            background: 'var(--bg-card-hi)', border: '1px solid var(--border-hi)', borderRadius: 8,
            padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          }}>
            <span style={{ color: 'var(--white)', fontSize: 13, fontWeight: 600 }}>{window} ticks</span>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"
              style={{ transform: showWinDrop ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}>
              <path d="M3 4.5L6 7.5L9 4.5" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {showWinDrop && (
            <div className="card" style={{ position: 'absolute', top: '110%', right: 0, padding: 4, zIndex: 60, minWidth: 120 }}>
              {WINDOWS.map(w => (
                <button key={w} onClick={() => { setWindow(w); setShowWD(false) }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8, fontSize: 13,
                    color: window === w ? 'var(--blue-hi)' : 'var(--text)',
                    fontWeight: window === w ? 700 : 400, background: 'transparent',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {w} ticks
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Gráfico de barras ──────────────────────────────── */}
      <div style={{ padding: '16px 12px 8px', height: 180, display: 'flex', alignItems: 'flex-end', gap: 5 }}>
        {smooth.map((pct, digit) => {
          const isHot  = digit === hotDigit
          const isCold = digit === coldDigit
          const barH   = Math.max((pct / (maxSmooth + 4)) * 100, 4)
          const barColor = isHot ? 'var(--green)' : isCold ? 'var(--red)' : 'var(--border-hi)'

          return (
            <div key={digit} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
              {/* Percentagem */}
              <span className="tabular" style={{
                fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                color: isHot ? 'var(--green)' : isCold ? 'var(--red)' : 'var(--text-dim)',
              }}>
                {pct.toFixed(1)}
              </span>
              {/* Barra */}
              <div style={{ width: '100%', position: 'relative' }}>
                {/* Barra de fundo (baseline) */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'var(--border)', borderRadius: 2 }} />
                {/* Barra animada */}
                <div style={{
                  width: '100%',
                  height: `${barH * 1.4}px`,
                  maxHeight: 130,
                  background: isHot
                    ? 'linear-gradient(to top, var(--green), rgba(24,201,122,0.4))'
                    : isCold
                      ? 'linear-gradient(to top, var(--red), rgba(233,32,63,0.4))'
                      : 'linear-gradient(to top, var(--border-hi), rgba(44,61,99,0.4))',
                  borderRadius: '4px 4px 0 0',
                  boxShadow: isHot ? '0 0 10px rgba(24,201,122,0.3)' : isCold ? '0 0 10px rgba(233,32,63,0.3)' : 'none',
                }} />
              </div>
              {/* Dígito + ícone hot/cold */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  color: isHot ? 'var(--green)' : isCold ? 'var(--red)' : 'var(--text-dim)',
                }}>
                  {digit}
                </span>
                <span style={{ fontSize: 8 }}>{isHot ? '🔥' : isCold ? '❄️' : ''}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Painel de análise rápida ─────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: 1, margin: '0 12px 12px', borderRadius: 10, overflow: 'hidden',
        border: '1px solid var(--border)',
      }}>
        {[
          { label: 'Par',    value: stats.evenPct,  alt: 'Ímpar',  altV: stats.oddPct   },
          { label: 'Ímpar',  value: stats.oddPct,   alt: 'Par',    altV: stats.evenPct  },
          { label: 'Over 5', value: stats.overPct,  alt: 'Under 5',altV: stats.underPct },
          { label: 'Under 5',value: stats.underPct, alt: 'Over 5', altV: stats.overPct  },
        ].map(item => {
          const isHot = item.value > 53
          const isCold = item.value < 47
          return (
            <div key={item.label} style={{ background: 'var(--bg-card-hi)', padding: '10px 8px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-faint)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{item.label}</p>
              <p className="tabular" style={{
                fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)',
                color: isHot ? 'var(--green)' : isCold ? 'var(--red-hi)' : 'var(--text)',
              }}>
                {item.value.toFixed(1)}%
              </p>
              {/* Mini barra de progresso */}
              <div style={{ height: 2, background: 'var(--border)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${item.value}%`,
                  background: isHot ? 'var(--green)' : isCold ? 'var(--red)' : 'var(--border-hi)',
                  borderRadius: 2, transition: 'width 0.4s',
                }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Sinal de análise ──────────────────────────────── */}
      {stats.total >= 25 && (
        <div style={{
          margin: '0 12px 12px', padding: '10px 14px', borderRadius: 10,
          background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 1 }}>Sinal</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: evenBias.color }}>
              {evenBias.label}{evenBias.strength ? ` (${evenBias.strength})` : ''}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 1 }}>Magnitude</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: overBias.color }}>
              {overBias.label}{overBias.strength ? ` (${overBias.strength})` : ''}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Hot</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>{hotDigit}</span>
            <span style={{ color: 'var(--border-hi)' }}>·</span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Cold</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--red-hi)', fontFamily: 'var(--font-mono)' }}>{coldDigit}</span>
          </div>
        </div>
      )}

      {/* ── Tira de últimos dígitos ───────────────────────── */}
      <div style={{ padding: '10px 14px 14px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <span style={{ color: 'var(--text-faint)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, flexShrink: 0 }}>
            Últimos
          </span>
          {lastDigits.length === 0 ? (
            <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>
              {wsState === 'connecting' ? 'A ligar...' : wsState === 'error' ? 'Erro de ligação' : 'Aguardando...'}
            </span>
          ) : (
            lastDigits.map((d, i) => {
              const isNewest = i === lastDigits.length - 1
              const isHot  = d === hotDigit
              const isCold = d === coldDigit
              const bg = isNewest
                ? 'rgba(24,87,255,0.25)'
                : isHot  ? 'rgba(24,201,122,0.12)'
                : isCold ? 'rgba(233,32,63,0.12)'
                : 'var(--bg-card-hi)'
              const col = isNewest
                ? 'var(--blue-hi)'
                : isHot  ? 'var(--green)'
                : isCold ? 'var(--red-hi)'
                : 'var(--text)'
              const border = isNewest
                ? '1px solid rgba(24,87,255,0.5)'
                : isHot  ? '1px solid rgba(24,201,122,0.3)'
                : isCold ? '1px solid rgba(233,32,63,0.3)'
                : '1px solid var(--border)'

              return (
                <span key={i} className="tabular" style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  width: isNewest ? 26 : 22, height: isNewest ? 26 : 22,
                  fontSize: isNewest ? 13 : 11, fontWeight: 700, borderRadius: 6,
                  background: bg, color: col, border,
                  transform: isNewest ? 'scale(1.1)' : undefined,
                  opacity: 0.35 + (i / lastDigits.length) * 0.65,
                  fontFamily: 'var(--font-mono)',
                }}>
                  {d}
                </span>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
