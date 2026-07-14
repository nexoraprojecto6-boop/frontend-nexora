// ============================================================
// NEXORA FOREX — Bots Context
// ============================================================

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react'
import type {
  BotSummary, BotState, BotEvent, BotLogEntry, BotStats, BotConfig,
  BotStrategyType, TradeClosedPayload, TradeOpenedPayload, CatalogBot, WsStatus,
} from '../lib/types'
import { useNexoraWs } from '../hooks/useNexoraWs'
import { useAuth } from './AuthContext'
import { useTrading } from './TradingContext'
import type { Trade } from './TradingContext'
import { playGainSound } from '../lib/sound'

export interface TradeRecord {
  id: string
  hora: string
  botId: string
  botName: string
  strategy: string
  stake: number
  profit: number
  won: boolean
  timestamp: number
  pending?: boolean
  direction?: string
  contractType?: string
  exitTick?: number
  exitDigit?: number
}

interface BotsCtx {
  catalogBots: CatalogBot[]
  isLoadingCatalog: boolean
  sessionBots: BotSummary[]
  botStates: Record<string, BotState>
  wsStatus: WsStatus
  lastError: string | null
  statusMessage: { text: string; kind: 'success' | 'warning' | 'error' } | null
  trades: TradeRecord[]
  botTrades: Record<string, TradeRecord[]>
  openTrades: Record<string, TradeRecord>
  botLogs: Record<string, BotLogEntry[]>
  listCatalogBots: () => void
  listSessionBots: () => void
  startCatalogBot: (catalogBotId: string, sessionName?: string, configOverride?: Partial<BotConfig>) => void
  stopBot: (botId: string) => void
  pauseBot: (botId: string) => void
  resumeBot: (botId: string) => void
  deleteBot: (botId: string) => void
  getBotLogs: (botId: string, limit?: number) => void
  clearTrades: () => void
  adminAddCatalogBot: (dto: { name: string; description: string; strategy: BotStrategyType; defaultConfig: BotConfig; tags?: string[]; isActive?: boolean }) => void
  adminRemoveCatalogBot: (id: string) => void
  adminUpdateCatalogBot: (id: string, updates: Record<string, unknown>) => void
}

const Ctx = createContext<BotsCtx | null>(null)

export function useBots() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useBots must be used inside BotsProvider')
  return c
}

const MAX_TRADES = 300

