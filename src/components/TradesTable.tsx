import { useState } from 'react'
import { useBots } from '../context/BotsContext'
import type { TradeRecord } from '../context/BotsContext'

type MainTab = 'trader' | 'notificacoes'

// ── Ícones inline (sem emoji) ───────────────────────────────
function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h14" /><path d="M8 5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
      <path d="M5 5l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" />
    </svg>
  )
}
function IconClipboard() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><line x1="12" y1="7" x2="12" y2="11" />
    </svg>
  )
}
function IconBell() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

// Formata o dígito do tick final (0-9) — não é um preço, é o
// último algarismo da cotação no momento em que a operação terminou.
function formatTickDigit(v: unknown): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—'
  const digit = Math.trunc(Math.abs(v)) % 10
  return String(digit)
}

export function TradesTable() {
  const { trades, clearTrades } = useBots()
  const [mainTab, setMainTab] = useState<MainTab>('trader')

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', borderRadius: 0 }}>
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
          <IconTrash />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
        {mainTab === 'notificacoes' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, color: 'var(--text-faint)', gap: 8 }}>
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, background: 'var(--bg-card-hi)', color: 'var(--text-dim)',
            }}>
              <IconBell />
            </span>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-dim)' }}>Sem notificações</p>
            <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>Avisos de saldo, metas e stop loss aparecem aqui</p>
          </div>
        )}

        {mainTab === 'trader' && (
          trades.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, color: 'var(--text-faint)', gap: 8 }}>
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 44, height: 44, background: 'var(--bg-card-hi)', color: 'var(--text-dim)',
              }}>
                <IconClipboard />
              </span>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-dim)' }}>Nenhum trade ainda</p>
              <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>Selecciona um bot e toca em play para começar</p>
            </div>
          ) : (
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: '20%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
                <tr style={{ color: 'var(--text-dim)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600 }}>Hora</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600 }}>Tipo</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>Tick Final</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>Preço</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>Resultado</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                {trades.map((t: TradeRecord, i: number) => (
                  <tr key={`${t.id}-${i}`} style={{ borderBottom: '1px solid rgba(31,44,74,0.4)' }}>
                    <td style={{ padding: '10px 6px', color: 'var(--text-dim)', wordBreak: 'break-word' }}>{t.hora}</td>
                    <td style={{ padding: '10px 6px', color: 'var(--text-dim)', wordBreak: 'break-word' }}>{t.contractType ?? '—'}</td>
                    <td style={{ padding: '10px 6px', textAlign: 'right', color: 'var(--text-dim)', wordBreak: 'break-word', fontWeight: 700 }}>
                      {formatTickDigit(t.exitTick)}
                    </td>
                    <td style={{ padding: '10px 6px', textAlign: 'right', color: 'var(--text-faint)', wordBreak: 'break-word' }}>{t.stake.toFixed(2)}</td>
                    <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700, color: t.profit >= 0 ? 'var(--green)' : 'var(--red-hi)', wordBreak: 'break-word' }}>
                      {t.profit >= 0 ? '' : '-'}{Math.abs(t.profit).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  )
}
