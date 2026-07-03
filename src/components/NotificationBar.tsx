import { useEffect, useMemo, useRef, useState } from 'react'
import { useBots } from '../context/BotsContext'

type BannerKind = 'error' | 'insufficient' | 'success' | 'stoploss'

interface BannerMsg {
  kind: BannerKind
  icon: string
  text: string
}

export function NotificationBar() {
  const { lastError, statusMessage } = useBots()

  // ── Prioridade: erro geral > saldo insuficiente > meta > stop loss ──
  // lastError    → erro genérico do bot (bot:error)          → mensagem fixa de reload
  // statusMessage.kind === 'error'   → bot:insufficient_balance → saldo insuficiente
  // statusMessage.kind === 'success' → bot:goal_reached (lucro)  → meta atingida
  // statusMessage.kind === 'warning' → bot:goal_reached (perda)  → stop loss atingido
  const active: BannerMsg | null = useMemo(() => {
    if (lastError) {
      return { kind: 'error', icon: '⚠', text: 'Erro! Tente carregar a página.' }
    }
    if (statusMessage?.kind === 'error') {
      return { kind: 'insufficient', icon: '💳', text: 'Saldo insuficiente. Faça um depósito na Deriv.' }
    }
    if (statusMessage?.kind === 'success') {
      return { kind: 'success', icon: '🎉', text: 'Parabéns! Bateu a sua meta!' }
    }
    if (statusMessage?.kind === 'warning') {
      return { kind: 'stoploss', icon: '🛑', text: 'Stop loss atingido!' }
    }
    return null
  }, [lastError, statusMessage])

  const [visible, setVisible] = useState(false)
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeKey = active ? `${active.kind}:${active.text}` : null

  useEffect(() => {
    if (!activeKey) { setVisible(false); return }
    if (activeKey === dismissedKey) return
    setVisible(true)

    if (hideTimer.current) clearTimeout(hideTimer.current)
    // sucesso e stop loss desaparecem sozinhos; erro e saldo insuficiente
    // ficam visíveis até o contexto limpar a mensagem (BotsContext já tem timeout próprio)
    if (active?.kind === 'success' || active?.kind === 'stoploss') {
      hideTimer.current = setTimeout(() => setVisible(false), 5000)
    }
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])

  if (!active || !visible) return null

  const palette: Record<BannerKind, { border: string; glow: string; color: string }> = {
    error:        { border: 'rgba(233,32,63,0.45)',  glow: 'rgba(233,32,63,0.25)', color: 'var(--red-hi)' },
    insufficient: { border: 'rgba(245,166,35,0.45)', glow: 'rgba(245,166,35,0.2)', color: '#f5a623' },
    success:      { border: 'rgba(24,201,122,0.45)', glow: 'rgba(24,201,122,0.25)', color: 'var(--green)' },
    stoploss:     { border: 'rgba(233,32,63,0.45)',  glow: 'rgba(233,32,63,0.25)', color: 'var(--red-hi)' },
  }
  const p = palette[active.kind]

  return (
    <div className="glass-banner" style={{ borderColor: p.border, boxShadow: `0 8px 32px ${p.glow}, inset 0 1px 0 rgba(255,255,255,0.12)` }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{active.icon}</span>
      <span style={{ color: p.color, fontWeight: 700, fontSize: 13, flex: 1, lineHeight: 1.3 }}>{active.text}</span>
      <button
        onClick={() => { setDismissedKey(activeKey); setVisible(false) }}
        className="glass-banner-close"
        aria-label="Fechar"
      >✕</button>
    </div>
  )
}