export function BotsProvider({ children }: { children: ReactNode }) {
  const { isLoading, currentAccount } = useAuth()
  const trading = useTrading()

  const [token, setToken] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading) return
    setToken(localStorage.getItem('token'))
    setAccountId(currentAccount?.account_id || localStorage.getItem('currentAccountId') || null)
  }, [isLoading, currentAccount?.account_id])

  const [catalogBots, setCatalogBots] = useState<CatalogBot[]>([])
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true)
  const [sessionBots, setSessionBots] = useState<BotSummary[]>([])
  const [botStates, setBotStates] = useState<Record<string, BotState>>({})
  const [trades, setTrades] = useState<TradeRecord[]>([])
  const [botTrades, setBotTrades] = useState<Record<string, TradeRecord[]>>({})
  const [openTrades, setOpenTrades] = useState<Record<string, TradeRecord>>({})
  const [botLogs, setBotLogs] = useState<Record<string, BotLogEntry[]>>({})
  const [lastError, setLastError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ text: string; kind: 'success' | 'warning' | 'error' } | null>(null)

  const sessionBotsRef = useRef<BotSummary[]>([])
  const getBotMeta = (botId: string) => {
    const b = sessionBotsRef.current.find(x => x.id === botId)
    return { name: b?.name ?? botId, strategy: b?.strategy ?? 'unknown' }
  }

  const patchSessionBot = useCallback((botId: string, patch: Partial<BotSummary>) => {
    setSessionBots(prev => {
      const next = prev.map(b => b.id === botId ? { ...b, ...patch } : b)
      sessionBotsRef.current = next
      return next
    })
  }, [])

  const showError = useCallback((msg: string) => {
    setLastError(msg); setTimeout(() => setLastError(null), 6000)
  }, [])
  const showStatusMessage = useCallback((text: string, kind: 'success' | 'warning' | 'error') => {
    setStatusMessage({ text, kind }); setTimeout(() => setStatusMessage(null), 8000)
  }, [])

  const handleCatalogLoaded = useCallback((bots: CatalogBot[]) => { setCatalogBots(bots); setIsLoadingCatalog(false) }, [])
  const handleSessionBotsLoaded = useCallback((bots: BotSummary[]) => { sessionBotsRef.current = bots; setSessionBots(bots) }, [])
  const handleBotStarted = useCallback((bot: BotState & { catalogBotId?: string }) => {
    const summary: BotSummary = { id: bot.id, name: bot.name, strategy: bot.strategy, status: bot.status, stats: bot.stats, startedAt: bot.startedAt, stoppedAt: bot.stoppedAt }
    setSessionBots(prev => { const next = [...prev, summary]; sessionBotsRef.current = next; return next })
    setBotStates(prev => ({ ...prev, [bot.id]: bot }))
  }, [])
  const handleBotLogs = useCallback((botId: string, logs: BotLogEntry[]) => {
    setBotLogs(prev => ({ ...prev, [botId]: logs }))
  }, [])

  const handleBalance = useCallback((balance: number, currency: string) => {
    trading._setBalance(balance, currency)
  }, [trading._setBalance])

  const handleTick = useCallback((quote: number) => {
    trading._setTick(quote)
  }, [trading._setTick])

  const handleBotEvent = useCallback((ev: BotEvent) => {
    const { type, botId, payload } = ev
    switch (type) {
      case 'bot:started':
        patchSessionBot(botId, { status: 'running', startedAt: new Date().toISOString() })
        trading._setBotStatus({ isRunning: true, currentStep: 'analyzing' }); break
      case 'bot:stopped':
        patchSessionBot(botId, { status: 'stopped', stoppedAt: new Date().toISOString() })
        trading._setBotStatus({ isRunning: false, currentStep: 'idle' })
        setOpenTrades(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (n[k].botId === botId) delete n[k] }); return n }); break
      case 'bot:paused':
        patchSessionBot(botId, { status: 'paused' })
        trading._setBotStatus({ isRunning: false, currentStep: 'idle' }); break
      case 'bot:resumed':
        patchSessionBot(botId, { status: 'running' })
        trading._setBotStatus({ isRunning: true, currentStep: 'analyzing' }); break
      case 'bot:error': {
        const msg = (payload as { error?: string }).error ?? 'Erro desconhecido'
        patchSessionBot(botId, { status: 'error' })
        setBotStates(p => ({ ...p, [botId]: p[botId] ? { ...p[botId], lastError: msg, status: 'error' } : p[botId] }))
        showError(`Bot: ${msg}`); break
      }
      case 'bot:stats_updated': {
        const stats = (payload as { stats?: BotStats }).stats; if (!stats) break
        patchSessionBot(botId, { stats })
        setBotStates(p => ({ ...p, [botId]: p[botId] ? { ...p[botId], stats } : p[botId] })); break
      }
      case 'bot:trade_opened': {
        const p = payload as unknown as TradeOpenedPayload; if (!p?.contractId) break
        const { name, strategy } = getBotMeta(botId)
        const rec: TradeRecord = { id: p.contractId, hora: new Date().toLocaleTimeString('pt-PT'), botId, botName: name, strategy, stake: p.stake, profit: 0, won: false, timestamp: Date.now(), pending: true, direction: p.direction }
        setOpenTrades(prev => ({ ...prev, [p.contractId]: rec }))
        trading._setBotStatus({ isRunning: true, currentStep: 'contract_open' }); break
      }
      case 'bot:trade_closed': {
        const p = payload as unknown as TradeClosedPayload; if (!p?.contractId) break
        const { name, strategy } = getBotMeta(botId)
        const rec: TradeRecord = {
          id: p.contractId, hora: new Date().toLocaleTimeString('pt-PT'), botId, botName: name, strategy,
          stake: p.stake, profit: p.profit, won: p.won, timestamp: Date.now(), pending: false,
          contractType: p.contractType, exitTick: p.exitTick, exitDigit: p.exitDigit,
        }
        setOpenTrades(prev => { const n = { ...prev }; delete n[p.contractId]; return n })
        setTrades(prev => [rec, ...prev].slice(0, MAX_TRADES))
        setBotTrades(prev => ({ ...prev, [botId]: [rec, ...(prev[botId] ?? [])].slice(0, MAX_TRADES) }))
        const t: Trade = { id: rec.id, hora: rec.hora, tipo: rec.contractType ?? strategy, tickFinal: rec.exitDigit ?? rec.exitTick ?? 0, preco: `$${rec.stake.toFixed(2)}`, resultado: rec.profit }
        trading._addTrade(t)

        // 🔊 Som de "gain" — só quando o trade fecha com ganho (won).
        // playGainSound() já verifica internamente se o som está
        // ativado (preferência em localStorage via lib/sound.ts).
        if (p.won) playGainSound()

        trading._setBotStatus({ isRunning: true, currentStep: 'contract_closed' })
        setTimeout(() => trading._setBotStatus({ isRunning: true, currentStep: 'analyzing' }), 1500); break
      }
      case 'bot:log': {
        const entry = (payload as { entry?: BotLogEntry }).entry; if (!entry) break
        setBotLogs(prev => ({ ...prev, [botId]: [entry, ...(prev[botId] ?? [])].slice(0, 200) })); break
      }
      case 'bot:goal_reached': {
        const p = payload as { reason?: string; maxProfit?: number; maxLoss?: number; maxTrades?: number }
        const { name } = getBotMeta(botId)
        let msg = `${name}: parado automaticamente.`
        if (p.reason === 'max_profit_reached') msg = `🎯 ${name}: Meta de lucro atingida! ($${p.maxProfit?.toFixed(2)})`
        else if (p.reason === 'max_loss_reached') msg = `🛑 ${name}: Stop de perda atingido. ($${p.maxLoss?.toFixed(2)})`
        else if (p.reason === 'max_trades_reached') msg = `✅ ${name}: Limite de ${p.maxTrades} trades atingido.`
        showStatusMessage(msg, p.reason === 'max_profit_reached' ? 'success' : 'warning'); break
      }
      case 'bot:insufficient_balance': {
        const { name } = getBotMeta(botId)
        showStatusMessage(`💰 ${name}: Saldo insuficiente. Bot parado.`, 'error'); break
      }
    }
  }, [patchSessionBot, showError, showStatusMessage, trading])

  const handleAuthFailed = useCallback(() => {
    showError('Sessão expirada — por favor inicia sessão novamente.')
    localStorage.removeItem('token'); localStorage.removeItem('currentAccountId')
    setTimeout(() => { window.location.href = '/' }, 1500)
  }, [showError])

  const ws = useNexoraWs({
    onCatalogLoaded: handleCatalogLoaded, onSessionBotsLoaded: handleSessionBotsLoaded,
    onBotStarted: handleBotStarted, onBotEvent: handleBotEvent,
    onBotLogs: handleBotLogs, onError: showError, onAuthFailed: handleAuthFailed,
    onBalance: handleBalance, onTick: handleTick,
    token, accountId,
  })

  useEffect(() => { trading._setConnected(ws.wsStatus === 'connected') }, [ws.wsStatus]) // eslint-disable-line

  const clearTrades = useCallback(() => { setTrades([]); setBotTrades({}) }, [])

  return (
    <Ctx.Provider value={{
      catalogBots, isLoadingCatalog, sessionBots, botStates,
      wsStatus: ws.wsStatus, lastError, statusMessage,
      trades, botTrades, openTrades, botLogs,
      listCatalogBots: ws.listCatalogBots, listSessionBots: ws.listSessionBots,
      startCatalogBot: ws.startCatalogBot,
      stopBot: ws.stopBot, pauseBot: ws.pauseBot, resumeBot: ws.resumeBot,
      deleteBot: ws.deleteBot, getBotLogs: ws.getBotLogs, clearTrades,
      adminAddCatalogBot: ws.adminAddCatalogBot,
      adminRemoveCatalogBot: ws.adminRemoveCatalogBot,
      adminUpdateCatalogBot: ws.adminUpdateCatalogBot,
    }}>
      {children}
    </Ctx.Provider>
  )
}
