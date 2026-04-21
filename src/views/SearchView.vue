<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  searchSymbols,
  fetchQuote,
  fetchProfile,
  FinnhubError,
  type SearchResult,
  type Quote,
  type Profile,
} from '../services/finnhub'
import AddHoldingDialog from '../components/AddHoldingDialog.vue'

const route = useRoute()

const query = ref('')

onMounted(() => {
  const q = route.query.q
  if (typeof q === 'string' && q.trim()) {
    query.value = q.trim()
  }
})
const results = ref<SearchResult[]>([])
const searching = ref(false)
const searchError = ref('')
const lastSearchTerm = ref('')

const selected = ref<SearchResult | null>(null)
const quote = ref<Quote | null>(null)
const profile = ref<Profile | null>(null)
const loadingQuote = ref(false)
const quoteError = ref('')

const dialogOpen = ref(false)

let debounceTimer: number | undefined

watch(query, (val) => {
  if (debounceTimer) window.clearTimeout(debounceTimer)
  searchError.value = ''
  if (!val || val.trim().length < 1) {
    results.value = []
    return
  }
  debounceTimer = window.setTimeout(() => doSearch(val.trim()), 350)
})

async function doSearch(q: string) {
  searching.value = true
  searchError.value = ''
  lastSearchTerm.value = q
  try {
    const all = await searchSymbols(q)
    results.value = all
      .filter((r) => !r.symbol.includes('.') || r.symbol === r.displaySymbol)
      .slice(0, 20)
  } catch (e) {
    const fe = e as FinnhubError
    searchError.value = fe?.friendly ?? 'Search failed. Please try again.'
    results.value = []
  } finally {
    searching.value = false
  }
}

async function selectStock(r: SearchResult) {
  selected.value = r
  quote.value = null
  profile.value = null
  quoteError.value = ''
  loadingQuote.value = true
  try {
    const [q, p] = await Promise.all([
      fetchQuote(r.symbol),
      fetchProfile(r.symbol).catch(() => null),
    ])
    quote.value = q
    profile.value = p as Profile | null
  } catch (e) {
    const fe = e as FinnhubError
    quoteError.value = fe?.friendly ?? 'Could not load quote.'
  } finally {
    loadingQuote.value = false
  }
}

function retrySelected() {
  if (selected.value) selectStock(selected.value)
}

function retrySearch() {
  if (lastSearchTerm.value) doSearch(lastSearchTerm.value)
}

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

function lastUpdated(t: number | undefined) {
  if (!t) return '—'
  return new Date(t * 1000).toLocaleString()
}
</script>

