// ============================================================
// NEXORA FOREX — ChartSection  v3  (Estado Global Sincronizado)
//
// COMO FUNCIONA A SINCRONIZAÇÃO GLOBAL:
//
//   Quando qualquer utilizador abre a plataforma:
//   1. Pede os últimos 1000 ticks históricos à Deriv
//      (ticks_history). A Deriv devolve EXACTAMENTE os mesmos
//      1000 preços para toda a gente — não importa quando
//      abriram a página.
//   2. As barras SALTAM imediatamente para os valores correctos
//      (sem animar do zero). O gráfico aparece já no estado real.
//   3. Subscreve o feed ao vivo. A partir daí, cada tick novo
//      move as barras suavemente.
//
//   Resultado: todos os utilizadores vêem o mesmo gráfico,
//   os mesmos números, o mesmo movimento — em permanência.
//   Mesmo quem recarrega a página vê o mesmo estado.
//
// ANIMAÇÃO:
//   - Carregamento inicial → barras aparecem instantaneamente
//     no valor real (sem crescer do zero)
//   - Novos ticks ao vivo → RAF com easing suave (factor 0.09)
//     para movimento fluido e natural
//
// FUTURO: trocar PUBLIC_WS pelo backend → o backend mantém o
//   histórico e transmite para todos, sem depender de cada
//   cliente ir buscar o histórico individualmente à Deriv.
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react'

// ── Config ───────────────────────────────────────────────────
const PUBLIC_WS     = 'wss://api.derivws.com/trading/v1/options/ws/public'
const HISTORY_LOAD  = 1000   // ticks carregados ao entrar (base sincronizada)
const STRIP_SIZE    = 30     // dígitos na tira inferior
const SMOOTH        = 0.09   // suavidade da animação live (menor = mais suave)
const PING_MS       = 25_000
const RECONNECT_MS  = 2_500

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
  const pcts    = counts.map(c => (c / n) * 100)
  const maxPct  = Math.max(...pcts)
  const minPct  = Math.min(...pcts)
  return {
    pcts, maxPct, minPct,
    hotDigit:  pcts.indexOf(maxPct),
    coldDigit: pcts.indexOf(minPct),
    evenPct:   (even / n) * 100,
    overPct:   (over / n) * 100,
    total:     slice.length,
  }
}

// Cor da barra baseada na posição relativa (verde=dominante, vermelho=frio, azul=neutro)
function barColor(pct: number, min: number, max: number): string {
  if (max === min) return 'rgba(63,116,255,0.55)'
  const t = (pct - min) / (max - min)
  if (t >= 0.75) return 'rgba(24,201,122,0.85)'
  if (t >= 0.55) return 'rgba(24,201,122,0.55)'
  if (t <= 0.25) return 'rgba(233,32,63,0.80)'
  if (t <= 0.45) return 'rgba(233,32,63,0.50)'
  return 'rgba(63,116,255,0.50)'
}

