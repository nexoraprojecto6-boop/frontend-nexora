// ============================================================
// NEXORA FOREX — WebSocket Hook
//
// ALTERAÇÃO (Operar Manual): adicionado o envio `manual_buy` e a
// escuta dos eventos `manual_buy_result` (confirmação de compra)
// e `manual_trade_closed` (resultado final do contrato manual).
// Segue exatamente o mesmo padrão dos eventos `bot:*` já existentes.
//
// ALTERAÇÕES (compatibilidade com o backend v2):
//   • AUTH_TEMPORARY (Deriv/rede em baixo) já NÃO termina a sessão —
//     só AUTH_FAILED (token inválido) o faz. Antes, qualquer falha
//     temporária de login na Deriv expulsava o utilizador.
//   • O contador de reconexão só volta a zero quando a ligação fica
//     estável (ou autentica). Antes zerava a cada abertura: se o servidor
//     fechava logo a seguir, reconectava de 1 em 1 segundo para sempre.
//   • Sockets antigos já não interferem com o novo (guarda "stale"):
//     o onclose de um socket substituído agendava reconexões duplicadas.
//   • connect() não abre um 2.º socket enquanto o 1.º ainda está a ligar.
//   • Mensagens novas: bot_symbol_fallback, manual_trade_error,
//     deriv_disconnected/deriv_reconnected.
//   • tick traz pip_size e symbol (dígito final correto por mercado).
//   • Ações do utilizador sem ligação avisam em vez de falhar em silêncio.
//   • clientRef nas compras manuais (liga cada resposta ao pedido certo).
// ============================================================

import { useEffect, useRef, useCallback, useState } from 'react'
import type {
  BotEvent, BotEventType, BotState, BotSummary, BotLogEntry,
  BotConfig, BotStrategyType, CatalogBot, WsStatus, SymbolFallbackInfo,
} from '../lib/types'
import { WS_URL } from '../lib/env'

export interface ManualBuyParams {
  symbol: string
  contractType: 'DIGITOVER' | 'DIGITUNDER' | 'DIGITMATCH' | 'DIGITDIFF' | 'CALL' | 'PUT'
  duration: number
  durationUnit: 'ticks' | 's' | 'm'
  stake: number
  barrier?: number | string
  /** Preenchido pelo BotsContext; o servidor devolve-o em todas as respostas. */
  clientRef?: string
}

export interface ManualBuyResult {
  clientRef?: string
  success: boolean
  contractId?: string
  payout?: number
  error?: string
}

export interface ManualTradeClosed {
  clientRef?: string
  contractId: string
  profit: number
  won: boolean
  stake: number
  exitTick?: number
  exitDigit?: number
}

/** O servidor não conseguiu acompanhar o contrato até ao fim (pode continuar aberto na Deriv). */
export interface ManualTradeError {
  clientRef?: string
  contractId?: string
  message: string
}

interface NexoraWsCallbacks {
  onCatalogLoaded?: (bots: CatalogBot[]) => void
  onSessionBotsLoaded?: (bots: BotSummary[]) => void
  onBotStarted?: (bot: BotState & { catalogBotId?: string }) => void
  onBotEvent?: (event: BotEvent) => void
  onBotLogs?: (botId: string, logs: BotLogEntry[]) => void
  onError?: (msg: string) => void
  onAuthFailed?: () => void
  onBalance?: (balance: number, currency: string) => void
  onTick?: (quote: number, pipSize?: number, symbol?: string) => void
  onManualBuyResult?: (result: ManualBuyResult) => void
  onManualTradeClosed?: (trade: ManualTradeClosed) => void
  onManualTradeError?: (err: ManualTradeError) => void
  onSymbolFallback?: (info: SymbolFallbackInfo) => void
  onDerivStatus?: (connected: boolean) => void
  token?: string | null
  accountId?: string | null
}

const PING_INTERVAL_MS = 15_000
const WATCHDOG_INTERVAL_MS = 10_000
const WATCHDOG_TIMEOUT_MS = 40_000
const MAX_RECONNECT_DELAY_MS = 30_000
const STABLE_CONNECTION_MS = 10_000

