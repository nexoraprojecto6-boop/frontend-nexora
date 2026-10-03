import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react'
import { api, HttpError, LocalUser } from '../lib/api'
import type { Account } from '../lib/types'

interface AuthContextType {
  // Sessão Deriv (OAuth) — controla acesso ao dashboard/trading
  isAuthenticated: boolean
  isLoading: boolean
  accounts: Account[]
  currentAccount: Account | null
  setCurrentAccount: (account: Account) => Promise<void>
  logout: () => Promise<void>
  refreshAccounts: () => Promise<void>
  login: (token: string) => Promise<boolean>

  // Sessão local (email + senha) — controla acesso ao ecrã "Conectar à Deriv"
  isLocalAuthenticated: boolean
  isLocalLoading: boolean
  localUser: LocalUser | null
  isAdmin: boolean
  loginLocal: (token: string, user: LocalUser) => void
  logoutLocal: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ── Leitura síncrona do localStorage para o estado inicial ─────
// Faz o primeiro render já nascer com o role correto (admin
// identificado sem piscar a versão errada do dashboard).
function readStoredLocalUser(): LocalUser | null {
  try {
    const stored = localStorage.getItem('localUser')
    return stored ? (JSON.parse(stored) as LocalUser) : null
  } catch {
    return null
  }
}

function hasStoredLocalToken(): boolean {
  return !!localStorage.getItem('localToken')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [currentAccount, setCurrentAccountState] = useState<Account | null>(null)
  const initialCheckDone = useRef(false)

  // A sessão local nasce resolvida de forma síncrona (não há "loading").
  const [isLocalAuthenticated, setIsLocalAuthenticated] = useState(hasStoredLocalToken)
  const [localUser, setLocalUser] = useState<LocalUser | null>(readStoredLocalUser)
  const isLocalLoading = false

  const isAdmin = localUser?.role === 'admin'

  const loadAccounts = useCallback(async (): Promise<boolean> => {
    try {
      const { data } = await api.getAccounts()
      if (!data || data.length === 0) {
        setIsAuthenticated(true)
        return true
      }
      setAccounts(data)
      const savedId = localStorage.getItem('currentAccountId')
      const active = (savedId && data.find(a => a.account_id === savedId)) || data[0]
      setCurrentAccountState(active || null)
      if (active) localStorage.setItem('currentAccountId', active.account_id)
      setIsAuthenticated(true)
      return true
    } catch (error) {
      console.error('[Auth] loadAccounts failed:', error)
      const msg = error instanceof Error ? error.message : ''
      if (msg.includes('401') || msg.includes('Unauthorized')) {
        localStorage.removeItem('token')
        setIsAuthenticated(false)
        return false
      }
      setIsAuthenticated(true)
      return true
    }
  }, [])

  const checkAuth = useCallback(async () => {
    if (initialCheckDone.current) return
    initialCheckDone.current = true

    const token = localStorage.getItem('token')
    if (!token) {
      setIsLoading(false)
      return
    }
    await loadAccounts()
    setIsLoading(false)
  }, [loadAccounts])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const login = useCallback(async (token: string): Promise<boolean> => {
    initialCheckDone.current = true
    localStorage.setItem('token', token)
    setIsLoading(true)
    const ok = await loadAccounts()
    setIsLoading(false)
    return ok
  }, [loadAccounts])

  // ── Sessão local ────────────────────────────────────────────

  const loginLocal = useCallback((token: string, user: LocalUser) => {
    localStorage.setItem('localToken', token)
    localStorage.setItem('localUser', JSON.stringify(user))
    setLocalUser(user)
    setIsLocalAuthenticated(true)
  }, [])

  const logoutLocal = useCallback(() => {
    localStorage.removeItem('localToken')
    localStorage.removeItem('localUser')
    setLocalUser(null)
    setIsLocalAuthenticated(false)
  }, [])

  // Ao abrir a app, confirma a sessão local no servidor em segundo plano:
  //   - 401 (conta apagada, bloqueada ou token expirado) -> termina a sessão
  //   - sucesso -> sincroniza o utilizador guardado (role, nome...)
  //   - rede/servidor em baixo -> mantém a sessão guardada
  useEffect(() => {
    if (!hasStoredLocalToken()) return
    let active = true

    api.getLocalMe()
      .then(({ user }) => {
        if (!active) return
        localStorage.setItem('localUser', JSON.stringify(user))
        setLocalUser(user)
      })
      .catch((e) => {
        if (active && e instanceof HttpError && e.status === 401) logoutLocal()
      })

    return () => { active = false }
  }, [logoutLocal])

  // ── Contas Deriv ────────────────────────────────────────────

  const setCurrentAccount = async (account: Account) => {
    setCurrentAccountState(account)
    localStorage.setItem('currentAccountId', account.account_id)
    try {
      await api.switchAccount(account.account_id)
    } catch (e) {
      console.warn('[Auth] switchAccount REST failed:', e)
    }
  }

  const logout = async () => {
    // Se o servidor estiver em baixo, o logout NÃO pode falhar: antes, uma
    // exceção em api.logout() deixava o utilizador preso (sessão nunca limpa).
    try {
      await api.logout()
    } catch (e) {
      console.warn('[Auth] logout REST failed (a limpar sessão local na mesma):', e)
    }
    // O token Deriv e a conta ativa têm de sair do localStorage, senão a app
    // volta a entrar sozinha ao recarregar.
    localStorage.removeItem('token')
    localStorage.removeItem('currentAccountId')
    setIsAuthenticated(false)
    setAccounts([])
    setCurrentAccountState(null)
    logoutLocal()
    window.location.href = '/'
  }

  const refreshAccounts = async () => {
    try {
      const { data } = await api.getAccounts()
      setAccounts(data)
      if (currentAccount) {
        const updated = data.find(a => a.account_id === currentAccount.account_id)
        if (updated) setCurrentAccountState(updated)
      }
    } catch (e) {
      console.error('[Auth] refreshAccounts failed:', e)
    }
  }

  return (
    <AuthContext.Provider value={{
      isAuthenticated, isLoading, accounts, currentAccount,
      setCurrentAccount, logout, refreshAccounts, login,
      isLocalAuthenticated, isLocalLoading, localUser, isAdmin, loginLocal, logoutLocal,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
