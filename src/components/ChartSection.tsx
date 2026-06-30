// ============================================================
// NEXORA FOREX — Chart Section
//
// IMPORTANTE: este componente NÃO abre WebSocket própria para a
// Deriv. Todos os ticks vêm do backend via TradingContext (que
// por sua vez recebe do BotsProvider/useNexoraWs). Abrir uma
// segunda ligação directa à Deriv aqui duplicaria conexões
// (limite de 5 simultâneas/conta) e dessincronizaria os dígitos
// mostrados entre componentes diferentes da mesma tela.
// ============================================================

import { useState, useRef, useEffect } from 'react'
import { useTrading } from '../context/TradingContext'

const TICK_OPTIONS = [25, 50, 100, 250, 500, 1000]

function barColor(percentage: number, max: number, min: number): string {
  if (percentage === max) return 'var(--green)'
  if (percentage === min) return 'var(--red)'
  return 'var(--border-hi)'
}

export function ChartSection() {
  const { chartData, lastDigits, tickCount, selectedTicks, setSelectedTicks, isConnected } = useTrading()
  const [isDropdown, setIsDropdown] = useState(false)
  const ddRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setIsDropdown(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const bars = chartData?.barData ?? Array.from({ length: 10 }, (_, digit) => ({ digit, percentage: 10, isHighlight: false, isLow: false }))
  const pcts = bars.map(b => b.percentage)
  const max = Math.max(...pcts)
  const min = Math.min(...pcts)

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`dot ${isConnected ? 'live' : 'off'}`} />
          <span style={{ color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>1HZ100V</span>
          <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>{tickCount} ticks</span>
        </div>
        <div ref={ddRef} style={{ position: 'relative' }}>
          <button onClick={() => setIsDropdown(o => !o)} className="btn-ghost" style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', fontSize: 14, fontWeight: 600,
          }}>
            <span>{selectedTicks} ticks</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: isDropdown ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}>
              <path d="M3 4.5L6 7.5L9 4.5" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {isDropdown && (
            <div className="card" style={{ position: 'absolute', right: 0, top: '110%', minWidth: 120, padding: 4, zIndex: 50 }}>
              {TICK_OPTIONS.map(t => (
                <button key={t} onClick={() => { setSelectedTicks(t); setIsDropdown(false) }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 14, borderRadius: 8,
                    color: selectedTicks === t ? 'var(--blue-hi)' : 'var(--text)',
                    fontWeight: selectedTicks === t ? 700 : 400,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {t} ticks
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 12px', height: 200, display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        {bars.map(b => (
          <div key={b.digit} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
            <span className="tabular" style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              {b.percentage.toFixed(1)}%
            </span>
            <div style={{
              width: '100%', borderRadius: '4px 4px 0 0',
              height: `${Math.max(b.percentage, 2) * 4}px`,
              maxHeight: '100%',
              background: barColor(b.percentage, max, min),
              transition: 'height 0.25s ease, background 0.25s ease',
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{b.digit}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--text-faint)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, flexShrink: 0 }}>
            Histórico
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
            {lastDigits.length === 0 ? (
              <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>Aguardando dados...</span>
            ) : (
              lastDigits.map((d, i) => {
                const isNewest = i === lastDigits.length - 1
                return (
                  <span key={i} className="tabular" style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: isNewest ? 28 : 24, height: isNewest ? 28 : 24,
                    fontSize: isNewest ? 14 : 12, fontWeight: 700, borderRadius: 6,
                    background: isNewest ? 'rgba(24,201,122,0.18)' : 'var(--bg-card-hi)',
                    color: isNewest ? 'var(--green)' : 'var(--text)',
                    border: `1px solid ${isNewest ? 'rgba(24,201,122,0.4)' : 'var(--border)'}`,
                    opacity: 0.4 + (i / lastDigits.length) * 0.6,
                    flexShrink: 0,
                  }}>
                    {d}
                  </span>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
