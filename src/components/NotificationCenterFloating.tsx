import { useState, ReactNode } from 'react'
import { GLASS_REFLECT_CSS } from '../lib/glass'

export interface AppNotification {
  id: string
  title: string
  message: string
  time: string
  read?: boolean
  icon?: ReactNode
}

interface Props {
  notifications: AppNotification[]
  onMarkAllRead?: () => void
  onNotificationClick?: (n: AppNotification) => void
}

// Painel central flutuante em vidro "tipo água": transparente, com blur
// forte (deixa o dashboard por trás visível e distorcido, como se fosse
// vidro molhado) e um reflexo subtil por baixo do painel.
export default function NotificationCenterFloating({ notifications, onMarkAllRead, onNotificationClick }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <>
      <style>{GLASS_REFLECT_CSS}</style>

      {/* Botão de abertura — fixo, canto superior */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Abrir notificações"
        style={{
          position: 'fixed', top: 18, right: 18, zIndex: 40,
          width: 44, height: 44, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(16,25,46,0.55)', border: '1px solid var(--border)',
          backdropFilter: 'blur(14px) saturate(150%)', WebkitBackdropFilter: 'blur(14px) saturate(150%)',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 18 }}>🔔</span>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9,
            background: '#e9203f', color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
            background: 'rgba(6,10,20,0.35)',
            backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-reflect fade-in"
            style={{
              position: 'relative', width: '100%', maxWidth: 420, maxHeight: '70vh',
              display: 'flex', flexDirection: 'column',
              borderRadius: 22,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(28px) saturate(180%)',
              WebkitBackdropFilter: 'blur(28px) saturate(180%)',
              boxShadow: '0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
              overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Notificações</h2>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllRead}
                    style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}
                  >
                    Marcar todas como lidas
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', lineHeight: 1 }}>
                  ✕
                </button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifications.length === 0 ? (
                <p style={{ padding: '32px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                  Sem notificações por agora.
                </p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => onNotificationClick?.(n)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '14px 20px',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      background: n.read ? 'transparent' : 'rgba(24,87,255,0.08)',
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                    }}
                  >
                    <span style={{ fontSize: 18, marginTop: 2 }}>{n.icon ?? '📣'}</span>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
                        {n.title}
                      </span>
                      <span style={{ display: 'block', fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
                        {n.message}
                      </span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{n.time}</span>
                    </span>
                    {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1857ff', marginTop: 6 }} />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
