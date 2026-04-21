<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePortfolioStore } from '../stores/portfolioStore'
import { FinnhubError } from '../services/finnhub'

const router = useRouter()
const portfolio = usePortfolioStore()
const { holdings, loading, holdingsWithQuotes, totalValue, totalGainLoss, totalGainLossPercent } =
  storeToRefs(portfolio)

const lastRefreshed = ref<Date | null>(null)
const refreshError = ref('')
let timer: number | undefined

async function refresh() {
  try {
    await portfolio.refreshQuotes()
    lastRefreshed.value = new Date()
    refreshError.value = ''
  } catch (e) {
    const fe = e as FinnhubError
    refreshError.value = fe?.friendly ?? 'Could not refresh prices. Please try again.'
  }
}

onMounted(() => {
  refresh()
  timer = window.setInterval(() => refresh(), 30_000)
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})

function confirmRemove(symbol: string) {
  if (confirm(`Remove ${symbol} from your portfolio?`)) {
    portfolio.removeHolding(symbol)
  }
}

function fmtMoney(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function fmtPercent(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function gainColor(n: number) {
  if (n > 0) return 'success'
  if (n < 0) return 'error'
  return 'grey'
}

const totalCostValue = computed(() => totalValue.value - totalGainLoss.value)
</script>

<template>
  <div class="page-pad">
    <div class="d-flex align-center mb-4 flex-wrap ga-2">
      <h1 class="text-h4">My Portfolio</h1>
      <v-spacer />
      <v-btn
        color="primary"
        prepend-icon="mdi-magnify"
        variant="tonal"
        @click="router.push('/search')"
      >
        Find stocks
      </v-btn>
      <v-btn
        :loading="loading"
        prepend-icon="mdi-refresh"
        variant="flat"
        color="primary"
        @click="refresh"
      >
        Refresh
      </v-btn>
    </div>

    <v-alert
      v-if="refreshError"
      type="error"
      variant="tonal"
      class="mb-4"
      density="compact"
      closable
      @click:close="refreshError = ''"
    >
      <div class="d-flex align-center ga-2 flex-wrap">
        <span class="flex-grow-1">{{ refreshError }}</span>
        <v-btn
          size="small"
          variant="tonal"
          color="error"
          prepend-icon="mdi-refresh"
          @click="refresh"
        >
          Try again
        </v-btn>
      </div>
    </v-alert>

    <!-- Summary cards -->
    <v-row v-if="holdings.length > 0" class="mb-2">
      <v-col cols="12" sm="4">
        <v-card variant="tonal" color="primary">
          <v-card-item>
            <div class="text-overline">Total value</div>
            <div class="text-h5 font-weight-bold">{{ fmtMoney(totalValue) }}</div>
            <div class="text-caption">Cost basis: {{ fmtMoney(totalCostValue) }}</div>
          </v-card-item>
        </v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card variant="tonal" :color="gainColor(totalGainLoss)">
          <v-card-item>
            <div class="text-overline">Total gain / loss</div>
            <div class="text-h5 font-weight-bold">
              {{ totalGainLoss >= 0 ? '+' : '' }}{{ fmtMoney(totalGainLoss) }}
            </div>
            <div class="text-caption">{{ fmtPercent(totalGainLossPercent) }}</div>
          </v-card-item>
        </v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card variant="tonal">
          <v-card-item>
            <div class="text-overline">Holdings</div>
            <div class="text-h5 font-weight-bold">{{ holdings.length }}</div>
            <div class="text-caption">
              Last refreshed: {{ lastRefreshed ? lastRefreshed.toLocaleTimeString() : '—' }}
            </div>
          </v-card-item>
        </v-card>
      </v-col>
    </v-row>

    <!-- Empty state -->
    <v-card v-if="holdings.length === 0" class="pa-8 text-center" variant="outlined">
      <v-icon icon="mdi-briefcase-outline" size="64" class="mb-2 text-medium-emphasis" />
      <h2 class="text-h5 mb-2">Your portfolio is empty</h2>
      <p class="text-medium-emphasis mb-4">
        Search for a stock and add it to start tracking your holdings.
      </p>
      <v-btn color="primary" prepend-icon="mdi-magnify" @click="router.push('/search')">
        Search stocks
      </v-btn>
    </v-card>

    <!-- Holdings list -->
    <v-row v-else>
      <v-col
        v-for="h in holdingsWithQuotes"
        :key="h.symbol"
        cols="12"
        md="6"
        lg="4"
      >
        <v-card class="h-100">
          <v-card-item>
            <template #prepend>
              <v-avatar color="primary" size="40">
                <span class="text-subtitle-2 font-weight-bold">
                  {{ h.symbol.slice(0, 2) }}
                </span>
              </v-avatar>
            </template>
            <v-card-title>{{ h.symbol }}</v-card-title>
            <v-card-subtitle class="text-truncate">{{ h.name }}</v-card-subtitle>
            <template #append>
              <v-btn
                icon="mdi-delete-outline"
                variant="text"
                size="small"
                @click="confirmRemove(h.symbol)"
              />
            </template>
          </v-card-item>

          <v-divider />

          <v-card-text>
            <div class="d-flex justify-space-between mb-1">
              <span class="text-medium-emphasis">Price</span>
              <span class="font-weight-medium">{{ fmtMoney(h.currentPrice) }}</span>
            </div>
            <div class="d-flex justify-space-between mb-1">
              <span class="text-medium-emphasis">Today</span>
              <span :class="`text-${gainColor(h.change)}`">
                {{ h.change >= 0 ? '+' : '' }}{{ h.change.toFixed(2) }}
                ({{ fmtPercent(h.changePercent) }})
              </span>
            </div>
            <v-divider class="my-2" />
            <div class="d-flex justify-space-between mb-1">
              <span class="text-medium-emphasis">Shares</span>
              <span>{{ h.shares }}</span>
            </div>
            <div class="d-flex justify-space-between mb-1">
              <span class="text-medium-emphasis">Buy price</span>
              <span>{{ fmtMoney(h.buyPrice) }}</span>
            </div>
            <div class="d-flex justify-space-between mb-1">
              <span class="text-medium-emphasis">Market value</span>
              <span class="font-weight-medium">{{ fmtMoney(h.totalValue) }}</span>
            </div>
            <v-divider class="my-2" />
            <div class="d-flex justify-space-between">
              <span class="text-medium-emphasis">Gain / loss</span>
              <v-chip
                :color="gainColor(h.gainLoss)"
                size="small"
                variant="tonal"
                label
              >
                {{ h.gainLoss >= 0 ? '+' : '' }}{{ fmtMoney(h.gainLoss) }} ({{ fmtPercent(h.gainLossPercent) }})
              </v-chip>
            </div>
            <div class="text-caption text-medium-emphasis mt-2 text-right">
              Updated {{ h.lastUpdated }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.page-pad {
  padding: 24px;
}
</style>
