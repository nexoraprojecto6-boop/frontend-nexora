// ============================================================
// NEXORA FOREX — Operar Manual (painel estilo DTrader)
// Rise/Fall · Touch/No Touch · Accumulators
// Monta o seu próprio <BotsProvider/> (igual ao Dashboard) para usar a
// MESMA ligação WS do backend — não abre nenhuma ligação própria.
// ============================================================
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoChevronBack, IoAdd, IoRemove } from 'react-icons/io5'
import { BotsProvider } from '../context/BotsContext'
import { useTrading } from '../context/TradingContext'
import { useAuth } from '../context/AuthContext'
import { useLoader } from '../context/LoaderContext'
import { manual, useManual, type ContractType, type TradeParams } from '../manual/manualStore'
import { PriceChart } from '../manual/PriceChart'
import '../manual/manual.css'

interface Mode { id: 'rf' | 'tn' | 'acc'; label: string; types: ContractType[]; names: string[] }
const MODES: Mode[] = [
  { id: 'rf', label: 'Rise/Fall', types: ['CALL', 'PUT'], names: ['Rise', 'Fall'] },
  { id: 'tn', label: 'Touch/No Touch', types: ['ONETOUCH', 'NOTOUCH'], names: ['Touch', 'No Touch'] },
  { id: 'acc', label: 'Accumulators', types: ['ACCU'], names: ['Comprar'] },
]
const TYPE_LABEL: Record<ContractType, string> = {
  CALL: 'Rise', PUT: 'Fall', ONETOUCH: 'Touch', NOTOUCH: 'No Touch', ACCU: 'Accumulator',
}
const FALLBACK = [
  { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index', isOpen: true },
  { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index', isOpen: true },
  { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index', isOpen: true },
  { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index', isOpen: true },
  { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index', isOpen: true },
  { symbol: 'R_100', name: 'Volatility 100 Index', isOpen: true },
]

function ManualTrade() {
  const navigate = useNavigate()
  const { hide } = useLoader()
  const { balance, currency, isConnected } = useTrading()
  const { currentAccount } = useAuth()
  const m = useManual()

  const [mode, setMode] = useState(0)
  const [stake, setStake] = useState(2)
  const [dur, setDur] = useState(5)
  const [unit, setUnit] = useState<'ticks' | 's' | 'm'>('ticks')
  const [off, setOff] = useState('+1.00')
  const [growth, setGrowth] = useState(0.03)
  const [tp, setTp] = useState('')

  const md = MODES[mode]
  const isAcc = md.id === 'acc'

  useEffect(() => { hide(); manual.enter(); return () => manual.leave() }, []) // eslint-disable-line

  const params = (): TradeParams => {
    if (isAcc) return { stake, growthRate: growth, takeProfit: tp ? Number(tp) : undefined }
    const p: TradeParams = { stake, duration: dur, durationUnit: unit }
    if (md.id === 'tn') p.barrier = off
    return p
  }

  // Preço/payout em tempo real: pede ao backend 350 ms depois da última alteração
  useEffect(() => {
    if (!isConnected || !(stake > 0)) return
    const t = setTimeout(() => manual.quote(md.types, params()), 350)
    return () => clearTimeout(t)
  }, [mode, stake, dur, unit, off, growth, tp, m.symbol, isConnected]) // eslint-disable-line

  const spot = m.prices.length ? m.prices[m.prices.length - 1] : null
  const offN = parseFloat(off)
  const barrierAbs = md.id === 'tn' && spot != null && !Number.isNaN(offN) ? spot + offN : null
  const list = m.symbols.length ? m.symbols : FALLBACK
  const mName = list.find(x => x.symbol === m.symbol)?.name ?? m.symbol
  const loginid = currentAccount?.account_id || currentAccount?.loginid || ''
  const isDemo = /^(VRT|DOT)/i.test(String(loginid))
  const qErr = md.types.map(t => m.quotes[t]?.error).find(Boolean)

  return (
    <div className="mt-page">
      {m.result && (
        <div key={m.result.id} className={'mt-toast ' + (m.result.won ? 'win' : 'loss')} role="status">
          {m.result.won ? 'Ganhou' : 'Perdeu'}{' '}
          <b className="num">{m.result.profit >= 0 ? '+' : '−'}{Math.abs(m.result.profit).toFixed(2)} {currency}</b>
        </div>
      )}

      <header className="mt-head">
        <button className="btn-ghost mt-back" onClick={() => navigate('/menu')} aria-label="Voltar">
          <IoChevronBack size={20} />
        </button>
        <h1>Operar Manual</h1>
        <div className="mt-acc">
          <small>{isDemo ? 'Conta Demo' : 'Conta Real'}</small>
          <b className="num">{balance.toFixed(2)} {currency}</b>
        </div>
      </header>

      <div className="mt-bar">
        <select className="mt-select" value={m.symbol} onChange={e => manual.setSymbol(e.target.value)} aria-label="Mercado">
          {list.map(x => <option key={x.symbol} value={x.symbol} disabled={!x.isOpen}>{x.name || x.symbol}</option>)}
        </select>
        <div className="mt-tabs" role="tablist">
          {MODES.map((x, i) => (
            <button key={x.id} role="tab" aria-selected={i === mode}
              className={'mt-tab' + (i === mode ? ' on' : '')} onClick={() => setMode(i)}>{x.label}</button>
          ))}
        </div>
      </div>

      <main className="mt-grid">
        <section className="card mt-chart">
          <div className="mt-chart-head">
            <span>{mName}</span>
            <b className="num">{spot != null ? spot.toFixed(m.pip) : '—'}</b>
          </div>
          <PriceChart prices={m.prices} pip={m.pip} barrier={barrierAbs} />
        </section>

        <aside className="card mt-panel">
          <div className={'mt-fields' + (m.quoting ? ' busy' : '')}>
            {isAcc ? (
              <div className="mt-field">
                <label>Taxa de crescimento</label>
                <div className="mt-chips">
                  {[1, 2, 3, 4, 5].map(g => (
                    <button key={g} className={'mt-chip' + (growth === g / 100 ? ' on' : '')}
                      onClick={() => setGrowth(g / 100)}>{g}%</button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-field">
                <label>Duração</label>
                <div className="mt-row">
                  <input type="number" inputMode="numeric" min={1} value={dur}
                    onChange={e => setDur(Math.max(1, parseInt(e.target.value) || 1))} />
                  <select value={unit} onChange={e => setUnit(e.target.value as 'ticks' | 's' | 'm')}>
                    <option value="ticks">Ticks</option>
                    <option value="s">Segundos</option>
                    <option value="m">Minutos</option>
                  </select>
                </div>
              </div>
            )}

            {md.id === 'tn' && (
              <div className="mt-field">
                <label>Barreira (distância ao preço)</label>
                <input type="text" inputMode="decimal" value={off} onChange={e => setOff(e.target.value)} />
              </div>
            )}

            <div className="mt-field">
              <label>Entrada ({currency})</label>
              <div className="mt-step">
                <button aria-label="Diminuir entrada" onClick={() => setStake(v => Math.max(0.35, +(v - 1).toFixed(2)))}><IoRemove /></button>
                <input type="number" inputMode="decimal" min={0.35} step="0.01" value={stake}
                  onChange={e => setStake(parseFloat(e.target.value) || 0)} />
                <button aria-label="Aumentar entrada" onClick={() => setStake(v => +(v + 1).toFixed(2))}><IoAdd /></button>
              </div>
            </div>

            {isAcc && (
              <>
                <div className="mt-field">
                  <label>Take profit (opcional)</label>
                  <input type="number" inputMode="decimal" min={0} value={tp} placeholder="—" onChange={e => setTp(e.target.value)} />
                </div>
                <dl className="mt-info">
                  <div><dt>Pagamento máximo</dt><dd className="num">{m.accu?.maxPayout != null ? `${m.accu.maxPayout.toFixed(2)} ${currency}` : '—'}</dd></div>
                  <div><dt>Barreira</dt><dd className="num">{m.accu?.barrier ?? '—'}</dd></div>
                  <div><dt>Duração máx.</dt><dd className="num">{m.accu?.maxTicks != null ? `${m.accu.maxTicks} ticks` : '—'}</dd></div>
                </dl>
              </>
            )}
          </div>

          {(qErr || m.error) && <p className="mt-error" role="alert">{m.error || qErr}</p>}

          <div className={'mt-actions' + (md.types.length === 1 ? ' single' : '')}>
            {md.types.map((t, i) => {
              const q = m.quotes[t]
              return (
                <button key={t} className={'mt-buy ' + (i === 0 ? 'up' : 'down')}
                  disabled={!isConnected || !q || !!q.error} onClick={() => manual.buy(t, params())}>
                  <span>{md.names[i]}</span>
                  {!isAcc && <b className="num">{q && !q.error ? `${q.payout.toFixed(2)} ${currency}` : '—'}</b>}
                </button>
              )
            })}
          </div>
        </aside>
      </main>

      {m.open.length > 0 && (
        <section className="card mt-pos" aria-label="Posições abertas">
          {m.open.map(o => (
            <div key={o.ref} className="mt-pos-row">
              <div><b>{TYPE_LABEL[o.type]}</b><small>{o.symbol}</small></div>
              <span className="num">{o.stake.toFixed(2)}</span>
              <span className={'num ' + ((o.profit ?? 0) >= 0 ? 'pos' : 'neg')}>
                {o.profit != null ? `${o.profit >= 0 ? '+' : '−'}${Math.abs(o.profit).toFixed(2)}` : o.status === 'buying' ? '…' : '—'}
              </span>
              <button className="btn-ghost" disabled={!o.contractId} onClick={() => o.contractId && manual.sell(o.contractId)}>Vender</button>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

export default function ManualTradePage() {
  const navigate = useNavigate()
  useEffect(() => { if (!localStorage.getItem('token')) navigate('/') }, []) // eslint-disable-line
  return <BotsProvider><ManualTrade /></BotsProvider>
}
