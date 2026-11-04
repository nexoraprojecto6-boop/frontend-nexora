// ============================================================
// NEXORA FOREX — Acordar o backend (Render free adormece ao fim de 15 min)
//
// Um GET público leve ao abrir a app acorda o servidor ANTES do
// WebSocket/login precisarem dele (cold start de 30–60 s), e um ping
// periódico enquanto o separador está visível evita que volte a dormir.
// Qualquer resposta (mesmo 404) acorda a instância; erros são ignorados.
// ============================================================
import { API_BASE_URL } from './env'

const KEEPALIVE_MS = 9 * 60 * 1000
let started = false

export function wakeBackend(): void {
  fetch(`${API_BASE_URL}/api/online-count`, { cache: 'no-store', mode: 'no-cors' }).catch(() => {})
}

export function startBackendKeepAlive(): void {
  if (started || typeof window === 'undefined') return
  started = true
  wakeBackend()
  setInterval(() => {
    if (document.visibilityState === 'visible') wakeBackend()
  }, KEEPALIVE_MS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') wakeBackend()
  })
}
