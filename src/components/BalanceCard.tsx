import { useMemo } from 'react'
import { useTrading } from '../context/TradingContext'
import { useBots } from '../context/BotsContext'

export function BalanceCard() {
  const { balance, currency, loading } = useTrading()
  const { sessionBots } = useBots()

  const { netPnL, totalWins, totalLosses } = useMemo(() => {
    const active = sessionBots.filter(b => b.stats.totalTrades > 0 || b.status === 'running')
    return {
      netPnL: active.reduce((s, b) => s + b.stats.netPnL, 0),
      totalWins: active.reduce((s, b) => s + b.stats.wins, 0),
      totalLosses: active.reduce((s, b) => s + b.stats.losses, 0),
    }
  }, [sessionBots])

  const isProfit = netPnL >= 0

  return (
    <div className="card" style={{ position: 'relative', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(13,20,36,0.85)', backdropFilter: 'blur(4px)', borderRadius: 'var(--radius-lg)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', width: 28, height: 28 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(63,116,255,0.15)' }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'var(--blue-hi)', animation: 'spin 0.8s linear infinite' }} />
            </div>
            <span style={{ color: 'var(--text-faint)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 2 }}>A carregar…</span>
          </div>
        </div>
      )}
      <div style={{ display: 'flex' }}>
        <div style={{ flex: 1, padding: 16, background: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Saldo</p>
          <p className="tabular" style={{ color: 'var(--white)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em' }}>
            <span style={{ color: 'var(--text-faint)', fontSize: 16 }}>$</span> {balance.toFixed(2)}{' '}
            <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-dim)' }}>{currency}</span>
          </p>
        </div>
        <div style={{ flex: 1, padding: 16, background: 'var(--bg-card-hi)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Lucro/Prejuízo</p>
          <p className="tabular" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', color: isProfit ? 'var(--green)' : 'var(--red-hi)' }}>
            <span style={{ fontSize: 16, opacity: 0.7 }}>$</span> {netPnL < 0 ? '-' : ''}{Math.abs(netPnL).toFixed(2)}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, color: 'var(--text-dim)', fontSize: 12 }}>
            <span>Operações</span>
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>{totalWins}</span>
            <span>/</span>
            <span style={{ color: 'var(--red-hi)', fontWeight: 700 }}>{totalLosses}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
