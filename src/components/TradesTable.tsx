import { useState } from 'react'
import { useBots } from '../context/BotsContext'
import type { TradeRecord } from '../context/BotsContext'

type MainTab = 'trader' | 'notificacoes'

// ── Ícones inline (sem emoji) ───────────────────────────────
function IconTrash() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h14" /><path d="M8 5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
      <path d="M5 5l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" />
    </svg>
  )
}
// Tendência/gráfico — segundo ícone do cabeçalho, igual à imagem
function IconTrendUp() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 17 9 11 13 15 21 7" /><polyline points="14 7 21 7 21 14" />
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

// Cor da linha — bloco arredondado, igual à imagem
const ROW_BG = '#1b1b1f'

export function TradesTable() {
  const { trades, clearTrades } = useBots()
  const [mainTab, setMainTab] = useState<MainTab>('trader')

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', borderRadius: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 20 }}>
          {(['trader', 'notificacoes'] as MainTab[]).map(tab => (
            <button key={tab} onClick={() => setMainTab(tab)} style={{
              fontWeight: 600, fontSize: 15, color: mainTab === tab ? 'var(--white)' : 'var(--text-faint)',
              textTransform: 'capitalize',
            }}>
              {tab === 'trader' ? 'Trader' : 'Notificações'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => { if (confirm('Limpar histórico de trades?')) clearTrades() }} title="Limpar"
            style={{ color: 'var(--text-dim)', padding: 4 }}>
            <IconTrash />
          </button>
          <button title="Gráfico" style={{ color: 'var(--text-dim)', padding: 4 }}>
            <IconTrendUp />
          </button>
        </div>
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
            <div style={{ padding: '4px 12px 10px' }}>
              {/* Cabeçalho — sticky, fonte monoespaçada igual à imagem */}
              <div style={{
                position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)',
                display: 'grid', gridTemplateColumns: '16% 26% 22% 16% 20%',
                padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--white)',
              }}>
                <span>Hora</span>
                <span>Tipo</span>
                <span style={{ textAlign: 'right' }}>Tick Final</span>
                <span style={{ textAlign: 'right' }}>Preço</span>
                <span style={{ textAlign: 'right' }}>Resultado</span>
              </div>

              {/* Linhas — blocos arredondados, igual à imagem */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {trades.map((t: TradeRecord, i: number) => (
                  <div key={`${t.id}-${i}`} style={{
                    display: 'grid', gridTemplateColumns: '16% 26% 22% 16% 20%', alignItems: 'center',
                    background: ROW_BG, borderRadius: 10, padding: '10px 10px',
                    fontFamily: 'var(--font-mono)', fontSize: 13,
                  }}>
                    <span style={{ color: '#fff' }}>{t.hora}</span>
                    <span style={{ color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.contractType ?? '—'}</span>
                    <span style={{ color: '#fff', textAlign: 'right' }}>
                      {typeof t.exitTick === 'number' ? t.exitTick.toFixed(2) : '—'}
                    </span>
                    <span style={{ color: '#fff', textAlign: 'right' }}>{t.stake.toFixed(2)}</span>
                    <span style={{ textAlign: 'right', fontWeight: 700, color: t.profit >= 0 ? '#22c55e' : 'var(--red-hi)' }}>
                      {Math.abs(t.profit).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
