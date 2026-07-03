import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react'
import { api, LocalUser } from '../lib/api'
import type { Account } from '../lib/types'

interface AuthContextType {
  // Sessão Deriv (OAuth) — inalterado, controla acesso ao dashboard/trading
  isAuthenticated: boolean
  isLoading: boolean
  accounts: Account[]
  currentAccount: Account | null
  setCurrentAccount: (account: Account) => Promise<void>
  logout: () => Promise<void>
  refreshAccounts: () => Promise<void>
  login: (token: string) => Promise<boolean>

  // Sessão local (nome, whatsapp, email + senha) — controla acesso
  // ao ecrã "Conectar à Deriv"
  isLocalAuthenticated: boolean
  isLocalLoading: boolean
  localUser: LocalUser | null
  loginLocal: (token: string, user: LocalUser) => void
  logoutLocal: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [currentAccount, setCurrentAccountState] = useState<Account | null>(null)
  const initialCheckDone = useRef(false)

  const [isLocalAuthenticated, setIsLocalAuthenticated] = useState(false)
  const [isLocalLoading, setIsLocalLoading] = useState(true)
  const [localUser, setLocalUser] = useState<LocalUser | null>(null)

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

    // Sessão local
    const localToken = localStorage.getItem('localToken')
    const storedUser = localStorage.getItem('localUser')
    if (localToken) {
      setIsLocalAuthenticated(true)
      if (storedUser) {
        try { setLocalUser(JSON.parse(storedUser)) } catch { /* ignora */ }
      }
    }
    setIsLocalLoading(false)

    // Sessão Deriv
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
    await api.logout()
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
      isLocalAuthenticated, isLocalLoading, localUser, loginLocal, logoutLocal,
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
