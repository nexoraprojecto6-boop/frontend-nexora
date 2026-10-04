 ============================================================
// NEXORA FOREX — Bots Context
//
// ALTERAÇÃO (Operar Manual): adicionado estado e método para
// compra manual de contratos (fora do sistema de bots), usando
// o mesmo `useNexoraWs` — sem segunda ligação WS.
//
// CORREÇÃO (Operar Manual): os trades manuais agora entram
// também no array `trades` (o mesmo que a <TradesTable/> lê).
//
// ALTERAÇÕES (compatibilidade com o backend v2):
//   • Compras manuais ligadas por `clientRef`: várias compras seguidas já
//     não trocam contractType/stake entre si (antes havia UM só "último
//     pedido" partilhado).
//   • Se o servidor não conseguir acompanhar o contrato (manual_trade_error)
//     ou a ligação cair, o ecrã deixa de ficar preso em "pendente".
//   • Moeda da conta nos valores mostrados (antes: "$" fixo).
//   • bot:trade_opened: o tipo vem de direction | side | contractType
//     (cada estratégia envia um campo diferente).
//   • Avisos: mudança de mercado do bot e perda/restabelecimento da Deriv.
// ============================================================

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react'
import type {
  BotSummary, BotState, BotEvent, BotLogEntry, BotStats, BotConfig,
  BotStrategyType, TradeClosedPayload, TradeOpenedPayload, CatalogBot, WsStatus,
  SymbolFallbackInfo,
} from '../lib/types'
import {
  useNexoraWs, ManualBuyParams, ManualBuyResult, ManualTradeClosed, ManualTradeError,
} from '../hooks/useNexoraWs'
import { useAuth } from './AuthContext'
import { useTrading } from './TradingContext'
import type { Trade } from './TradingContext'
import { playGainSound } from '../lib/sound'
import { formatMoney } from '../lib/money'

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

// ── Registo de trade manual (mesma forma do TradeRecord,
// mas sem botId real — usamos 'manual' como marcador) ─────────
export interface ManualTradeRecord {
  id: string
  hora: string
  stake: number
  profit: number
  won: boolean
  timestamp: number
  pending: boolean
  contractType: string
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
  manualBuy: (params: ManualBuyParams) => void
  manualPendingTrade: ManualTradeRecord | null
  manualTrades: ManualTradeRecord[]
  manualBuyError: string | null
}

const Ctx = createContext<BotsCtx | null>(null)

export function useBots() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useBots must be used inside BotsProvider')
  return c
}

