// ============================================================
// NEXORA FOREX — Cliente API REST
// ============================================================

import { API_BASE_URL, DERIV_APP_ID } from './env'
import type { Account, AccountLabels } from './types'

export interface Strategy {
  id: string
  name: string
  description?: string
  isActive: boolean
}

export interface BotStatusLocal {
  isRunning: boolean
  currentStep: 'analyzing' | 'contract_open' | 'contract_closed' | 'idle'
  progress: number
}

export interface LocalUser {
  id: string
  fullName: string
  whatsapp: string
  email: string
  role: string
}

// Utilizador completo tal como devolvido pelas rotas de admin
// (LocalUser do backend sem passwordHash).
export interface AdminUserRow {
  id: string
  fullName: string
  whatsapp: string
  email: string
  role: 'user' | 'admin'
  status: 'active' | 'blocked'
  emailVerified: boolean
  createdAt: number
  lastLoginAt: number | null
  lastActiveAt: number | null
}

export interface AdminStats {
  total: number
  active: number
  inactive: number
  blocked: number
  verified: number
  unverified: number
  neverLoggedIn: number
  newToday: number
  onlineNow: number
  inactiveAfterDays: number
}

export interface RegisterPayload {
  fullName: string
  whatsapp: string
  email: string
  password: string
}

function getToken(): string | null {
  return localStorage.getItem('token')
}

function getLocalToken(): string | null {
  return localStorage.getItem('localToken')
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = getToken()
  const customHeaders = (options.headers as Record<string, string>) || {}
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Deriv-App-ID': DERIV_APP_ID,
    ...customHeaders,
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers })

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/'
    }
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || err.error || `HTTP ${response.status}`)
  }
  return response.json()
}

// Chamada autenticada com o token de LOGIN LOCAL (não confundir com o
// token de sessão Deriv usado em fetchWithAuth).
//
// CORREÇÃO: o backend (requireLocalAuth) lê o header
// "x-local-authorization", não "Authorization" — este último já é
// usado pelo token de sessão Deriv nas rotas de trading, por isso o
// backend usa um header próprio para não colidirem. Antes desta
// correção, todas as chamadas aqui (getLocalMe, rotas de admin)
// falhavam silenciosamente a autenticação.
async function fetchWithLocalAuth(endpoint: string, options: RequestInit = {}) {
  const token = getLocalToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }
  if (token) headers['x-local-authorization'] = `Bearer ${token}`

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || err.error || `HTTP ${response.status}`)
  }
  return response.json()
}

const LOCAL_STRATEGIES: Strategy[] = [
  { id: '1', name: 'Gpt5.4', description: 'Estratégia principal', isActive: true },
  { id: '2', name: 'Martingale Pro', description: 'Estratégia de recuperação', isActive: false },
  { id: '3', name: 'Scalper V2', description: 'Trades rápidos', isActive: false },
]

export const api = {
  // ── Deriv OAuth (inalterado) ──────────────────────────────
  async startLogin(prompt?: 'registration'): Promise<{ authUrl: string }> {
    const qs = prompt ? `?prompt=${prompt}` : ''
    const res = await fetch(`${API_BASE_URL}/api/auth/login${qs}`, { credentials: 'include' })
    return res.json()
  },

  async validateToken(): Promise<{ valid: boolean }> {
    try {
      return await fetchWithAuth('/api/auth/validate')
    } catch {
      return { valid: false }
    }
  },

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      })
    } catch (e) {
      console.error('[API] Logout error:', e)
    } finally {
      localStorage.clear()
      sessionStorage.clear()
    }
  },

  // ── Registo / Login local ─────────────────────────────────
  async register(payload: RegisterPayload): Promise<{ success: boolean; message: string; user: LocalUser }> {
    const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}`)
    }
    return data
  },

  async loginLocal(email: string, password: string): Promise<{ success: boolean; token: string; user: LocalUser }> {
    const res = await fetch(`${API_BASE_URL}/api/auth/login-local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}`)
    }
    return data
  },

  async resendVerification(email: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}`)
    }
    return data
  },

  async verifyEmail(token: string): Promise<{ success: boolean; token: string; user: LocalUser }> {
    const res = await fetch(`${API_BASE_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}`)
    }
    return data
  },

  async getLocalMe(): Promise<{ success: boolean; user: LocalUser }> {
    return fetchWithLocalAuth('/api/auth/me')
  },

  // ── Admin: utilizadores locais ────────────────────────────
  async getAdminStats(): Promise<{ success: boolean; stats: AdminStats }> {
    return fetchWithLocalAuth('/api/admin/users/stats')
  },

  async getAdminUsers(): Promise<{ success: boolean; users: AdminUserRow[]; total: number }> {
    return fetchWithLocalAuth('/api/admin/users')
  },

  async setUserStatus(id: string, status: 'active' | 'blocked'): Promise<{ success: boolean; user: AdminUserRow }> {
    return fetchWithLocalAuth(`/api/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },

  // ── Contas / trading (inalterado) ─────────────────────────
  async getAccounts(): Promise<{ data: Account[] }> {
    const res = await fetchWithAuth('/api/accounts')
    const raw = res?.data?.accounts || res?.data || []
    const accounts: Account[] = Array.isArray(raw)
      ? raw.map((a: Account) => ({
          ...a,
          balance: Number(a.balance ?? 0),
          is_virtual: a.is_virtual ?? a.account_type === 'demo',
        }))
      : []
    return { data: accounts }
  },

  async switchAccount(_accountId: string): Promise<{ success: boolean }> {
    return { success: true }
  },

  async getOTP(accountId: string): Promise<{ data: { wsUrl: string } }> {
    const res = await fetchWithAuth(`/api/accounts/${accountId}/otp`, { method: 'POST' })
    const wsUrl = res?.data?.wsUrl || res?.data?.url || res?.wsUrl || res?.url
    return { data: { wsUrl } }
  },

  async resetDemoBalance(accountId: string): Promise<{ data: Account }> {
    return fetchWithAuth(`/api/accounts/${accountId}/reset`, { method: 'POST' })
  },

  async getStrategies(): Promise<{ data: Strategy[] }> {
    return { data: LOCAL_STRATEGIES }
  },

  async getOnlineCount(): Promise<{ count: number }> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/online-count`)
      return res.json()
    } catch {
      return { count: 0 }
    }
  },

  async checkAdmin(accountId: string): Promise<{ isAdmin: boolean }> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/check`, {
        headers: { Authorization: `Bearer ${getToken()}`, 'x-cr': accountId },
      })
      return res.json()
    } catch {
      return { isAdmin: false }
    }
  },

  async getAccountLabels(): Promise<AccountLabels> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/labels`)
      return res.json()
    } catch {
      return { realLabel: 'Real', demoLabel: 'Demo' }
    }
  },

  async setAccountLabels(accountId: string, labels: Partial<AccountLabels>): Promise<AccountLabels> {
    const res = await fetch(`${API_BASE_URL}/api/admin/labels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
        'x-cr': accountId,
      },
      body: JSON.stringify(labels),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return res.json()
  },
}
