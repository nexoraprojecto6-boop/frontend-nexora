// ============================================================
// NEXORA — Operar Manual: store de mercado + ordens (fora do React)
// O BotsContext alimenta-o (ver PATCHES.md). Não abre WebSocket próprio.
// ============================================================
import { useSyncExternalStore } from 'react'
import type { MarketSymbol } from '../hooks/useNexoraWs'

export type ContractType = 'CALL' | 'PUT' | 'ONETOUCH' | 'NOTOUCH' | 'ACCU'
export interface Quote { ask: number; payout: number; error?: string }
export interface AccuInfo { maxPayout?: number; maxTicks?: number; barrier?: string }
export interface OpenContract {
  ref: string; contractId?: string; type: ContractType; symbol: string
  stake: number; profit?: number; status: 'buying' | 'open'
}
export interface TradeParams {
  stake: number; duration?: number; durationUnit?: 'ticks' | 's' | 'm'
  barrier?: string; growthRate?: number; takeProfit?: number
}
interface State {
  symbol: string; pip: number; prices: number[]; symbols: MarketSymbol[]
  reqId: string; quotes: Record<string, Quote>; accu: AccuInfo | null; quoting: boolean
  open: OpenContract[]; result: { id: number; won: boolean; profit: number } | null
  error: string | null
}
type Api = {
  send: (type: string, payload?: Record<string, unknown>) => boolean
  subscribeTicks: (symbol: string, count?: number) => void
}

const MAX_PRICES = 300
let s: State = {
  symbol: '1HZ100V', pip: 2, prices: [], symbols: [], reqId: '', quotes: {}, accu: null,
  quoting: false, open: [], result: null, error: null,
}
let api: Api | null = null
let wanted = false
const subs = new Set<() => void>()
const set = (p: Partial<State>) => { s = { ...s, ...p }; subs.forEach(f => f()) }
const uid = () => Math.random().toString(36).slice(2, 10)
const num = (v: unknown) => (typeof v === 'number' ? v : undefined)

export const manual = {
  /** Chamado pelo BotsContext; re-subscreve o mercado se a página já o pediu. */
  attach(a: Api) { api = a; if (wanted) a.subscribeTicks(s.symbol, MAX_PRICES) },
  enter() { wanted = true; api?.subscribeTicks(s.symbol, MAX_PRICES) },
  leave() { wanted = false },
  setSymbol(symbol: string) {
    set({ symbol, prices: [], quotes: {}, accu: null, error: null })
    api?.subscribeTicks(symbol, MAX_PRICES)
  },
  setSymbols(symbols: MarketSymbol[]) { set({ symbols }) },
  pushTick(quote: number, pip?: number, symbol?: string) {
    if (!wanted || (symbol && symbol !== s.symbol)) return
    set({ prices: [...s.prices, quote].slice(-MAX_PRICES), pip: pip ?? s.pip })
  },
  setSnapshot(symbol: string, prices: number[], pip?: number) {
    if (!wanted || symbol !== s.symbol) return
    set({ prices: prices.slice(-MAX_PRICES), pip: pip ?? s.pip })
  },
  quote(types: ContractType[], p: TradeParams) {
    if (!api) return
    const reqId = uid()
    set({ reqId, quoting: true })
    api.send('manual_proposal', { reqId, symbol: s.symbol, types, ...p })
  },
  buy(type: ContractType, p: TradeParams) {
    const ref = uid()
    const ok = api?.send('manual_buy', { symbol: s.symbol, contractType: type, clientRef: ref, ...p })
    if (!ok) return set({ error: 'Sem ligação ao servidor. A reconectar…' })
    set({ error: null, open: [...s.open, { ref, type, symbol: s.symbol, stake: p.stake, status: 'buying' }] })
  },
  sell(contractId: string) { api?.send('manual_sell', { contractId }) },

  /** Recebe todas as mensagens manual_* do useNexoraWs. */
  handle(type: string, p: Record<string, unknown>) {
    const ref = p.clientRef as string | undefined
    const cid = p.contractId as string | undefined
    const drop = () => s.open.filter(o => o.ref !== ref && (!cid || o.contractId !== cid))
    switch (type) {
      case 'manual_proposal':
        if (p.reqId !== s.reqId) return
        set({ quotes: (p.quotes as Record<string, Quote>) ?? {}, accu: (p.accu as AccuInfo) ?? null, quoting: false })
        break
      case 'manual_buy_result':
        if (!s.open.some(o => o.ref === ref)) return
        if (p.success) set({ open: s.open.map(o => (o.ref === ref ? { ...o, contractId: cid, status: 'open' } : o)) })
        else set({ open: drop(), error: (p.error as string) || 'Compra recusada' })
        break
      case 'manual_contract':
        set({ open: s.open.map(o => (o.contractId === cid ? { ...o, profit: num(p.profit) } : o)) })
        break
      case 'manual_trade_closed':
        set({ open: drop(), result: { id: Date.now(), won: !!p.won, profit: num(p.profit) ?? 0 } })
        break
      case 'manual_trade_error':
        set({ open: drop(), error: (p.message as string) || 'Erro no contrato' })
        break
    }
  },
}

export function useManual(): State {
  return useSyncExternalStore(
    cb => { subs.add(cb); return () => { subs.delete(cb) } },
    () => s,
  )
}
