// ============================================================
// NEXORA FOREX — ChartSection  v8
// Os dados (histórico + ticks) vêm do TradingContext, que os recebe
// do backend pela ligação autenticada da sessão. Já não abre WebSocket
// próprio. Visual igual ao v7; animação das barras mais curta (120 ms).
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoChevronDown, IoChevronUp, IoTrendingUp } from 'react-icons/io5'
import { useTrading } from '../context/TradingContext'

// Constante de tempo da suavização: ~140 ms = reage rápido ao tick e flui sem saltos
const SMOOTH_TAU_MS = 140

const COLOR_HOT     = '#2e7d32'
const COLOR_COLD    = '#c62828'
const COLOR_NEUTRAL = 'var(--bar-neutral)'

const WINDOWS = [25, 50, 100, 250, 500, 1000]

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
  slice.forEach(d => { counts[d]++ })
  const pcts   = counts.map(c => (c / n) * 100)
  return {
    pcts,
    maxPct: Math.max(...pcts),
    minPct: Math.min(...pcts),
    total:  slice.length,
  }
}

export function ChartSection() {
  const navigate = useNavigate()
  const { tickCount, snapshotVersion, getDigits, isConnected } = useTrading()

  const [win,     setWin]     = useState(100)
  const [info,    setInfo]    = useState(() => calcAll([], 100))
  const [bars,    setBars]    = useState<number[]>(Array(10).fill(0))
  const [winOpen, setWinOpen] = useState(false)

  const target    = useRef<number[]>(Array(10).fill(0))
  const current   = useRef<number[]>(Array(10).fill(0))
  const animating = useRef(false)
  const mounted   = useRef(true)
  const snapRef   = useRef(-1)

  // Animação contínua (suavização exponencial por tempo): cada barra persegue o
  // alvo a cada frame, sem degraus e sem reiniciar quando chega um tick novo.
  const lastFrame = useRef(0)
  const startRaf = useCallback(() => {
    if (animating.current) return
    animating.current = true
    lastFrame.current = performance.now()
    const step = (now: number) => {
      if (!mounted.current) { animating.current = false; return }
      const dt = Math.min(64, now - lastFrame.current)
      lastFrame.current = now
      const k = 1 - Math.exp(-dt / SMOOTH_TAU_MS)
      const t = target.current, c = current.current
      let maxDiff = 0
      for (let i = 0; i < 10; i++) {
        c[i] += (t[i] - c[i]) * k
        const d = Math.abs(t[i] - c[i])
        if (d > maxDiff) maxDiff = d
      }
      if (maxDiff < 0.02) { for (let i = 0; i < 10; i++) c[i] = t[i] }
      setBars([...c])
      if (maxDiff >= 0.02) requestAnimationFrame(step)
      else animating.current = false
    }
    requestAnimationFrame(step)
  }, [])

  const applyPcts = useCallback((pcts: number[], snap: boolean) => {
    target.current = [...pcts]
    if (snap) { current.current = [...pcts]; setBars([...pcts]) }
    else startRaf()
  }, [startRaf])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // Recalcula a cada tick, a cada novo histórico e quando muda a janela
  useEffect(() => {
    const hist = getDigits()
    if (hist.length === 0) return
    snapRef.current = snapshotVersion
    const snap = current.current.every(v => v === 0)
    applyPcts(calcPcts(hist, win), snap)
    setInfo(calcAll(hist, win))
  }, [tickCount, snapshotVersion, win, getDigits, applyPcts])

  const { maxPct, minPct } = info
  const hist   = getDigits()
  const lastD  = hist.length > 0 ? hist[hist.length - 1] : null
  const maxBar = Math.max(...bars, 10)
  const loading = info.total === 0

  function getBarColor(pct: number): string {
    if (Math.abs(pct - maxPct) < 0.01) return COLOR_HOT
    if (Math.abs(pct - minPct) < 0.01) return COLOR_COLD
    return COLOR_NEUTRAL
  }

  return (
    <div className="card" style={{ overflow: 'visible' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'clamp(4px, 1.5vw, 10px)',
        padding: 'clamp(8px, 2vw, 10px) clamp(8px, 3vw, 14px)', borderBottom: '1px solid var(--border)',
      }}>
        <button
          onClick={() => navigate('/operar-manual')}
          aria-label="Operar Manual"
          title="Operar Manual"
          style={{
            width: 'clamp(30px, 8vw, 36px)', height: 'clamp(30px, 8vw, 36px)', borderRadius: 10,
            background: '#3ddc84',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#0b0e14',
            border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0,
          }}
        >
          <IoTrendingUp size={19} />
        </button>

        <div style={{ flex: 1, textAlign: 'center', minWidth: 0, overflow: 'hidden' }}>
          <span style={{ fontSize: 'clamp(12px, 3.6vw, 17px)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--white)' }}>Last Digits: </span>
            <span className="tabular" style={{ color: lastD !== null ? COLOR_HOT : 'var(--text-dim)', fontWeight: 700 }}>
              {lastD !== null ? lastD : '—'}
            </span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <span style={{ color: 'var(--text)', fontSize: 'clamp(11px, 3.2vw, 15px)', whiteSpace: 'nowrap' }}>
            {loading ? (isConnected ? '...' : 'offline') : <><span className="tabular">{Math.min(info.total, win)}</span> ticks</>}
          </span>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setWinOpen(o => !o)} aria-label="Número de ticks" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32,
              background: 'transparent', border: 'none',
              cursor: 'pointer', color: 'var(--text-dim)',
            }}>
              {winOpen ? <IoChevronUp size={16} /> : <IoChevronDown size={16} />}
            </button>
            {winOpen && (
              <div className="card" style={{ position: 'absolute', top: '110%', right: 0, zIndex: 70, padding: 4, minWidth: 100 }}>
                {WINDOWS.map(w => (
                  <button key={w} onClick={() => { setWin(w); setWinOpen(false) }}
                    className="tabular"
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8,
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

      {/* ── Gráfico de barras ────────────────────────────────── */}
      <div className="chart-bars-wrap" style={{ padding: 'clamp(6px, 2vw, 8px) clamp(6px, 3vw, 14px) 4px', display: 'flex', alignItems: 'flex-end', gap: 'clamp(2px, 1.2vw, 6px)', overflow: 'hidden' }}>
        {bars.map((pct, digit) => {
          const color = getBarColor(pct)
          const ratio = pct / (maxBar + 2)

          return (
            <div key={digit} style={{
              flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%',
            }}>
              <span className="tabular" style={{
                fontSize: 'clamp(8px, 2.4vw, 11.5px)', fontWeight: 500, letterSpacing: '-0.05em',
                color: 'var(--text)', lineHeight: 1, minHeight: 14, whiteSpace: 'nowrap',
              }}>
                {pct.toFixed(1)}%
              </span>

              <div style={{
                width: '100%',
                height: `max(4px, calc(var(--chart-bar-max) * ${ratio.toFixed(4)}))`,
                background: color,
                borderRadius: '3px 3px 0 0',
                flexShrink: 0,
              }} />

              <span className="tabular" style={{
                fontSize: 'clamp(11px, 3vw, 15px)', fontWeight: 700,
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
