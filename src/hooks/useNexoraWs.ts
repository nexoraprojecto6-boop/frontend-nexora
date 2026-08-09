// ============================================================
// NEXORA FOREX — WebSocket Hook
//
// ALTERAÇÃO (Operar Manual): adicionado o envio `manual_buy` e a
// escuta dos eventos `manual_buy_result` (confirmação de compra)
// e `manual_trade_closed` (resultado final do contrato manual).
// Segue exatamente o mesmo padrão dos eventos `bot:*` já existentes.
// ============================================================

import { useEffect, useRef, useCallback, useState } from 'react'
import type {
  BotEvent, BotEventType, BotState, BotSummary, BotLogEntry,
  BotConfig, BotStrategyType, CatalogBot, WsStatus,
} from '../lib/types'
import { WS_URL } from '../lib/env'

export interface ManualBuyParams {
  symbol: string
  contractType: 'DIGITOVER' | 'DIGITUNDER' | 'DIGITMATCH' | 'DIGITDIFF' | 'CALL' | 'PUT'
  duration: number
  durationUnit: 'ticks' | 's' | 'm'
  stake: number
  barrier?: number | string
}

export interface ManualBuyResult {
  success: boolean
  contractId?: string
  payout?: number
  error?: string
}

export interface ManualTradeClosed {
  contractId: string
  profit: number
  won: boolean
  stake: number
  exitTick?: number
  exitDigit?: number
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
  onTick?: (quote: number) => void
  onManualBuyResult?: (result: ManualBuyResult) => void
  onManualTradeClosed?: (trade: ManualTradeClosed) => void
  token?: string | null
  accountId?: string | null
}

const PING_INTERVAL_MS = 15_000
const WATCHDOG_INTERVAL_MS = 10_000
const WATCHDOG_TIMEOUT_MS = 40_000
const MAX_RECONNECT_DELAY_MS = 30_000

export function useNexoraWs(callbacks: NexoraWsCallbacks = {}) {
  const wsRef = useRef<WebSocket | null>(null)
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptRef = useRef(0)
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

  const send = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }))
    }
  }, [])

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
          if (quote != null) cbRef.current.onTick?.(quote)
          break
        }

        // ── Compra manual: confirmação imediata ────────────────
        // Backend deve emitir: { type:'manual_buy_result', success, contractId, payout, error }
        case 'manual_buy_result': {
          cbRef.current.onManualBuyResult?.(payload as unknown as ManualBuyResult)
          break
        }

        // ── Compra manual: resultado final do contrato ─────────
        // Backend deve emitir: { type:'manual_trade_closed', contractId, profit, won, stake, exitTick, exitDigit }
        case 'manual_trade_closed': {
          cbRef.current.onManualTradeClosed?.(payload as unknown as ManualTradeClosed)
          break
        }

        case 'authenticated':
          send('list_bots')
          send('list_session_bots')
          break

        case 'deriv_disconnected':
        case 'deriv_reconnected':
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
          if (code === 'AUTH_FAILED' || code === 'MISSING_TOKEN' || code === 'NO_ACCOUNTS' || code === 'OTP_FAILED') {
            failedAuthKeyRef.current = `${tokenRef.current}:${accountIdRef.current}`
            cbRef.current.onAuthFailed?.()
          }
          cbRef.current.onError?.(errMsg)
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
    if (wsRef.current?.readyState === WebSocket.OPEN) return

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
      if (!mountedRef.current) { ws.close(); return }
      attemptRef.current = 0
      setWsStatus('connected')
      ws.send(JSON.stringify({ type: 'list_bots', payload: {} }))
      if (tokenRef.current && accountIdRef.current) {
        const authKey = `${tokenRef.current}:${accountIdRef.current}`
        if (authKey !== failedAuthKeyRef.current) {
          lastAuthSentRef.current = authKey
          ws.send(JSON.stringify({ type: 'auth', payload: { token: tokenRef.current, accountId: accountIdRef.current } }))
        }
      }
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: 'ping', payload: {} }))
      }, PING_INTERVAL_MS)

      lastMessageAtRef.current = Date.now()
      if (watchdogRef.current) clearInterval(watchdogRef.current)
      watchdogRef.current = setInterval(() => {
        if (Date.now() - lastMessageAtRef.current > WATCHDOG_TIMEOUT_MS) {
          console.warn('[NexoraWS] sem resposta há 40s — reconectando')
          ws.close()
        }
      }, WATCHDOG_INTERVAL_MS)
    }

    ws.onmessage = (e) => {
      lastMessageAtRef.current = Date.now()
      handleMessage(e.data)
    }

    ws.onerror = () => {
      if (!mountedRef.current) return
      setWsStatus('error')
      cbRef.current.onError?.('Erro de conexão WebSocket')
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      setWsStatus('disconnected')
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null }
      if (watchdogRef.current) { clearInterval(watchdogRef.current); watchdogRef.current = null }
      const delay = Math.min(1000 * 2 ** attemptRef.current, MAX_RECONNECT_DELAY_MS)
      attemptRef.current += 1
      reconnRef.current = setTimeout(connect, delay)
    }
  }, [handleMessage])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      if (pingRef.current) clearInterval(pingRef.current)
      if (watchdogRef.current) clearInterval(watchdogRef.current)
      if (reconnRef.current) clearTimeout(reconnRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  useEffect(() => {
    const tryFastReconnect = () => {
      if (!mountedRef.current) return
      if (wsRef.current?.readyState === WebSocket.OPEN) return
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
    listCatalogBots: useCallback(() => send('list_bots'), [send]),
    listSessionBots: useCallback(() => send('list_session_bots'), [send]),
    startCatalogBot: useCallback((catalogBotId: string, sessionName?: string, configOverride?: Partial<BotConfig>) =>
      send('start_catalog_bot', { catalogBotId, sessionName, configOverride: configOverride ?? {} }), [send]),
    stopBot: useCallback((botId: string) => send('stop_bot', { botId }), [send]),
    pauseBot: useCallback((botId: string) => send('pause_bot', { botId }), [send]),
    resumeBot: useCallback((botId: string) => send('resume_bot', { botId }), [send]),
    deleteBot: useCallback((botId: string) => send('delete_bot', { botId }), [send]),
    getBotLogs: useCallback((botId: string, limit = 100) => send('get_bot_logs', { botId, limit }), [send]),
    // ── NOVO: compra manual ────────────────────────────────────
    manualBuy: useCallback((params: ManualBuyParams) => send('manual_buy', params as unknown as Record<string, unknown>), [send]),
    adminAddCatalogBot: useCallback((dto: {
      name: string; description: string; strategy: BotStrategyType
      defaultConfig: BotConfig; tags?: string[]; isActive?: boolean
    }) => send('admin_add_catalog_bot', dto as Record<string, unknown>), [send]),
    adminRemoveCatalogBot: useCallback((id: string) => send('admin_remove_catalog_bot', { id }), [send]),
    adminUpdateCatalogBot: useCallback((id: string, updates: Record<string, unknown>) =>
      send('admin_update_catalog_bot', { id, ...updates }), [send]),
  }
}
