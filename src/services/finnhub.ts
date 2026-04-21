import axios, { AxiosError, type AxiosRequestConfig } from 'axios'

const API_KEY = import.meta.env.VITE_FINNHUB_KEY as string
const BASE_URL = 'https://finnhub.io/api/v1'

export const hasApiKey = Boolean(API_KEY && API_KEY.length > 0)

const client = axios.create({ baseURL: BASE_URL })

export class FinnhubError extends Error {
  status: number | null
  friendly: string
  retryable: boolean

  constructor(status: number | null, friendly: string, retryable: boolean, cause?: unknown) {
    super(friendly)
    this.name = 'FinnhubError'
    this.status = status
    this.friendly = friendly
    this.retryable = retryable
    if (cause) (this as any).cause = cause
  }
}

function toFinnhubError(err: unknown): FinnhubError {
  const ax = err as AxiosError
  const status = ax?.response?.status ?? null

  if (status === 401 || status === 403) {
    return new FinnhubError(
      status,
      "Finnhub rejected the request. Your API key may be invalid, expired, or missing. Check that VITE_FINNHUB_KEY is set in your .env and restart the dev server.",
      false,
      err
    )
  }
  if (status === 429) {
    return new FinnhubError(
      status,
      "You've hit Finnhub's rate limit (60 requests per minute on the free tier). Wait a moment and try again.",
      true,
      err
    )
  }
  if (status === 404) {
    return new FinnhubError(status, 'That symbol was not found on Finnhub.', false, err)
  }
  if (status && status >= 500) {
    return new FinnhubError(status, "Finnhub is having trouble right now. Please try again in a moment.", true, err)
  }
  if (!ax?.response) {
    return new FinnhubError(null, 'Network error — check your connection and try again.', true, err)
  }
  return new FinnhubError(status, 'Something went wrong reaching Finnhub. Please try again.', true, err)
}

client.interceptors.response.use(
  (r) => r,
  (err) => Promise.reject(toFinnhubError(err))
)

async function getWithRetry<T>(path: string, config: AxiosRequestConfig, retries = 2): Promise<T> {
  let attempt = 0
  let lastErr: unknown
  while (attempt <= retries) {
    try {
      const { data } = await client.get<T>(path, config)
      return data
    } catch (err) {
      lastErr = err
      const fe = err as FinnhubError
      if (!fe?.retryable || attempt === retries) break
      const delay = fe.status === 429 ? 2000 * (attempt + 1) : 600 * (attempt + 1)
      await new Promise((r) => setTimeout(r, delay))
      attempt++
    }
  }
  throw lastErr
}

export interface Quote {
  c: number   // current price
  d: number   // change
  dp: number  // percent change
  h: number   // high
  l: number   // low
  o: number   // open
  pc: number  // previous close
  t: number   // timestamp
}

export interface SearchResult {
  description: string
  displaySymbol: string
  symbol: string
  type: string
}

export interface Profile {
  name: string
  ticker: string
  exchange: string
  finnhubIndustry: string
  logo: string
  weburl: string
}

export interface NewsArticle {
  category: string
  datetime: number
  headline: string
  id: number
  image: string
  related: string
  source: string
  summary: string
  url: string
}

export const POPULAR_SYMBOLS: Array<{ symbol: string; name: string }> = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'GOOGL', name: 'Alphabet' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'META', name: 'Meta' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'NFLX', name: 'Netflix' },
]

export async function fetchQuote(symbol: string): Promise<Quote> {
  return getWithRetry<Quote>('/quote', { params: { symbol, token: API_KEY } })
}

export async function searchSymbols(query: string): Promise<SearchResult[]> {
  const data = await getWithRetry<{ count: number; result: SearchResult[] }>('/search', {
    params: { q: query, token: API_KEY },
  })
  return data.result ?? []
}

export async function fetchProfile(symbol: string): Promise<Profile> {
  return getWithRetry<Profile>('/stock/profile2', { params: { symbol, token: API_KEY } })
}

export async function fetchMarketNews(category = 'general'): Promise<NewsArticle[]> {
  return getWithRetry<NewsArticle[]>('/news', { params: { category, token: API_KEY } })
}