<template>
  <div class="page-pad">
    <h1 class="text-h4 mb-4">Search stocks</h1>

    <v-text-field
      v-model="query"
      label="Search by symbol or company (e.g. AAPL, Tesla)"
      prepend-inner-icon="mdi-magnify"
      variant="outlined"
      clearable
      :loading="searching"
      hide-details
      class="mb-4"
    />

    <v-alert
      v-if="searchError"
      type="error"
      variant="tonal"
      class="mb-4"
      density="compact"
      closable
      @click:close="searchError = ''"
    >
      <div class="d-flex align-center ga-2 flex-wrap">
        <span class="flex-grow-1">{{ searchError }}</span>
        <v-btn
          size="small"
          variant="tonal"
          color="error"
          prepend-icon="mdi-refresh"
          @click="retrySearch"
        >
          Try again
        </v-btn>
      </div>
    </v-alert>

    <v-row>
      <!-- Results list -->
      <v-col cols="12" md="5">
        <v-card variant="outlined">
          <v-list v-if="results.length > 0" density="comfortable">
            <v-list-item
              v-for="r in results"
              :key="r.symbol"
              :active="selected?.symbol === r.symbol"
              @click="selectStock(r)"
            >
              <template #prepend>
                <v-avatar color="primary" size="36">
                  <span class="text-caption font-weight-bold">
                    {{ r.displaySymbol.slice(0, 2) }}
                  </span>
                </v-avatar>
              </template>
              <v-list-item-title class="font-weight-medium">
                {{ r.displaySymbol }}
              </v-list-item-title>
              <v-list-item-subtitle>{{ r.description }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>

          <div v-else-if="!searching && query" class="pa-6 text-center text-medium-emphasis">
            No results for "{{ query }}"
          </div>

          <div v-else-if="!query" class="pa-6 text-center text-medium-emphasis">
            <v-icon icon="mdi-magnify" size="48" class="mb-2" />
            <div>Start typing to search the global stock database.</div>
          </div>

          <div v-else-if="searching" class="pa-6 text-center">
            <v-progress-circular indeterminate color="primary" />
          </div>
        </v-card>
      </v-col>

      <!-- Detail panel -->
      <v-col cols="12" md="7">
        <v-card v-if="!selected" class="pa-8 text-center" variant="outlined">
          <v-icon icon="mdi-chart-line" size="64" class="mb-2 text-medium-emphasis" />
          <h2 class="text-h6">Select a stock to see its live quote</h2>
        </v-card>

        <v-card v-else>
          <v-card-item>
            <template #prepend>
              <v-avatar
                v-if="profile?.logo"
                :image="profile.logo"
                size="48"
                rounded="sm"
              />
              <v-avatar v-else color="primary" size="48">
                <span class="text-h6 font-weight-bold">
                  {{ selected.displaySymbol.slice(0, 2) }}
                </span>
              </v-avatar>
            </template>
            <v-card-title>
              {{ selected.displaySymbol }}
              <v-chip v-if="profile?.exchange" size="x-small" class="ml-2">
                {{ profile.exchange }}
              </v-chip>
            </v-card-title>
            <v-card-subtitle>
              {{ profile?.name || selected.description }}
              <span v-if="profile?.finnhubIndustry"> · {{ profile.finnhubIndustry }}</span>
            </v-card-subtitle>
          </v-card-item>

          <v-divider />

          <v-card-text>
            <div v-if="loadingQuote" class="text-center pa-4">
              <v-progress-circular indeterminate color="primary" />
            </div>

            <v-alert
              v-else-if="quoteError"
              type="error"
              variant="tonal"
              density="compact"
              closable
              @click:close="quoteError = ''"
            >
              <div class="d-flex align-center ga-2 flex-wrap">
                <span class="flex-grow-1">{{ quoteError }}</span>
                <v-btn
                  size="small"
                  variant="tonal"
                  color="error"
                  prepend-icon="mdi-refresh"
                  @click="retrySelected"
                >
                  Try again
                </v-btn>
              </div>
            </v-alert>

            <div v-else-if="quote">
              <div class="d-flex align-center mb-3 flex-wrap ga-2">
                <div class="text-h3 font-weight-bold">{{ fmtMoney(quote.c) }}</div>
                <v-chip
                  :color="gainColor(quote.d)"
                  variant="tonal"
                  size="large"
                  label
                >
                  {{ quote.d >= 0 ? '+' : '' }}{{ quote.d.toFixed(2) }}
                  ({{ fmtPercent(quote.dp) }})
                </v-chip>
              </div>

              <v-row dense>
                <v-col cols="6" sm="3">
                  <div class="text-caption text-medium-emphasis">Open</div>
                  <div class="font-weight-medium">{{ fmtMoney(quote.o) }}</div>
                </v-col>
                <v-col cols="6" sm="3">
                  <div class="text-caption text-medium-emphasis">Prev close</div>
                  <div class="font-weight-medium">{{ fmtMoney(quote.pc) }}</div>
                </v-col>
                <v-col cols="6" sm="3">
                  <div class="text-caption text-medium-emphasis">Day high</div>
                  <div class="font-weight-medium">{{ fmtMoney(quote.h) }}</div>
                </v-col>
                <v-col cols="6" sm="3">
                  <div class="text-caption text-medium-emphasis">Day low</div>
                  <div class="font-weight-medium">{{ fmtMoney(quote.l) }}</div>
                </v-col>
              </v-row>

              <div class="text-caption text-medium-emphasis mt-3">
                Last updated: {{ lastUpdated(quote.t) }}
              </div>

              <v-divider class="my-4" />

              <v-btn
                color="primary"
                prepend-icon="mdi-plus"
                variant="flat"
                block
                :disabled="!quote.c"
                @click="dialogOpen = true"
              >
                Add to portfolio
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <AddHoldingDialog
      v-if="selected"
      v-model="dialogOpen"
      :symbol="selected.displaySymbol"
      :name="profile?.name || selected.description"
      :suggested-price="quote?.c"
    />
  </div>
</template>

<style scoped>
.page-pad {
  padding: 24px;
}
</style>
