import { useState } from 'react'
import { useBots } from '../context/BotsContext'
import type { TradeRecord } from '../context/BotsContext'

type MainTab = 'trader' | 'notificacoes'

// Colunas em fr — somam sempre a 100% do espaço disponível, nunca
// transbordam horizontalmente (diferente de % fixas, que podiam
// "quebrar" em ecrãs estreitos quando o conteúdo era mais largo).
const COLS = '0.85fr 1.3fr 1.15fr 0.85fr 1.05fr'

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
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><line x1="12" y1="7" x2="12" y2="11" />
    </svg>
  )
}
function IconBell() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

// Cor da linha — bloco arredondado, igual à imagem
const ROW_BG = '#1b1b1f'

// Célula de texto: nunca quebra linha (nowrap + ellipsis) para que
// uma hora/tick/preço mais comprido nunca estique a altura da linha
// nem desalinhe a grelha.
const cellBase: React.CSSProperties = {
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
}

// Estado vazio (sem trades / sem notificações) — ocupa sempre a
// altura toda disponível do painel, com tamanhos que escalam por
// ecrã (clamp) em vez de um valor fixo pequeno.
function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', minHeight: 220, color: 'var(--text-faint)', gap: 10, padding: '24px 20px', textAlign: 'center',
    }}>
      <span style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 'clamp(48px, 12vw, 60px)', height: 'clamp(48px, 12vw, 60px)', borderRadius: '50%',
        background: 'var(--bg-card-hi)', color: 'var(--text-dim)', flexShrink: 0,
      }}>
        {icon}
      </span>
      <p style={{ fontSize: 'clamp(14px, 3.6vw, 16px)', fontWeight: 600, color: 'var(--text-dim)' }}>{title}</p>
      <p style={{ fontSize: 'clamp(12px, 3vw, 13.5px)', color: 'var(--text-faint)', maxWidth: 280, lineHeight: 1.4 }}>{subtitle}</p>
    </div>
  )
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
              fontWeight: 600, fontSize: 'clamp(13px, 3.6vw, 15px)', color: mainTab === tab ? 'var(--white)' : 'var(--text-faint)',
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

      {/* Painel de conteúdo — altura toda disponível; só esta área rola */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
        {mainTab === 'notificacoes' && (
          <EmptyState
            icon={<IconBell />}
            title="Sem notificações"
            subtitle="Avisos de saldo, metas e stop loss aparecem aqui"
          />
        )}

        {mainTab === 'trader' && (
          trades.length === 0 ? (
            <EmptyState
              icon={<IconClipboard />}
              title="Nenhum trade ainda"
              subtitle="Selecciona um bot e toca em play para começar"
            />
          ) : (
            <div style={{ padding: '4px 10px 10px' }}>
              {/* Cabeçalho — sticky, fonte monoespaçada igual à imagem */}
              <div style={{
                position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)',
                display: 'grid', gridTemplateColumns: COLS, gap: 6,
                padding: '8px 8px', fontFamily: 'var(--font-mono)',
                fontSize: 'clamp(11px, 2.8vw, 13px)', fontWeight: 700, color: 'var(--white)',
              }}>
                <span style={cellBase}>Hora</span>
                <span style={cellBase}>Tipo</span>
                <span style={{ ...cellBase, textAlign: 'right' }}>Tick Final</span>
                <span style={{ ...cellBase, textAlign: 'right' }}>Preço</span>
                <span style={{ ...cellBase, textAlign: 'right' }}>Resultado</span>
              </div>

              {/* Linhas — blocos arredondados, igual à imagem */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {trades.map((t: TradeRecord, i: number) => (
                  <div key={`${t.id}-${i}`} style={{
                    display: 'grid', gridTemplateColumns: COLS, gap: 6, alignItems: 'center',
                    background: ROW_BG, borderRadius: 10, padding: '10px 8px',
                    fontFamily: 'var(--font-mono)', fontSize: 'clamp(11px, 2.8vw, 13px)',
                  }}>
                    <span style={{ ...cellBase, color: '#fff' }}>{t.hora}</span>
                    <span style={{ ...cellBase, color: '#fff' }}>{t.contractType ?? '—'}</span>
                    <span style={{ ...cellBase, color: '#fff', textAlign: 'right' }} title={typeof t.exitTick === 'number' ? t.exitTick.toFixed(2) : undefined}>
                      {typeof t.exitTick === 'number' ? t.exitTick.toFixed(2) : '—'}
                    </span>
                    <span style={{ ...cellBase, color: '#fff', textAlign: 'right' }}>{t.stake.toFixed(2)}</span>
                    <span style={{ ...cellBase, textAlign: 'right', fontWeight: 700, color: t.profit >= 0 ? '#22c55e' : 'var(--red-hi)' }}>
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
