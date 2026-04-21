import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchQuote, type Quote } from '../services/finnhub'

export interface Holding {
  symbol: string
  name: string
  shares: number
  buyPrice: number
}

export interface HoldingWithQuote extends Holding {
  currentPrice: number
  change: number
  changePercent: number
  totalValue: number
  totalCost: number
  gainLoss: number
  gainLossPercent: number
  lastUpdated: string
}

const STORAGE_KEY = 'portfolio-holdings'

export const usePortfolioStore = defineStore('portfolio', () => {
  // Load persisted holdings from localStorage
  const saved = localStorage.getItem(STORAGE_KEY)
  const holdings = ref<Holding[]>(saved ? JSON.parse(saved) : [])
  const quotes = ref<Record<string, Quote>>({})
  const loading = ref(false)

  // Persist holdings to localStorage whenever they change
  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings.value))
  }

  function addHolding(holding: Holding) {
    const existing = holdings.value.findIndex(h => h.symbol === holding.symbol)
    if (existing >= 0) {
      holdings.value[existing] = holding
    } else {
      holdings.value.push(holding)
    }
    saveToStorage()
  }

  function removeHolding(symbol: string) {
    holdings.value = holdings.value.filter(h => h.symbol !== symbol)
    saveToStorage()
  }

  async function refreshQuotes() {
    if (holdings.value.length === 0) return
    loading.value = true
    try {
      await Promise.all(
        holdings.value.map(async h => {
          const q = await fetchQuote(h.symbol)
          quotes.value[h.symbol] = q
        })
      )
    } finally {
      loading.value = false
    }
  }

  const holdingsWithQuotes = computed<HoldingWithQuote[]>(() =>
    holdings.value.map(h => {
      const q = quotes.value[h.symbol]
      const currentPrice = q?.c ?? 0
      const totalValue = currentPrice * h.shares
      const totalCost = h.buyPrice * h.shares
      const gainLoss = totalValue - totalCost
      const gainLossPercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0
      const lastUpdated = q?.t
        ? new Date(q.t * 1000).toLocaleTimeString()
        : 'N/A'
      return {
        ...h,
        currentPrice,
        change: q?.d ?? 0,
        changePercent: q?.dp ?? 0,
        totalValue,
        totalCost,
        gainLoss,
        gainLossPercent,
        lastUpdated,
      }
    })
  )

  const totalValue = computed(() =>
    holdingsWithQuotes.value.reduce((sum, h) => sum + h.totalValue, 0)
  )

  const totalGainLoss = computed(() =>
    holdingsWithQuotes.value.reduce((sum, h) => sum + h.gainLoss, 0)
  )

  const totalCost = computed(() =>
    holdingsWithQuotes.value.reduce((sum, h) => sum + h.totalCost, 0)
  )

  const totalGainLossPercent = computed(() =>
    totalCost.value > 0 ? (totalGainLoss.value / totalCost.value) * 100 : 0
  )

  return {
    holdings,
    quotes,
    loading,
    holdingsWithQuotes,
    totalValue,
    totalGainLoss,
    totalGainLossPercent,
    addHolding,
    removeHolding,
    refreshQuotes,
  }
})