// ── Componente principal ──────────────────────────────────────
export function ChartSection() {
  const [symbol,  setSymbol]  = useState('1HZ100V')
  const [win,     setWin]     = useState(100)
  const [phase,   setPhase]   = useState<'connecting'|'loading'|'live'|'error'>('connecting')
  const [quote,   setQuote]   = useState<number | null>(null)
  const [tkCnt,   setTkCnt]   = useState(0)
  const [strip,   setStrip]   = useState<number[]>([])
  const [info,    setInfo]    = useState(() => calcAll([], 100))
  // Estado das barras exibidas — animadas pelo RAF
  const [bars,    setBars]    = useState<number[]>(Array(10).fill(0))

  const [symOpen, setSymOpen] = useState(false)
  const [winOpen, setWinOpen] = useState(false)

  // Refs internas — não causam re-render
  const hist      = useRef<number[]>([])
  const target    = useRef<number[]>(Array(10).fill(0))   // destino das barras
  const current   = useRef<number[]>(Array(10).fill(0))   // barras animadas actuais
  const animating = useRef(false)                          // flag: há animação a correr?
  const wsRef     = useRef<WebSocket | null>(null)
  const pingRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted   = useRef(true)
  const winRef    = useRef(win)
  const symRef    = useRef(symbol)
  winRef.current  = win
  symRef.current  = symbol

  // ── RAF — só corre quando há mudança a animar ────────────
  const startRaf = useCallback(() => {
    if (animating.current) return  // já a correr
    animating.current = true

    const tick = () => {
      if (!mounted.current) { animating.current = false; return }
      const c = current.current
      const t = target.current
      let dirty = false
      for (let i = 0; i < 10; i++) {
        const d = t[i] - c[i]
        if (Math.abs(d) > 0.01) { c[i] += d * SMOOTH; dirty = true }
        else c[i] = t[i]
      }
      if (dirty) {
        setBars([...c])
        requestAnimationFrame(tick)
      } else {
        // Chegou ao destino — para o RAF
        setBars([...c])
        animating.current = false
      }
    }
    requestAnimationFrame(tick)
  }, [])

  // ── Aplica novo estado de percentagens às barras ─────────
  // snap=true → sem animação (carregamento inicial do histórico)
  // snap=false → anima suavemente (novos ticks ao vivo)
  const applyPcts = useCallback((pcts: number[], snap = false) => {
    target.current = [...pcts]
    if (snap) {
      current.current = [...pcts]
      setBars([...pcts])
    } else {
      startRaf()
    }
  }, [startRaf])

  // ── Processa um tick ao vivo ──────────────────────────────
  const onTick = useCallback((price: number) => {
    const d = lastDigit(price)
    hist.current.push(d)
    if (hist.current.length > 5000) hist.current = hist.current.slice(-5000)

    const pcts = calcPcts(hist.current, winRef.current)
    const all  = calcAll(hist.current, winRef.current)
    applyPcts(pcts, false)  // ← animação suave
    setInfo(all)
    setQuote(price)
    setTkCnt(hist.current.length)
    setStrip(prev => { const n = [...prev, d]; return n.length > STRIP_SIZE ? n.slice(-STRIP_SIZE) : n })
    setPhase('live')
  }, [applyPcts])

  // ── Conectar à Deriv e carregar histórico ─────────────────
  const connect = useCallback((sym: string) => {
    if (pingRef.current)  clearInterval(pingRef.current)
    if (reconnRef.current) clearTimeout(reconnRef.current)
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }

    setPhase('connecting')
    const ws = new WebSocket(PUBLIC_WS)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mounted.current) { ws.close(); return }
      setPhase('loading')

      // ── Passo 1: histórico (base sincronizada) ───────────
      // Todos os utilizadores pedem os mesmos HISTORY_LOAD
      // ticks mais recentes → base idêntica para todos.
      ws.send(JSON.stringify({
        ticks_history: sym,
        end:   'latest',
        count:  HISTORY_LOAD,
        style: 'ticks',
        req_id: 1,
      }))

      // ── Passo 2: subscrição ao vivo ──────────────────────
      ws.send(JSON.stringify({ ticks: sym, subscribe: 1, req_id: 2 }))

      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ ping: 1 }))
      }, PING_MS)
    }

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string)
      if (msg.error) return

      // Histórico carregado → snap imediato (sem animar do zero)
      if (msg.msg_type === 'history' && Array.isArray(msg.history?.prices)) {
        const prices: number[] = msg.history.prices
        hist.current = prices.map(lastDigit)
        const pcts = calcPcts(hist.current, winRef.current)
        const all  = calcAll(hist.current, winRef.current)

        // SNAP: barras aparecem instantaneamente no valor real
        // Nenhum utilizador vê as barras a crescer do zero.
        applyPcts(pcts, true)
        setInfo(all)
        setTkCnt(hist.current.length)
        setStrip(hist.current.slice(-STRIP_SIZE))
        setPhase('live')
        return
      }

      // Tick ao vivo → animação suave
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

  // Muda símbolo → reinicia
  useEffect(() => {
    hist.current    = []
    target.current  = Array(10).fill(0)
    current.current = Array(10).fill(0)
    setBars(Array(10).fill(0))
    setStrip([])
    setTkCnt(0)
    setQuote(null)
    setInfo(calcAll([], 100))
    connect(symbol)
  }, [symbol]) // eslint-disable-line

  // Mount / unmount
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (pingRef.current)  clearInterval(pingRef.current)
      if (reconnRef.current) clearTimeout(reconnRef.current)
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
    }
  }, [])

  // Recalcula ao mudar janela (sem reconectar)
  useEffect(() => {
    if (hist.current.length === 0) return
    const pcts = calcPcts(hist.current, win)
    const all  = calcAll(hist.current, win)
    applyPcts(pcts, false)  // animação suave ao mudar janela
    setInfo(all)
  }, [win, applyPcts])

  // ── Render ────────────────────────────────────────────────
  const symLabel = SYMBOLS.find(s => s.value === symbol)?.label ?? symbol
  const maxBar   = Math.max(...bars, 14)
  const minBar   = Math.min(...bars)

  const panels = [
    { label: 'Par',     val: info.evenPct,               opp: 100 - info.evenPct },
    { label: 'Ímpar',   val: 100 - info.evenPct,         opp: info.evenPct },
    { label: 'Over 5',  val: info.overPct,               opp: 100 - info.overPct },
    { label: 'Under 5', val: 100 - info.overPct,         opp: info.overPct },
  ]

  return (
    <div className="card" style={{ overflow: 'visible' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid var(--border)',
      }}>
        {/* Símbolo + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => { setSymOpen(o => !o); setWinOpen(false) }} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
              background: 'var(--bg-card-hi)', border: '1px solid var(--border-hi)',
              borderRadius: 8, cursor: 'pointer',
            }}>
              <span className={`dot ${phase === 'live' ? 'live' : phase === 'error' ? 'off' : 'warn'}`}
                style={{ width: 6, height: 6 }} />
              <span style={{ color: 'var(--white)', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {symLabel}
              </span>
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none"
                style={{ transform: symOpen ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}>
                <path d="M2 3.5L5 6.5L8 3.5" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {symOpen && (
              <div className="card" style={{ position: 'absolute', top: '110%', left: 0, zIndex: 70, padding: 4, minWidth: 148 }}>
                {SYMBOLS.map(s => (
                  <button key={s.value} onClick={() => { setSymbol(s.value); setSymOpen(false) }}
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

          {quote !== null && (
            <span className="tabular" style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              {quote.toFixed(2)}
            </span>
          )}

          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {phase === 'connecting' ? 'A ligar...' :
             phase === 'loading'    ? 'A carregar histórico...' :
             phase === 'error'      ? 'Erro — reconectando...' :
             `${tkCnt.toLocaleString()} ticks`}
          </span>
        </div>

        {/* Janela */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => { setWinOpen(o => !o); setSymOpen(false) }} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
            background: 'var(--bg-card-hi)', border: '1px solid var(--border-hi)',
            borderRadius: 8, cursor: 'pointer',
          }}>
            <span style={{ color: 'var(--white)', fontSize: 13, fontWeight: 700 }}>{win} ticks</span>
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none"
              style={{ transform: winOpen ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {winOpen && (
            <div className="card" style={{ position: 'absolute', top: '110%', right: 0, zIndex: 70, padding: 4, minWidth: 110 }}>
              {WINDOWS.map(w => (
                <button key={w} onClick={() => { setWin(w); setWinOpen(false) }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8, fontSize: 13,
                    color: win === w ? 'var(--blue-hi)' : 'var(--text)',
                    fontWeight: win === w ? 700 : 400, background: 'transparent',
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

      {/* ── Gráfico de barras ─────────────────────────────── */}
      <div style={{ padding: '16px 12px 4px', height: 200, display: 'flex', alignItems: 'flex-end', gap: 5 }}>
        {bars.map((pct, digit) => {
          const isHot  = digit === info.hotDigit  && info.total >= 10
          const isCold = digit === info.coldDigit && info.total >= 10
          const col    = barColor(pct, minBar, maxBar)
          // Altura relativa: barra mais alta ocupa 85% do container
          const h = Math.max((pct / (maxBar + 3)) * 160, 3)

          return (
            <div key={digit} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-end', gap: 2, height: '100%',
            }}>
              {/* Percentagem */}
              <span className="tabular" style={{
                fontSize: 8, fontWeight: 800, fontFamily: 'var(--font-mono)', lineHeight: 1,
                color: isHot ? '#18c97a' : isCold ? '#ff3a57' : 'var(--text-faint)',
                minHeight: 10,
              }}>
                {pct.toFixed(1)}
              </span>

              {/* Barra animada */}
              <div style={{
                width: '100%', height: h, position: 'relative',
                borderRadius: '5px 5px 2px 2px',
                background: col,
                // Glow suave nos extremos
                boxShadow: isHot
                  ? '0 0 16px rgba(24,201,122,0.55), 0 2px 6px rgba(24,201,122,0.3)'
                  : isCold
                    ? '0 0 12px rgba(233,32,63,0.45)'
                    : 'none',
                overflow: 'hidden',
              }}>
                {/* Reflexo interno (dá profundidade) */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  height: '45%',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.15), transparent)',
                }} />
              </div>

              {/* Dígito */}
              <span className="tabular" style={{
                fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)', lineHeight: 1,
                color: isHot ? '#18c97a' : isCold ? '#ff3a57' : 'var(--text-dim)',
              }}>
                {digit}
              </span>

              {/* Ícone hot/cold */}
              <span style={{ fontSize: 9, lineHeight: 1, height: 11 }}>
                {isHot ? '🔥' : isCold ? '❄️' : ''}
              </span>
            </div>
          )
        })}
      </div>

      {/* ── Painéis de análise ────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
        gap: 1, margin: '8px 10px', borderRadius: 10, overflow: 'hidden',
        border: '1px solid var(--border)',
      }}>
        {panels.map(({ label, val }) => {
          const hot  = val > 54
          const cold = val < 46
          const col  = hot ? '#18c97a' : cold ? '#ff3a57' : 'var(--text-dim)'
          return (
            <div key={label} style={{ background: 'var(--bg-card-hi)', padding: '10px 6px', textAlign: 'center' }}>
              <p style={{ fontSize: 9, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 4 }}>
                {label}
              </p>
              <p className="tabular" style={{ fontSize: 17, fontWeight: 900, fontFamily: 'var(--font-mono)', color: col, lineHeight: 1 }}>
                {val.toFixed(1)}<span style={{ fontSize: 10, fontWeight: 400 }}>%</span>
              </p>
              <p style={{ fontSize: 9, color: col, marginTop: 2, fontWeight: 700 }}>
                {hot ? '▲ Dom.' : cold ? '▼ Fraco' : '— Neutro'}
              </p>
              <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${val}%`, borderRadius: 2,
                  background: hot ? '#18c97a' : cold ? '#ff3a57' : 'var(--border-hi)',
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Linha de resumo rápida ────────────────────────── */}
      {info.total >= 25 && (
        <div style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap',
          gap: 10, padding: '4px 14px 6px',
        }}>
          <Pill label="🔥" val={info.hotDigit}  color="#18c97a" />
          <Pill label="❄️" val={info.coldDigit} color="#ff3a57" />
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <Pill label="Par"  val={`${info.evenPct.toFixed(0)}%`}  color={info.evenPct > 53 ? '#18c97a' : info.evenPct < 47 ? '#ff3a57' : 'var(--text-dim)'} />
          <Pill label="Over" val={`${info.overPct.toFixed(0)}%`}  color={info.overPct > 53 ? '#18c97a' : info.overPct < 47 ? '#ff3a57' : 'var(--text-dim)'} />
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
              {Math.min(info.total, win)}/{win}
            </span>
          </div>
        </div>
      )}

      {/* ── Tira de dígitos ───────────────────────────────── */}
      <div style={{
        borderTop: '1px solid var(--border)', padding: '10px 12px 13px',
        background: 'rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflowX: 'auto' }}>
          <span style={{
            fontSize: 9, fontWeight: 700, color: 'var(--text-faint)',
            textTransform: 'uppercase', letterSpacing: 1.5, flexShrink: 0,
          }}>
            Últimos
          </span>

          {strip.length === 0 ? (
            <span style={{ color: 'var(--text-faint)', fontSize: 11, fontStyle: 'italic' }}>
              {phase === 'connecting' ? 'A ligar...'
               : phase === 'loading' ? 'A carregar histórico...'
               : phase === 'error'   ? 'Erro de ligação'
               : 'Aguardando...'}
            </span>
          ) : strip.map((d, i) => {
            const isNew  = i === strip.length - 1
            const isHot  = d === info.hotDigit  && info.total >= 10
            const isCold = d === info.coldDigit && info.total >= 10
            const bg  = isNew ? 'rgba(24,87,255,0.28)'
                      : isHot  ? 'rgba(24,201,122,0.14)'
                      : isCold ? 'rgba(233,32,63,0.14)'
                      : 'var(--bg-card-hi)'
            const col = isNew ? '#3f74ff'
                      : isHot  ? '#18c97a'
                      : isCold ? '#ff3a57'
                      : 'var(--text-dim)'
            const bdr = isNew ? '1px solid rgba(24,87,255,0.55)'
                      : isHot  ? '1px solid rgba(24,201,122,0.35)'
                      : isCold ? '1px solid rgba(233,32,63,0.35)'
                      : '1px solid var(--border)'
            return (
              <span key={i} className="tabular" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontFamily: 'var(--font-mono)',
                width: isNew ? 28 : 22, height: isNew ? 28 : 22,
                fontSize: isNew ? 14 : 11, fontWeight: 800,
                borderRadius: 7, background: bg, color: col, border: bdr,
                transform: isNew ? 'scale(1.08)' : undefined,
                opacity: 0.3 + (i / strip.length) * 0.7,
                boxShadow: isNew ? '0 0 10px rgba(24,87,255,0.45)' : 'none',
              }}>
                {d}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Pill({ label, val, color }: { label: string; val: string | number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{label}</span>
      <span className="tabular" style={{ fontSize: 13, fontWeight: 800, color, fontFamily: 'var(--font-mono)' }}>
        {val}
      </span>
    </div>
  )
}
