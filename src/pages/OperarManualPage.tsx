// ============================================================
// NEXORA FOREX — OperarManualPage
//
// Réplica do layout Over/Under do dtrader.deriv.com.
// Gráfico e percentagens: MESMA lógica do ChartSection.tsx
// (ligação pública direta à Deriv — não passa pelo backend,
// não depende do BotsProvider/TradingContext para os dados).
// Compra: usa useBots().manualBuy() (backend, via useNexoraWs).
//
// ALTERAÇÃO (implementação final):
//   - Mercado seleccionável: Over / Under / Matches / Differs
//     (mapeado para DIGITOVER / DIGITUNDER / DIGITMATCH / DIGITDIFF)
//   - Validação de dígito por mercado (Over não aceita 9,
//     Under não aceita 0 — a Deriv rejeitaria a proposta)
//   - Saldo em tempo real (useTrading) — mesma fonte usada em
//     todo o resto da app, populada via mensagem `balance` do
//     backend (não abre ligação própria)
//   - Histórico de trades: reaproveita <TradesTable/>, que já
//     mostra trades manuais (BotsContext regista-os no mesmo
//     `trading._addTrade` usado pelos bots)
//   - Página auto-contida: monta o seu próprio <BotsProvider/>,
//     seguindo o mesmo padrão do DashboardPage.tsx. Assume que
//     <TradingProvider/> já envolve as rotas mais acima (tal
//     como acontece para o Dashboard).
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { BotsProvider, useBots } from '../context/BotsContext'
import { useTrading } from '../context/TradingContext'
import { TradesTable } from '../components/TradesTable'
import type { ManualBuyParams } from '../hooks/useNexoraWs'

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

// ── Mercados suportados ──────────────────────────────────────
type MarketType = 'over' | 'under' | 'matches' | 'differs'

const MARKET_LABELS: Record<MarketType, string> = {
  over: 'Over', under: 'Under', matches: 'Matches', differs: 'Differs',
}

const MARKET_CONTRACT: Record<MarketType, ManualBuyParams['contractType']> = {
  over: 'DIGITOVER',
  under: 'DIGITUNDER',
  matches: 'DIGITMATCH',
  differs: 'DIGITDIFF',
}

// A Deriv rejeita propostas impossíveis: "over 9" e "under 0" nunca
// podem ganhar, por isso não estão disponíveis como barreira válida.
function isDigitValidForMarket(market: MarketType, digit: number): boolean {
  if (market === 'over') return digit <= 8
  if (market === 'under') return digit >= 1
  return true // matches / differs aceitam qualquer dígito 0–9
}

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

