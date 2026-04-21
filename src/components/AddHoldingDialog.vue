<script setup lang="ts">
import { ref, watch } from 'vue'
import { usePortfolioStore } from '../stores/portfolioStore'
import { fetchQuote } from '../services/finnhub'

const props = defineProps<{
  modelValue: boolean
  symbol: string
  name: string
  suggestedPrice?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'added'): void
}>()

const portfolio = usePortfolioStore()

const shares = ref<number | null>(null)
const buyPrice = ref<number | null>(null)
const error = ref('')
const saving = ref(false)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      shares.value = null
      buyPrice.value = props.suggestedPrice ?? null
      error.value = ''
    }
  }
)

function close() {
  emit('update:modelValue', false)
}

async function save() {
  error.value = ''
  if (!shares.value || shares.value <= 0) {
    error.value = 'Shares must be greater than 0'
    return
  }
  if (!buyPrice.value || buyPrice.value <= 0) {
    error.value = 'Buy price must be greater than 0'
    return
  }

  saving.value = true
  try {
    portfolio.addHolding({
      symbol: props.symbol,
      name: props.name || props.symbol,
      shares: shares.value,
      buyPrice: buyPrice.value,
    })

    try {
      const q = await fetchQuote(props.symbol)
      portfolio.quotes[props.symbol] = q
    } catch {
      // ignore quote fetch error - holding still added
    }

    emit('added')
    close()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" max-width="460">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon icon="mdi-plus-circle" class="mr-2" />
        Add {{ symbol }} to Portfolio
      </v-card-title>

      <v-card-subtitle v-if="name">{{ name }}</v-card-subtitle>

      <v-card-text>
        <v-text-field
          v-model.number="shares"
          label="Number of shares"
          type="number"
          min="0"
          step="0.0001"
          prepend-inner-icon="mdi-counter"
          variant="outlined"
          autofocus
        />
        <v-text-field
          v-model.number="buyPrice"
          label="Buy price (per share)"
          type="number"
          min="0"
          step="0.01"
          prepend-inner-icon="mdi-currency-usd"
          variant="outlined"
          :hint="suggestedPrice ? `Current market price: $${suggestedPrice.toFixed(2)}` : undefined"
          persistent-hint
        />
        <v-alert v-if="error" type="error" density="compact" class="mt-3">
          {{ error }}
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :loading="saving" @click="save">
          Add holding
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
