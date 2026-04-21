<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  fetchQuote,
  fetchMarketNews,
  POPULAR_SYMBOLS,
  FinnhubError,
  type Quote,
  type NewsArticle,
} from '../services/finnhub'
import heroUrl from '../assets/hero.jpg'

type TickerRow = { symbol: string; name: string; quote: Quote | null }

const tickers = ref<TickerRow[]>(
  POPULAR_SYMBOLS.map((s) => ({ ...s, quote: null }))
)
const loadingTickers = ref(false)
const tickerError = ref('')
const news = ref<NewsArticle[]>([])
const loadingNews = ref(false)
const newsError = ref('')
const lastRefreshed = ref<Date | null>(null)

let tickerTimer: number | undefined

async function loadTickers() {
  loadingTickers.value = true
  try {
    const results = await Promise.allSettled(
      tickers.value.map((t) => fetchQuote(t.symbol))
    )
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') tickers.value[i].quote = r.value
    })
    lastRefreshed.value = new Date()

    const firstFailure = results.find((r) => r.status === 'rejected') as
      | PromiseRejectedResult
      | undefined
    if (firstFailure && !tickers.value.some((t) => t.quote)) {
      const fe = firstFailure.reason as FinnhubError
      tickerError.value = fe?.friendly ?? 'Could not load live prices.'
    } else {
      tickerError.value = ''
    }
  } finally {
    loadingTickers.value = false
  }
}

async function loadNews() {
  loadingNews.value = true
  try {
    const items = await fetchMarketNews('general')
    news.value = items.slice(0, 8)
    newsError.value = ''
  } catch (e) {
    const fe = e as FinnhubError
    newsError.value = fe?.friendly ?? 'Could not load market news.'
  } finally {
    loadingNews.value = false
  }
}

onMounted(() => {
  loadTickers()
  loadNews()
  tickerTimer = window.setInterval(() => loadTickers(), 60_000)
})

onBeforeUnmount(() => {
  if (tickerTimer) window.clearInterval(tickerTimer)
})

