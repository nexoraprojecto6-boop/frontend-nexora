// ============================================================
// NEXORA FOREX — Trading Context
//
// ÚNICA fonte de dados de mercado (balance, ticks, gráfico).
// Os ticks vêm do backend pela ligação da sessão:
//   • ticks_snapshot → histórico inicial (substitui tudo)
//   • tick           → cada tick novo (aplicado de imediato)
// O último dígito usa o pip_size real do tick.
// ============================================================

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import { decimalsFromPip } from '../lib/money'

export interface BarEntry {
  digit: number
  percentage: number
  isHighlight: boolean
  isLow: boolean
}

export interface Trade {
  id: string
  hora: string
  tipo: string
  tickFinal: number
  preco: string
  resultado: number
}

export interface BotStatusUi {
  isRunning: boolean
  currentStep: 'idle' | 'analyzing' | 'contract_open' | 'contract_closed'
}

export interface ChartData {
  barData: BarEntry[]
  lastDigit: number
}

interface TradingContextValue {
  balance: number
  profit: number
  wins: number
  losses: number
  currency: string
  lastDigit: number
  chartData: ChartData | null
  lastDigits: number[]
  tickCount: number
  snapshotVersion: number
  isConnected: boolean
  loading: boolean

  selectedTicks: number
  setSelectedTicks: (t: number) => void

  /** Histórico de dígitos (do mais antigo ao mais recente). Não alterar. */
  getDigits: () => number[]

  trades: Trade[]
  clearTrades: () => void

  botStatus: BotStatusUi

  _setBalance: (b: number, c: string) => void
  _setTick: (quote: number, pipSize?: number, symbol?: string) => void
  _setTicksSnapshot: (symbol: string, prices: number[], pipSize?: number) => void
  _setBotStatus: (s: BotStatusUi) => void
  _addTrade: (t: Trade) => void
  _setConnected: (v: boolean) => void
}

const TradingContext = createContext<TradingContextValue | undefined>(undefined)

const MAX_DIGIT_HISTORY = 1000
const MAX_LAST_STRIP = 24
const LOADING_SAFETY_TIMEOUT_MS = 8000

function digitOf(quote: number, pipSize?: number): number {
  const s = quote.toFixed(decimalsFromPip(pipSize, 2))
  return parseInt(s[s.length - 1], 10)
}

function computeBarData(digits: number[], windowSize: number): BarEntry[] {
  const slice = digits.slice(-windowSize)
  const counts = Array(10).fill(0)
  slice.forEach(d => counts[d]++)
  const total = slice.length || 1
  const pcts = counts.map(c => (c / total) * 100)
  const max = Math.max(...pcts)
  const min = Math.min(...pcts)
  return pcts.map((pct, digit) => ({ digit, percentage: pct, isHighlight: pct === max, isLow: pct === min }))
}

export function TradingProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState(0)
  const [currency, setCurrency] = useState('USD')
  const [profit, setProfit] = useState(0)
  const [wins, setWins] = useState(0)
  const [losses, setLosses] = useState(0)
  const [lastDigit, setLastDigit] = useState(0)
  const [lastDigits, setLastDigits] = useState<number[]>([])
  const [tickCount, setTickCount] = useState(0)
  const [snapshotVersion, setSnapshotVersion] = useState(0)
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedTicks, setSelectedTicks] = useState(100)
  const [trades, setTrades] = useState<Trade[]>([])
  const [botStatus, setBotStatus] = useState<BotStatusUi>({ isRunning: false, currentStep: 'idle' })

  const digitHistory = useRef<number[]>([])
  const selectedTicksRef = useRef(selectedTicks)
  const symbolRef = useRef<string | null>(null)
  useEffect(() => { selectedTicksRef.current = selectedTicks }, [selectedTicks])

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), LOADING_SAFETY_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [])

  const getDigits = useCallback(() => digitHistory.current, [])

  const _setBalance = useCallback((b: number, c: string) => {
    setBalance(b)
    setCurrency(c)
  }, [])

  // Histórico inicial (ou novo histórico após reconexão / troca de mercado)
  const _setTicksSnapshot = useCallback((symbol: string, prices: number[], pipSize?: number) => {
    symbolRef.current = symbol
    const digits = prices
      .map(p => digitOf(p, pipSize))
      .filter(d => !Number.isNaN(d))
      .slice(-MAX_DIGIT_HISTORY)
    digitHistory.current = digits
    if (digits.length === 0) return

    const last = digits[digits.length - 1]
    setLastDigit(last)
    setLastDigits(digits.slice(-MAX_LAST_STRIP))
    setChartData({ barData: computeBarData(digits, selectedTicksRef.current), lastDigit: last })
    setLoading(false)
    setTickCount(c => c + 1)
    setSnapshotVersion(v => v + 1)
  }, [])

  // Tick novo: aplicado de imediato, sem filas nem microtasks
  const _setTick = useCallback((quote: number, pipSize?: number, symbol?: string) => {
    if (symbol && symbolRef.current && symbol !== symbolRef.current) return

    const digit = digitOf(quote, pipSize)
    if (Number.isNaN(digit)) return

    const h = digitHistory.current
    h.push(digit)
    if (h.length > MAX_DIGIT_HISTORY) h.splice(0, h.length - MAX_DIGIT_HISTORY)

    setLastDigit(digit)
    setLoading(false)
    setTickCount(c => c + 1)
    setLastDigits(prev => {
      const next = [...prev, digit]
      return next.length > MAX_LAST_STRIP ? next.slice(-MAX_LAST_STRIP) : next
    })
    setChartData({ barData: computeBarData(h, selectedTicksRef.current), lastDigit: digit })
  }, [])

  const _setBotStatus = useCallback((s: BotStatusUi) => setBotStatus(s), [])

  const _addTrade = useCallback((t: Trade) => {
    setTrades(prev => [t, ...prev].slice(0, 500))
    if (t.resultado > 0) {
      setWins(w => w + 1)
      setProfit(p => p + t.resultado)
    } else {
      setLosses(l => l + 1)
      setProfit(p => p + t.resultado)
    }
  }, [])

  const _setConnected = useCallback((v: boolean) => setIsConnected(v), [])

  const clearTrades = useCallback(() => {
    setTrades([])
    setWins(0)
    setLosses(0)
    setProfit(0)
  }, [])

  return (
    <TradingContext.Provider value={{
      balance, profit, wins, losses, currency, lastDigit, chartData,
      lastDigits, tickCount, snapshotVersion, isConnected, loading, selectedTicks, setSelectedTicks,
      getDigits, trades, clearTrades, botStatus,
      _setBalance, _setTick, _setTicksSnapshot, _setBotStatus, _addTrade, _setConnected,
    }}>
      {children}
    </TradingContext.Provider>
  )
}

export function useTrading() {
  const ctx = useContext(TradingContext)
  if (!ctx) throw new Error('useTrading must be used inside <TradingProvider>')
  return ctx
}
