import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLoader } from '../context/LoaderContext'
import { api } from '../lib/api'
import type { AdminStats, AdminUserRow } from '../lib/api'

type Tab = 'todos' | 'nao_verificados' | 'bloqueados' | 'online' | 'novos_hoje' | 'inativos'

function formatDate(ts: number | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="card" style={{ padding: '14px 16px', flex: '1 1 120px', minWidth: 120 }}>
      <p style={{ color: 'var(--text-faint)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        {label}
      </p>
      <p className="tabular" style={{ color: color || 'var(--white)', fontSize: 22, fontWeight: 700 }}>
        {value}
      </p>
    </div>
  )
}

export default function AdminPage() {
  const navigate = useNavigate()
  const { localUser } = useAuth()
  const { show, complete, hide } = useLoader()

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [tab, setTab] = useState<Tab>('todos')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null)

  const isAdmin = localUser?.role === 'admin'

  useEffect(() => {
    if (!localUser) return // ainda a carregar sessão local
    if (!isAdmin) { navigate('/menu'); return }
    loadAll()
  }, [localUser])

  const loadAll = async () => {
    show('A carregar painel...')
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(),
      ])
      setStats(statsRes.stats)
      setUsers(usersRes.users)
      complete('Pronto!')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao carregar dados')
      hide()
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleStatus = async (user: AdminUserRow) => {
    const nextStatus = user.status === 'active' ? 'blocked' : 'active'
    setBusyId(user.id)
    try {
      const { user: updated } = await api.setUserStatus(user.id, nextStatus)
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
      if (selectedUser?.id === updated.id) setSelectedUser(updated)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao atualizar utilizador')
    } finally {
      setBusyId(null)
    }
  }

  const ONLINE_THRESHOLD_MS = 5 * 60 * 1000
  const now = Date.now()
  const startOfDay = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [])

  const filteredUsers = useMemo(() => {
    switch (tab) {
      case 'nao_verificados':
        return users.filter((u) => !u.emailVerified)
      case 'bloqueados':
        return users.filter((u) => u.status === 'blocked')
      case 'online':
        return users.filter((u) => u.lastActiveAt !== null && now - u.lastActiveAt <= ONLINE_THRESHOLD_MS)
      case 'novos_hoje':
        return users.filter((u) => u.createdAt >= startOfDay)
      case 'inativos':
        return users.filter((u) => {
          if (u.status === 'blocked') return false
          const ref = u.lastLoginAt ?? u.createdAt
          return now - ref > 30 * 24 * 60 * 60 * 1000
        })
      default:
        return users
    }
    // Ordenados por mais recentes primeiro (registo ou atividade)
  }, [users, tab, now, startOfDay])

  const sortedUsers = useMemo(
    () => [...filteredUsers].sort((a, b) => (b.lastActiveAt ?? b.createdAt) - (a.lastActiveAt ?? a.createdAt)),
    [filteredUsers],
  )

  const goBack = () => navigate('/menu')

  if (!localUser || (isLoading && !stats)) return null
  if (!isAdmin) return null

  const TABS: { key: Tab; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'online', label: 'Online agora' },
    { key: 'novos_hoje', label: 'Novos hoje' },
    { key: 'nao_verificados', label: 'Não verificados' },
    { key: 'inativos', label: 'Inativos' },
    { key: 'bloqueados', label: 'Bloqueados' },
  ]

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div style={{ position: 'sticky', top: 0, background: 'rgba(7,11,20,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', zIndex: 10 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={goBack} className="btn-ghost" style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="logo-text" style={{ fontSize: 18 }}>PAINEL ADMIN</h1>
          <button onClick={loadAll} title="Atualizar" style={{ marginLeft: 'auto', color: 'var(--text-faint)', padding: 8 }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4v5h5" /><path d="M15 12V7h-5" />
              <path d="M13.51 5.87a6 6 0 0 0-10.16 2.14" /><path d="M2.49 10.13a6 6 0 0 0 10.16-2.14" />
            </svg>
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 12px 40px' }}>
        {errorMsg && (
          <div className="card" style={{ padding: 14, marginBottom: 16, border: '1px solid rgba(233,32,63,0.3)', background: 'rgba(233,32,63,0.08)' }}>
            <p style={{ color: 'var(--red-hi)', fontSize: 13 }}>{errorMsg}</p>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            <StatCard label="Total registados" value={stats.total} />
            <StatCard label="Online agora" value={stats.onlineNow} color="var(--green)" />
            <StatCard label="Novos hoje" value={stats.newToday} color="var(--blue-hi)" />
            <StatCard label="Não verificados" value={stats.unverified} color="#f5a623" />
            <StatCard label="Inativos (30d+)" value={stats.inactive} color="var(--text-dim)" />
            <StatCard label="Bloqueados" value={stats.blocked} color="var(--red-hi)" />
            <StatCard label="Nunca entraram" value={stats.neverLoggedIn} />
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '8px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
                border: `1px solid ${tab === t.key ? 'var(--blue)' : 'var(--border)'}`,
                background: tab === t.key ? 'rgba(24,87,255,0.12)' : 'transparent',
                color: tab === t.key ? 'var(--blue-hi)' : 'var(--text-dim)',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Lista de utilizadores */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {sortedUsers.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>Nenhum utilizador nesta categoria.</p>
            </div>
          ) : (
            sortedUsers.map((u, idx) => {
              const isOnline = u.lastActiveAt !== null && now - u.lastActiveAt <= ONLINE_THRESHOLD_MS
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '14px 16px', background: 'transparent', border: 'none',
                    borderBottom: idx < sortedUsers.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: isOnline ? 'var(--green)' : 'var(--border-hi)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <p style={{ color: 'var(--white)', fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.fullName || '(sem nome)'}
                      </p>
                      {u.role === 'admin' && (
                        <span style={{ padding: '1px 7px', background: 'rgba(245,166,35,0.15)', color: '#f5a623', fontSize: 9.5, fontWeight: 700, borderRadius: 20 }}>ADMIN</span>
                      )}
                      {u.status === 'blocked' && (
                        <span style={{ padding: '1px 7px', background: 'rgba(233,32,63,0.15)', color: 'var(--red-hi)', fontSize: 9.5, fontWeight: 700, borderRadius: 20 }}>BLOQUEADO</span>
                      )}
                      {!u.emailVerified && (
                        <span style={{ padding: '1px 7px', background: 'rgba(245,166,35,0.1)', color: '#f5a623', fontSize: 9.5, fontWeight: 700, borderRadius: 20 }}>NÃO VERIFICADO</span>
                      )}
                    </div>
                    <p style={{ color: 'var(--text-faint)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.email} · {u.whatsapp}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ color: 'var(--text-faint)', fontSize: 11 }}>Registado</p>
                    <p style={{ color: 'var(--text-dim)', fontSize: 11.5 }}>{formatDate(u.createdAt)}</p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Modal de detalhes / ações do utilizador */}
      {selectedUser && (
        <>
          <div onClick={() => setSelectedUser(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', zIndex: 640 }} />
          <div style={{ position: 'fixed', inset: '16px 16px auto', top: 16, zIndex: 650, maxWidth: 460, margin: '0 auto' }}>
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <p style={{ color: 'var(--white)', fontWeight: 700, fontSize: 15 }}>Detalhes do utilizador</p>
                <button onClick={() => setSelectedUser(null)} className="btn-ghost" style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>

              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  ['Nome', selectedUser.fullName || '—'],
                  ['Email', selectedUser.email],
                  ['WhatsApp', selectedUser.whatsapp || '—'],
                  ['Role', selectedUser.role === 'admin' ? 'Administrador' : 'Utilizador'],
                  ['Estado', selectedUser.status === 'active' ? 'Ativo' : 'Bloqueado'],
                  ['Email verificado', selectedUser.emailVerified ? 'Sim' : 'Não'],
                  ['Registado em', formatDate(selectedUser.createdAt)],
                  ['Último login', formatDate(selectedUser.lastLoginAt)],
                  ['Última atividade', formatDate(selectedUser.lastActiveAt)],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>{label}</span>
                    <span style={{ color: 'var(--white)', fontSize: 12.5, fontWeight: 500, textAlign: 'right' }}>{value}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 12, padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setSelectedUser(null)} className="btn-ghost" style={{ padding: '10px 20px', fontSize: 14, fontWeight: 500 }}>
                  Fechar
                </button>
                <button
                  onClick={() => handleToggleStatus(selectedUser)}
                  disabled={busyId === selectedUser.id || selectedUser.role === 'admin'}
                  title={selectedUser.role === 'admin' ? 'Não é possível bloquear um administrador' : undefined}
                  style={{
                    flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 600, borderRadius: 10, border: 'none',
                    cursor: selectedUser.role === 'admin' ? 'not-allowed' : 'pointer',
                    opacity: selectedUser.role === 'admin' ? 0.4 : 1,
                    background: selectedUser.status === 'active' ? 'rgba(233,32,63,0.15)' : 'rgba(24,201,122,0.15)',
                    color: selectedUser.status === 'active' ? 'var(--red-hi)' : 'var(--green)',
                  }}
                >
                  {busyId === selectedUser.id
                    ? 'A atualizar...'
                    : selectedUser.status === 'active' ? 'Bloquear utilizador' : 'Reativar utilizador'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