// Falhas de login em que a sessão deve terminar (token inválido, sem contas).
// AUTH_TEMPORARY NÃO está aqui de propósito: é falha temporária, reconecta com backoff.
const FATAL_AUTH_CODES = new Set(['AUTH_FAILED', 'MISSING_TOKEN', 'NO_ACCOUNTS', 'OTP_FAILED'])
// Códigos que não devem mostrar mensagem de erro ao utilizador
const SILENT_CODES = new Set(['AUTH_IN_PROGRESS'])

export function useNexoraWs(callbacks: NexoraWsCallbacks = {}) {
  const wsRef = useRef<WebSocket | null>(null)
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptRef = useRef(0)
  const openedAtRef = useRef(0)
  const mountedRef = useRef(true)
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks

  const tokenRef = useRef(callbacks.token ?? null)
  const accountIdRef = useRef(callbacks.accountId ?? null)
  const lastAuthSentRef = useRef<string>('')
  const failedAuthKeyRef = useRef<string>('')
  const lastMessageAtRef = useRef<number>(Date.now())
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null)
  tokenRef.current = callbacks.token ?? null
  accountIdRef.current = callbacks.accountId ?? null

  const [wsStatus, setWsStatus] = useState<WsStatus>('disconnected')

  // Envio silencioso (consultas, ping, listas). Devolve se foi enviado.
  const send = useCallback((type: string, payload: Record<string, unknown> = {}): boolean => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }))
      return true
    }
    return false
  }, [])

  // Ações do utilizador (iniciar/parar bot, admin...): sem ligação, avisa
  // em vez de falhar em silêncio.
  const sendAction = useCallback((type: string, payload: Record<string, unknown> = {}): boolean => {
    const ok = send(type, payload)
    if (!ok) cbRef.current.onError?.('Sem ligação ao servidor. A reconectar…')
    return ok
  }, [send])

  const clearTimers = () => {
    if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null }
    if (watchdogRef.current) { clearInterval(watchdogRef.current); watchdogRef.current = null }
  }

  const handleMessage = useCallback((raw: string) => {
    let msg: Record<string, unknown> = {}
    try { msg = JSON.parse(raw) } catch { return }
    if (!msg?.type) return

    const type = msg.type as string
    const payload = (msg.payload && typeof msg.payload === 'object'
      ? msg.payload
      : msg) as Record<string, unknown>

    try {
      switch (type) {

        case 'bots_list':
          cbRef.current.onCatalogLoaded?.(payload as unknown as CatalogBot[])
          break

        case 'session_bots_list':
          cbRef.current.onSessionBotsLoaded?.(payload as unknown as BotSummary[])
          break

        case 'bot_created':
          cbRef.current.onBotStarted?.(payload as unknown as BotState & { catalogBotId?: string })
          break

        case 'bot_stopped':
        case 'bot_paused':
        case 'bot_resumed':
        case 'bot_deleted':
          break

        case 'bot_logs': {
          const p = payload as { botId?: string; logs?: BotLogEntry[] }
          if (p.botId && p.logs) cbRef.current.onBotLogs?.(p.botId, p.logs)
          break
        }

        case 'balance': {
          const bal = typeof msg.balance === 'number' ? msg.balance
            : typeof payload.balance === 'number' ? payload.balance
            : null
          const cur = typeof msg.currency === 'string' ? msg.currency
            : typeof payload.currency === 'string' ? payload.currency
            : 'USD'
          if (bal != null) cbRef.current.onBalance?.(bal, cur)
          break
        }

        case 'tick': {
          const quote = typeof msg.quote === 'number' ? msg.quote
            : typeof payload.quote === 'number' ? payload.quote
            : null
          const pip = typeof msg.pip_size === 'number' ? msg.pip_size
            : typeof payload.pip_size === 'number' ? payload.pip_size
            : undefined
          const symbol = typeof msg.symbol === 'string' ? msg.symbol
            : typeof payload.symbol === 'string' ? payload.symbol
            : undefined
          if (quote != null) cbRef.current.onTick?.(quote, pip, symbol)
          break
        }

        // ── Compra manual: confirmação imediata ────────────────
        // { type:'manual_buy_result', payload:{ clientRef, success, contractId, payout, error } }
        case 'manual_buy_result': {
          cbRef.current.onManualBuyResult?.(payload as unknown as ManualBuyResult)
          break
        }

        // ── Compra manual: resultado final do contrato ─────────
        // { type:'manual_trade_closed', payload:{ clientRef, contractId, profit, won, stake, exitTick, exitDigit } }
        case 'manual_trade_closed': {
          cbRef.current.onManualTradeClosed?.(payload as unknown as ManualTradeClosed)
          break
        }

        // ── Compra manual: não foi possível acompanhar o fecho ──
        case 'manual_trade_error': {
          cbRef.current.onManualTradeError?.(payload as unknown as ManualTradeError)
          break
        }

        // ── O servidor mudou o mercado de um bot ────────────────
        case 'bot_symbol_fallback': {
          const p = payload as Partial<SymbolFallbackInfo>
          if (p.from && p.to) cbRef.current.onSymbolFallback?.({ from: p.from, to: p.to, reason: p.reason })
          break
        }

        case 'authenticated':
          attemptRef.current = 0 // autenticou: ligação boa, zera o backoff
          send('list_bots')
          send('list_session_bots')
          break

        case 'deriv_disconnected':
          cbRef.current.onDerivStatus?.(false)
          break

        case 'deriv_reconnected':
          cbRef.current.onDerivStatus?.(true)
          break

        case 'pong':
          break

        case 'error': {
          const errMsg = typeof payload.message === 'string' ? payload.message
            : typeof payload.error === 'string' ? payload.error
            : typeof msg.message === 'string' ? msg.message
            : 'Erro desconhecido'
          const code = typeof payload.code === 'string' ? payload.code
            : typeof msg.code === 'string' ? msg.code
            : undefined
          if (code && FATAL_AUTH_CODES.has(code)) {
            failedAuthKeyRef.current = `${tokenRef.current}:${accountIdRef.current}`
            cbRef.current.onAuthFailed?.()
          }
          if (!code || !SILENT_CODES.has(code)) cbRef.current.onError?.(errMsg)
          break
        }

        default:
          if (type.startsWith('bot:')) {
            const botId = typeof payload.botId === 'string' ? payload.botId
              : typeof msg.botId === 'string' ? msg.botId : ''
            cbRef.current.onBotEvent?.({ type: type as BotEventType, botId, payload })
          } else {
            console.debug('[NexoraWS] mensagem não tratada:', type, payload)
          }
      }
    } catch (e) {
      console.error('[NexoraWS] erro ao processar mensagem:', type, e)
    }
  }, [send])

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    const current = wsRef.current
    // não abrir 2.º socket se já há um aberto OU a ligar
    if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) return

    let ws: WebSocket
    try {
      ws = new WebSocket(WS_URL)
    } catch (e) {
      console.error('[NexoraWS] URL inválida:', WS_URL, e)
      setWsStatus('error')
      cbRef.current.onError?.('URL de WebSocket inválida')
      return
    }
    wsRef.current = ws
    setWsStatus('connecting')

    ws.onopen = () => {
      if (!mountedRef.current || wsRef.current !== ws) { ws.close(); return }
      openedAtRef.current = Date.now()
      setWsStatus('connected')
      ws.send(JSON.stringify({ type: 'list_bots', payload: {} }))
      if (tokenRef.current && accountIdRef.current) {
        const authKey = `${tokenRef.current}:${accountIdRef.current}`
        if (authKey !== failedAuthKeyRef.current) {
          lastAuthSentRef.current = authKey
          ws.send(JSON.stringify({ type: 'auth', payload: { token: tokenRef.current, accountId: accountIdRef.current } }))
        }
      }

      clearTimers()
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: 'ping', payload: {} }))
      }, PING_INTERVAL_MS)

      lastMessageAtRef.current = Date.now()
      watchdogRef.current = setInterval(() => {
        if (Date.now() - lastMessageAtRef.current > WATCHDOG_TIMEOUT_MS) {
          console.warn('[NexoraWS] sem resposta há 40s — reconectando')
          ws.close()
        }
      }, WATCHDOG_INTERVAL_MS)
    }

    ws.onmessage = (e) => {
      if (wsRef.current !== ws) return
      lastMessageAtRef.current = Date.now()
      handleMessage(e.data)
    }

    ws.onerror = () => {
      if (!mountedRef.current || wsRef.current !== ws) return
      setWsStatus('error')
      cbRef.current.onError?.('Erro de conexão WebSocket')
    }

    ws.onclose = () => {
      // socket já substituído por outro: este evento não interessa
      if (!mountedRef.current || wsRef.current !== ws) return
      setWsStatus('disconnected')
      clearTimers()
      // ligação que aguentou >10 s era boa: recomeça o backoff do zero
      if (openedAtRef.current && Date.now() - openedAtRef.current > STABLE_CONNECTION_MS) attemptRef.current = 0
      openedAtRef.current = 0
      const delay = Math.min(1000 * 2 ** attemptRef.current, MAX_RECONNECT_DELAY_MS)
      attemptRef.current += 1
      if (reconnRef.current) clearTimeout(reconnRef.current)
      reconnRef.current = setTimeout(connect, delay)
    }
  }, [handleMessage])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      clearTimers()
      if (reconnRef.current) clearTimeout(reconnRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  useEffect(() => {
    const tryFastReconnect = () => {
      if (!mountedRef.current) return
      const rs = wsRef.current?.readyState
      if (rs === WebSocket.OPEN || rs === WebSocket.CONNECTING) return
      attemptRef.current = 0
      if (reconnRef.current) { clearTimeout(reconnRef.current); reconnRef.current = null }
      connect()
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') tryFastReconnect() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', tryFastReconnect)
    window.addEventListener('focus', tryFastReconnect)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', tryFastReconnect)
      window.removeEventListener('focus', tryFastReconnect)
    }
  }, [connect])

  useEffect(() => {
    const token = callbacks.token ?? null
    const accountId = callbacks.accountId ?? null
    if (!token || !accountId) return
    const authKey = `${token}:${accountId}`
    if (lastAuthSentRef.current === authKey) return
    if (failedAuthKeyRef.current === authKey) return
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    lastAuthSentRef.current = authKey
    ws.send(JSON.stringify({ type: 'auth', payload: { token, accountId } }))
  }, [callbacks.token, callbacks.accountId])

  return {
    wsStatus,
    listCatalogBots: useCallback(() => { send('list_bots') }, [send]),
    listSessionBots: useCallback(() => { send('list_session_bots') }, [send]),
    startCatalogBot: useCallback((catalogBotId: string, sessionName?: string, configOverride?: Partial<BotConfig>) => {
      sendAction('start_catalog_bot', { catalogBotId, sessionName, configOverride: configOverride ?? {} })
    }, [sendAction]),
    stopBot: useCallback((botId: string) => { sendAction('stop_bot', { botId }) }, [sendAction]),
    pauseBot: useCallback((botId: string) => { sendAction('pause_bot', { botId }) }, [sendAction]),
    resumeBot: useCallback((botId: string) => { sendAction('resume_bot', { botId }) }, [sendAction]),
    deleteBot: useCallback((botId: string) => { sendAction('delete_bot', { botId }) }, [sendAction]),
    getBotLogs: useCallback((botId: string, limit = 100) => { send('get_bot_logs', { botId, limit }) }, [send]),
    // ── Compra manual ──────────────────────────────────────────
    // Devolve false se não houver ligação (o BotsContext mostra o erro no ecrã).
    manualBuy: useCallback((params: ManualBuyParams): boolean =>
      send('manual_buy', params as unknown as Record<string, unknown>), [send]),
    adminAddCatalogBot: useCallback((dto: {
      name: string; description: string; strategy: BotStrategyType
      defaultConfig: BotConfig; tags?: string[]; isActive?: boolean
    }) => { sendAction('admin_add_catalog_bot', dto as Record<string, unknown>) }, [sendAction]),
    adminRemoveCatalogBot: useCallback((id: string) => { sendAction('admin_remove_catalog_bot', { id }) }, [sendAction]),
    adminUpdateCatalogBot: useCallback((id: string, updates: Record<string, unknown>) => {
      sendAction('admin_update_catalog_bot', { id, ...updates })
    }, [sendAction]),
  }
}