function fmtMoney(n: number | undefined) {
  if (n === undefined || n === null) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function fmtPercent(n: number | undefined) {
  if (n === undefined || n === null) return '—'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function gainColor(n: number | undefined) {
  if (!n) return 'grey'
  if (n > 0) return 'success'
  if (n < 0) return 'error'
  return 'grey'
}

function timeAgo(ts: number) {
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="hero">
      <div class="hero-image" :style="{ backgroundImage: `url(${heroUrl})` }" />
      <div class="hero-overlay">
        <div class="hero-content">
          <v-chip variant="flat" color="primary" class="mb-3" size="small">
            <v-icon start icon="mdi-chart-line" />
            Live market data
          </v-chip>
          <h1 class="hero-title">Stockajay</h1>
          <p class="hero-tagline">
            Real-time quotes, a portfolio that thinks in gain &amp; loss, and the
            headlines to make sense of it all — in one place.
          </p>
          <div class="hero-cta">
            <v-btn color="primary" size="large" to="/search" prepend-icon="mdi-magnify">
              Find a stock
            </v-btn>
            <v-btn
              color="white"
              variant="outlined"
              size="large"
              to="/portfolio"
              prepend-icon="mdi-briefcase"
            >
              My portfolio
            </v-btn>
          </div>
        </div>
      </div>
    </section>

    <!-- Two-column main grid -->
    <div class="page-pad">
    <v-row>
      <!-- Popular stocks -->
      <v-col cols="12" md="7">
        <div class="d-flex align-center mb-3 ga-2 flex-wrap">
          <h2 class="text-h5 font-weight-bold">Popular stocks</h2>
          <v-chip v-if="lastRefreshed" size="x-small" variant="tonal" class="ml-2">
            Updated {{ lastRefreshed.toLocaleTimeString() }}
          </v-chip>
          <v-spacer />
          <v-btn
            :loading="loadingTickers"
            prepend-icon="mdi-refresh"
            size="small"
            variant="text"
            @click="loadTickers"
          >
            Refresh
          </v-btn>
        </div>

        <v-alert
          v-if="tickerError"
          type="error"
          variant="tonal"
          class="mb-3"
          density="compact"
          closable
          @click:close="tickerError = ''"
        >
          <div class="d-flex align-center ga-2 flex-wrap">
            <span class="flex-grow-1">{{ tickerError }}</span>
            <v-btn
              size="small"
              variant="tonal"
              color="error"
              prepend-icon="mdi-refresh"
              @click="loadTickers"
            >
              Try again
            </v-btn>
          </div>
        </v-alert>

        <v-row dense>
          <v-col
            v-for="t in tickers"
            :key="t.symbol"
            cols="6"
            md="6"
            lg="4"
            xl="3"
          >
            <v-card
              :to="{ path: '/search', query: { q: t.symbol } }"
              :color="gainColor(t.quote?.d)"
              variant="tonal"
              class="ticker-card h-100"
              hover
            >
              <v-card-item>
                <div class="d-flex justify-space-between align-center mb-1">
                  <div class="text-subtitle-1 font-weight-bold">{{ t.symbol }}</div>
                  <v-icon
                    v-if="t.quote"
                    :icon="t.quote.d >= 0 ? 'mdi-trending-up' : 'mdi-trending-down'"
                    size="small"
                  />
                </div>
                <div class="text-caption text-medium-emphasis mb-2 text-truncate">
                  {{ t.name }}
                </div>
                <div v-if="t.quote" class="text-h6 font-weight-bold">
                  {{ fmtMoney(t.quote.c) }}
                </div>
                <div v-else class="text-h6 font-weight-bold text-medium-emphasis">
                  <v-progress-circular v-if="loadingTickers" indeterminate size="18" width="2" />
                  <span v-else>—</span>
                </div>
                <div v-if="t.quote" class="text-caption font-weight-medium mt-1">
                  {{ t.quote.d >= 0 ? '+' : '' }}{{ t.quote.d.toFixed(2) }}
                  ({{ fmtPercent(t.quote.dp) }})
                </div>
              </v-card-item>
            </v-card>
          </v-col>
        </v-row>
      </v-col>

      <!-- News -->
      <v-col cols="12" md="5">
        <div class="d-flex align-center mb-3 ga-2">
          <h2 class="text-h5 font-weight-bold">Market news</h2>
          <v-spacer />
          <v-btn
            :loading="loadingNews"
            prepend-icon="mdi-refresh"
            size="small"
            variant="text"
            @click="loadNews"
          >
            Refresh
          </v-btn>
        </div>

        <v-alert
          v-if="newsError"
          type="error"
          variant="tonal"
          class="mb-3"
          density="compact"
          closable
          @click:close="newsError = ''"
        >
          <div class="d-flex align-center ga-2 flex-wrap">
            <span class="flex-grow-1">{{ newsError }}</span>
            <v-btn
              size="small"
              variant="tonal"
              color="error"
              prepend-icon="mdi-refresh"
              @click="loadNews"
            >
              Try again
            </v-btn>
          </div>
        </v-alert>

        <div v-if="loadingNews && news.length === 0" class="text-center pa-8">
          <v-progress-circular indeterminate color="primary" />
        </div>

        <v-row dense>
          <v-col
            v-for="article in news"
            :key="article.id"
            cols="12"
          >
            <v-card
              :href="article.url"
              target="_blank"
              rel="noopener"
              variant="outlined"
              hover
              class="h-100 news-card"
            >
              <div class="d-flex">
                <v-img
                  v-if="article.image"
                  :src="article.image"
                  width="120"
                  height="120"
                  cover
                  class="flex-shrink-0"
                />
                <div class="pa-3 flex-grow-1 d-flex flex-column">
                  <div class="text-caption text-medium-emphasis mb-1">
                    {{ article.source }} · {{ timeAgo(article.datetime) }}
                  </div>
                  <div class="text-subtitle-2 font-weight-bold mb-1 news-headline">
                    {{ article.headline }}
                  </div>
                  <div class="text-caption text-medium-emphasis news-summary">
                    {{ article.summary }}
                  </div>
                </div>
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
    </div>
  </div>
</template>

<style scoped>
.hero {
  position: relative;
  min-height: 400px;
  overflow: hidden;
  isolation: isolate;
}

.page-pad {
  padding: 24px;
}

.hero-image {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  z-index: 0;
  background-attachment: fixed;
}

.hero-overlay {
  position: relative;
  z-index: 1;
  min-height: 400px;
  padding: 3rem 2rem;
  display: flex;
  align-items: center;
  background: linear-gradient(
    110deg,
    rgba(10, 20, 40, 0.85) 0%,
    rgba(10, 20, 40, 0.65) 45%,
    rgba(10, 20, 40, 0.25) 100%
  );
}

.hero-content {
  max-width: 620px;
  color: white;
}

.hero-title {
  font-size: clamp(2.25rem, 5vw, 3.5rem);
  line-height: 1.1;
  margin: 0 0 0.75rem 0;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.hero-tagline {
  font-size: clamp(1rem, 1.5vw, 1.15rem);
  line-height: 1.55;
  margin: 0 0 1.75rem 0;
  color: rgba(255, 255, 255, 0.88);
}

.hero-cta {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.ticker-card {
  transition: transform 0.15s ease;
  text-decoration: none;
}
.ticker-card:hover {
  transform: translateY(-2px);
}

.news-card {
  text-decoration: none;
}
.news-headline {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
}
.news-summary {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}
</style>