function OperarManualInner() {
  const navigate = useNavigate()
  const { manualBuy, manualPendingTrade, manualBuyError, manualTrades } = useBots()
  const { balance, currency, profit, wins, losses, loading: tradingLoading } = useTrading()

  // ── Sinal WIN/LOSS sobre o dígito onde a última operação
  // manual terminou. `manualTrades` vem sempre com o mais recente
  // em primeiro (ver BotsContext: `[rec, ...prev]`), por isso
  // basta observar manualTrades[0]. Some sozinho passado um tempo.
  const [lastResult, setLastResult] = useState<{ id: string; digit: number; won: boolean } | null>(null)
  const lastResultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const latest = manualTrades[0]
    if (!latest || typeof latest.exitDigit !== 'number') return
    if (lastResult?.id === latest.id) return // já mostrado, evita reiniciar o timer

    setLastResult({ id: latest.id, digit: latest.exitDigit, won: latest.won })

    if (lastResultTimerRef.current) clearTimeout(lastResultTimerRef.current)
    lastResultTimerRef.current = setTimeout(() => {
      setLastResult(prev => (prev?.id === latest.id ? null : prev))
    }, 6000)
  }, [manualTrades]) // eslint-disable-line

  useEffect(() => {
    return () => { if (lastResultTimerRef.current) clearTimeout(lastResultTimerRef.current) }
  }, [])

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
  const [market, setMarket] = useState<MarketType>('over')
  const [selectedDigit, setSelectedDigit] = useState(5)
  const [duration, setDuration] = useState(2)
  const [stake, setStake] = useState(2)
  const [localError, setLocalError] = useState<string | null>(null)

  const isBusy = !!manualPendingTrade
  const maxBar = Math.max(...bars, 10)

  // Se o mercado mudar para um em que o dígito seleccionado deixa
  // de ser válido (ex: estava em 9 e mudou para Under), ajusta
  // automaticamente para o dígito válido mais próximo.
  useEffect(() => {
    if (!isDigitValidForMarket(market, selectedDigit)) {
      setSelectedDigit(market === 'over' ? 8 : market === 'under' ? 1 : selectedDigit)
    }
  }, [market]) // eslint-disable-line

  function getBarColor(pct: number): string {
    if (Math.abs(pct - info.maxPct) < 0.01) return COLOR_HOT
    if (Math.abs(pct - info.minPct) < 0.01) return COLOR_COLD
    return COLOR_NEUTRAL
  }

  const handleBuy = () => {
    if (isBusy) return
    if (!isDigitValidForMarket(market, selectedDigit)) {
      setLocalError(market === 'over' ? 'Over não aceita o dígito 9.' : 'Under não aceita o dígito 0.')
      setTimeout(() => setLocalError(null), 4000)
      return
    }
    if (stake < 0.35) {
      setLocalError('Stake mínimo é $0.35.')
      setTimeout(() => setLocalError(null), 4000)
      return
    }
    setLocalError(null)
    const params: ManualBuyParams = {
      symbol,
      contractType: MARKET_CONTRACT[market],
      duration,
      durationUnit: 'ticks',
      stake,
      barrier: selectedDigit,
    }
    manualBuy(params)
  }

  const displayError = localError ?? manualBuyError

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

      {/* ── Saldo / P&L do dia (inclui trades manuais e de bots) ── */}
      <div className="card" style={{
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
        padding: '12px 16px', marginBottom: 14, opacity: tradingLoading ? 0.6 : 1,
      }}>
        <div>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>Saldo</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--white)', margin: 0 }}>
            {balance.toFixed(2)} <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{currency}</span>
          </p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>Lucro/Prejuízo</p>
          <p style={{ fontSize: 18, fontWeight: 800, margin: 0, color: profit >= 0 ? '#22c55e' : '#ff5c5c' }}>
            {profit >= 0 ? '+' : ''}{profit.toFixed(2)}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>Operações</p>
          <p style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
            <span style={{ color: '#22c55e' }}>{wins}</span>
            <span style={{ color: 'var(--text-dim)' }}> / </span>
            <span style={{ color: '#e8e8ec' }}>{losses}</span>
          </p>
        </div>
      </div>

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

          <div style={{ padding: '26px 14px 6px', display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: 246, position: 'relative' }}>
            {bars.map((pct, digit) => {
              const color = getBarColor(pct)
              const ratio = pct / (maxBar + 2)
              const showResult = lastResult?.digit === digit
              return (
                <div key={digit} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%', position: 'relative' }}>
                  {showResult && lastResult && (
                    <span
                      key={lastResult.id}
                      style={{
                        position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)',
                        display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
                        padding: '3px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 800,
                        letterSpacing: 0.4, color: '#0b0e14',
                        background: lastResult.won ? '#3ddc84' : '#ff5c5c',
                        boxShadow: lastResult.won ? '0 0 12px rgba(61,220,132,0.55)' : '0 0 12px rgba(255,92,92,0.55)',
                        animation: 'resultPop 0.35s ease-out',
                        zIndex: 5,
                      }}
                    >
                      {lastResult.won ? '✓ WIN' : '✕ LOSS'}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1 }}>{pct.toFixed(1)}%</span>
                  <div style={{
                    width: '100%', height: `max(4px, calc(180px * ${ratio.toFixed(4)}))`, background: color,
                    outline: showResult ? `2px solid ${lastResult?.won ? '#3ddc84' : '#ff5c5c'}` : 'none',
                    outlineOffset: 1,
                  }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: showResult ? (lastResult?.won ? '#3ddc84' : '#ff5c5c') : 'var(--white)', lineHeight: 1 }}>{digit}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ---------------- Painel de operação manual ---------------- */}
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* ── Selector de mercado: Over / Under / Matches / Differs ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: 'var(--border)', borderRadius: 12, padding: 4 }}>
            {(['over', 'under', 'matches', 'differs'] as MarketType[]).map(m => (
              <button
                key={m}
                onClick={() => setMarket(m)}
                style={{
                  padding: '8px 0', background: market === m ? '#3ddc84' : 'transparent',
                  color: market === m ? '#0b0e14' : 'var(--text-dim)', border: 'none',
                  borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {MARKET_LABELS[m]}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>
            {market === 'over' && 'O último dígito será maior que o seleccionado'}
            {market === 'under' && 'O último dígito será menor que o seleccionado'}
            {market === 'matches' && 'O último dígito será igual ao seleccionado'}
            {market === 'differs' && 'O último dígito será diferente do seleccionado'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {bars.map((pct, digit) => {
              const isSelected = digit === selectedDigit
              const isHigh = Math.abs(pct - info.maxPct) < 0.01
              const isLow = Math.abs(pct - info.minPct) < 0.01
              const valid = isDigitValidForMarket(market, digit)
              return (
                <button
                  key={digit}
                  onClick={() => valid && setSelectedDigit(digit)}
                  disabled={!valid}
                  title={!valid ? 'Indisponível para este mercado' : undefined}
                  style={{
                    background: 'var(--border)', border: isSelected ? '1px solid #3ddc84' : '1px solid transparent',
                    borderRadius: 6, padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center',
                    cursor: valid ? 'pointer' : 'not-allowed', opacity: valid ? 1 : 0.35,
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

          {displayError && <p style={{ fontSize: 12, color: '#ff5c5c', margin: 0 }}>{displayError}</p>}

          <button
            onClick={handleBuy}
            disabled={isBusy}
            style={{ marginTop: 'auto', background: '#3ddc84', border: 'none', borderRadius: 6, padding: '12px 0', color: '#0b0e14', fontWeight: 700, fontSize: 14, cursor: isBusy ? 'default' : 'pointer', opacity: isBusy ? 0.6 : 1 }}
          >
            {isBusy ? 'Contrato em aberto…' : `Comprar ${MARKET_LABELS[market]}`}
          </button>
        </div>
      </div>

      {/* ---------------- Histórico de operações ---------------- */}
      <div style={{ marginTop: 16, height: 360 }}>
        <TradesTable />
      </div>

      <style>{`
        @keyframes resultPop {
          0%   { opacity: 0; transform: translateX(-50%) translateY(6px) scale(0.85); }
          60%  { opacity: 1; transform: translateX(-50%) translateY(-2px) scale(1.05); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

// ── Página auto-contida: monta o seu próprio BotsProvider,
// igual ao DashboardPage.tsx, para poder ser usada em qualquer
// rota sem depender de um provider já montado acima. ──────────
export default function OperarManualPage() {
  return (
    <BotsProvider>
      <OperarManualInner />
    </BotsProvider>
  )
}
