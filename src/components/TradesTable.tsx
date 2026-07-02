import { useState } from 'react'
import { useBots } from '../context/BotsContext'
import type { TradeRecord } from '../context/BotsContext'

type MainTab = 'trader' | 'notificacoes'

export function TradesTable() {
  const { trades, clearTrades } = useBots()
  const [mainTab, setMainTab] = useState<MainTab>('trader')

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 20 }}>
          {(['trader', 'notificacoes'] as MainTab[]).map(tab => (
            <button key={tab} onClick={() => setMainTab(tab)} style={{
              fontWeight: 600, fontSize: 14, color: mainTab === tab ? 'var(--white)' : 'var(--text-faint)',
              textTransform: 'capitalize',
            }}>
              {tab === 'trader' ? 'Trader' : 'Notificações'}
            </button>
          ))}
        </div>
        <button onClick={() => { if (confirm('Limpar histórico de trades?')) clearTrades() }} title="Limpar"
          style={{ color: 'var(--text-dim)', padding: 4 }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5h14" /><path d="M8 5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
            <path d="M5 5l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" />
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {mainTab === 'notificacoes' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 128, color: 'var(--text-faint)' }}>
            <p style={{ fontSize: 14 }}>Sem notificações</p>
          </div>
        )}

        {mainTab === 'trader' && (
          trades.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, color: 'var(--text-faint)', gap: 8 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><line x1="12" y1="7" x2="12" y2="11" />
              </svg>
              <p style={{ fontSize: 14 }}>Nenhum trade ainda</p>
              <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>Selecciona um bot e toca em play para começar</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
                  <tr style={{ color: 'var(--text-dim)', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Hora</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Tipo</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>Tick Final</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>Preço</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>Resultado</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>
                  {trades.map((t: TradeRecord, i: number) => (
                    <tr key={`${t.id}-${i}`} style={{ borderBottom: '1px solid rgba(31,44,74,0.4)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-dim)' }}>{t.hora}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-dim)' }}>{t.contractType ?? '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-dim)' }}>
                        {typeof t.exitTick === 'number' ? t.exitTick.toFixed(2) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-faint)' }}>{t.stake.toFixed(2)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: t.profit >= 0 ? 'var(--green)' : 'var(--red-hi)' }}>
                        {t.profit >= 0 ? '' : '-'}{Math.abs(t.profit).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}
