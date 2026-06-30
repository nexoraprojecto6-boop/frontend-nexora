// ============================================================
// NEXORA FOREX — Configuração de ambiente
//
// Em Vite, variáveis expostas ao browser têm de começar com
// VITE_ (equivalente ao NEXT_PUBLIC_ do Next.js).
// ============================================================

export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL || 'https://banckend-nexora.onrender.com'

// URL da WebSocket — derivada do API_BASE_URL por defeito, trocando
// o protocolo http(s) por ws(s). Evita o bug de URLs com protocolo
// duplicado (ex: "wss://https://...") que já causou ligações WS
// inválidas no passado.
function deriveWsUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL as string | undefined
  if (explicit) return explicit
  try {
    const u = new URL(API_BASE_URL)
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
    return u.toString().replace(/\/$/, '')
  } catch {
    return 'wss://banckend-nexora.onrender.com'
  }
}

export const WS_URL: string = deriveWsUrl()

export const DERIV_APP_ID: string =
  import.meta.env.VITE_DERIV_APP_ID || '33zVF6u28ZwC8XnteDYvr'