const MAX_TRADES = 300
const MAX_MANUAL_TRADES = 100

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

  // ── Estado de trading manual ───────────────────────────────
  const [manualPendingTrade, setManualPendingTrade] = useState<ManualTradeRecord | null>(null)
  const [manualTrades, setManualTrades] = useState<ManualTradeRecord[]>([])
  const [manualBuyError, setManualBuyError] = useState<string | null>(null)

  // O backend só devolve `contractId`/`payout` (e o clientRef que enviámos),
  // não o contractType/stake originais. Guardamos os parâmetros de cada compra:
  //   clientRef → params   (até chegar a confirmação)
  //   contractId → params  (até o contrato fechar)
  const manualByRefRef = useRef<Map<string, ManualBuyParams>>(new Map())
  const manualByContractRef = useRef<Map<string, ManualBuyParams>>(new Map())
  const lastManualParamsRef = useRef<ManualBuyParams | null>(null) // fallback p/ servidor antigo (sem clientRef)
  const manualSeqRef = useRef(0)

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
  const showManualError = useCallback((msg: string, ms = 6000) => {
    setManualBuyError(msg)
    setTimeout(() => setManualBuyError(null), ms)
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

  const handleTick = useCallback((quote: number, pipSize?: number, symbol?: string) => {
    trading._setTick(quote, pipSize, symbol)
  }, [trading._setTick])

  // ── Handlers de compra manual ──────────────────────────────
  const takeParamsByRef = (clientRef?: string): ManualBuyParams | null => {
    if (clientRef) {
      const p = manualByRefRef.current.get(clientRef) ?? null
      manualByRefRef.current.delete(clientRef)
      if (p) return p
    }
    return lastManualParamsRef.current
  }

  const handleManualBuyResult = useCallback((result: ManualBuyResult) => {
    const params = takeParamsByRef(result.clientRef)

    if (!result.success) {
      showManualError(result.error ?? 'Não foi possível abrir o contrato.')
      return
    }
    if (result.contractId && params) manualByContractRef.current.set(result.contractId, params)

    setManualPendingTrade({
      id: result.contractId ?? `manual_${Date.now()}`,
      hora: new Date().toLocaleTimeString('pt-PT'),
      stake: params?.stake ?? 0,
      profit: 0,
      won: false,
      timestamp: Date.now(),
      pending: true,
      contractType: params?.contractType ?? '',
    })

    // Mostra logo uma linha "em aberto" na tabela de histórico,
    // para o utilizador ver imediatamente que o contrato foi
    // comprado (fica marcada como pending até fechar).
    const openRec: TradeRecord = {
      id: result.contractId ?? `manual_${Date.now()}`,
      hora: new Date().toLocaleTimeString('pt-PT'),
      botId: 'manual',
      botName: 'Manual',
      strategy: 'manual',
      stake: params?.stake ?? 0,
      profit: 0,
      won: false,
      timestamp: Date.now(),
      pending: true,
      contractType: params?.contractType ?? '',
    }
    setTrades(prev => [openRec, ...prev].slice(0, MAX_TRADES))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showManualError])

  const handleManualTradeClosed = useCallback((closed: ManualTradeClosed) => {
    const params = manualByContractRef.current.get(closed.contractId)
      ?? (closed.clientRef ? manualByRefRef.current.get(closed.clientRef) : undefined)
      ?? lastManualParamsRef.current
    manualByContractRef.current.delete(closed.contractId)

    const contractType = params?.contractType ?? ''
    const hora = new Date().toLocaleTimeString('pt-PT')

    const rec: ManualTradeRecord = {
      id: closed.contractId,
      hora,
      stake: closed.stake,
      profit: closed.profit,
      won: closed.won,
      timestamp: Date.now(),
      pending: false,
      contractType,
      exitDigit: closed.exitDigit,
    }
    // só limpa o "pendente" se for ESTE contrato (pode haver outro já em curso)
    setManualPendingTrade(prev => (prev && prev.id === closed.contractId ? null : prev))
    setManualTrades(prev => [rec, ...prev].slice(0, MAX_MANUAL_TRADES))

    // Atualiza a linha "pending" criada em handleManualBuyResult (mesmo id)
    // para o resultado final — a <TradesTable/> lê `trades`, não `manualTrades`.
    setTrades(prev => {
      const idx = prev.findIndex(t => t.id === closed.contractId && t.botId === 'manual')
      const closedRec: TradeRecord = {
        id: closed.contractId,
        hora,
        botId: 'manual',
        botName: 'Manual',
        strategy: 'manual',
        stake: closed.stake,
        profit: closed.profit,
        won: closed.won,
        timestamp: Date.now(),
        pending: false,
        contractType,
        exitTick: closed.exitTick,
        exitDigit: closed.exitDigit,
      }
      if (idx === -1) return [closedRec, ...prev].slice(0, MAX_TRADES)
      const next = [...prev]
      next[idx] = closedRec
      return next
    })

    // Mantém também o strip legado do TradingContext
    const t: Trade = { id: rec.id, hora: rec.hora, tipo: contractType || 'Manual', tickFinal: rec.exitDigit ?? 0, preco: formatMoney(rec.stake, trading.currency), resultado: rec.profit }
    trading._addTrade(t)
    if (closed.won) playGainSound()
  }, [trading])

  // O servidor não conseguiu acompanhar o contrato: desbloqueia o ecrã
  // (a linha em "pendente" na tabela fica, porque o contrato pode ainda
  // estar aberto na Deriv — o utilizador confirma lá).
  const handleManualTradeError = useCallback((err: ManualTradeError) => {
    if (err.contractId) manualByContractRef.current.delete(err.contractId)
    setManualPendingTrade(prev => (prev && (!err.contractId || prev.id === err.contractId) ? null : prev))
    showManualError(err.message, 9000)
  }, [showManualError])

  const handleSymbolFallback = useCallback((info: SymbolFallbackInfo) => {
    showStatusMessage(
      `Mercado ${info.from} indisponível${info.reason ? ` (${info.reason})` : ''} — o bot vai operar em ${info.to}.`,
      'warning',
    )
  }, [showStatusMessage])

  const handleDerivStatus = useCallback((connected: boolean) => {
    if (connected) showStatusMessage('Ligação à Deriv restabelecida.', 'success')
    else showStatusMessage('Ligação à Deriv perdida. A reconectar… Os bots continuam ativos.', 'warning')
  }, [showStatusMessage])

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
        const rec: TradeRecord = {
          id: p.contractId, hora: new Date().toLocaleTimeString('pt-PT'), botId, botName: name, strategy,
          stake: p.stake, profit: 0, won: false, timestamp: Date.now(), pending: true,
          // cada estratégia envia um campo diferente
          direction: p.direction ?? p.side ?? p.contractType,
        }
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
        const t: Trade = { id: rec.id, hora: rec.hora, tipo: rec.contractType ?? strategy, tickFinal: rec.exitDigit ?? rec.exitTick ?? 0, preco: formatMoney(rec.stake, trading.currency), resultado: rec.profit }
        trading._addTrade(t)

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
        const cur = trading.currency
        let msg = `${name}: parado automaticamente.`
        if (p.reason === 'max_profit_reached') msg = `🎯 ${name}: Meta de lucro atingida!${p.maxProfit != null ? ` (${formatMoney(p.maxProfit, cur)})` : ''}`
        else if (p.reason === 'max_loss_reached') msg = `🛑 ${name}: Stop de perda atingido.${p.maxLoss != null ? ` (${formatMoney(p.maxLoss, cur)})` : ''}`
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
    onManualBuyResult: handleManualBuyResult, onManualTradeClosed: handleManualTradeClosed,
    onManualTradeError: handleManualTradeError,
    onSymbolFallback: handleSymbolFallback, onDerivStatus: handleDerivStatus,
    token, accountId,
  })

  // ── Compra manual: gera um clientRef, guarda os parâmetros
  // (contractType, stake) e envia. O servidor devolve o clientRef em
  // todas as respostas, por isso cada compra fica ligada aos SEUS dados
  // mesmo com várias seguidas. ─────────────────────────────────────
  const manualBuyWrapped = useCallback((params: ManualBuyParams) => {
    const clientRef = `m_${Date.now().toString(36)}_${(manualSeqRef.current++).toString(36)}`
    manualByRefRef.current.set(clientRef, params)
    lastManualParamsRef.current = params
    const sent = ws.manualBuy({ ...params, clientRef })
    if (!sent) {
      manualByRefRef.current.delete(clientRef)
      showManualError('Sem ligação ao servidor. Tente novamente dentro de instantes.')
    }
  }, [ws.manualBuy, showManualError])

  useEffect(() => { trading._setConnected(ws.wsStatus === 'connected') }, [ws.wsStatus]) // eslint-disable-line

  // Ligação ao servidor caiu: o servidor deixa de acompanhar os contratos
  // manuais em curso (o resultado já não chega). Não deixa o ecrã preso.
  useEffect(() => {
    if (ws.wsStatus === 'connected') return
    if (manualByContractRef.current.size === 0 && manualByRefRef.current.size === 0) return
    manualByContractRef.current.clear()
    manualByRefRef.current.clear()
    setManualPendingTrade(null)
    showStatusMessage('Ligação perdida durante uma compra manual. Confirme o resultado na Deriv.', 'warning')
  }, [ws.wsStatus, showStatusMessage])

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
      manualBuy: manualBuyWrapped,
      manualPendingTrade,
      manualTrades,
      manualBuyError,
    }}>
      {children}
    </Ctx.Provider>
  )
}
