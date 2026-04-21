<script setup lang="ts">
import { ref } from 'vue'
import { useDisplay } from 'vuetify'
import { hasApiKey } from './services/finnhub'
import logoUrl from './assets/favicon.png'

const drawer = ref(false)
const { smAndDown } = useDisplay()
const isCompact = smAndDown

const navItems = [
  { title: 'Portfolio', icon: 'mdi-briefcase', route: '/portfolio' },
  { title: 'Search', icon: 'mdi-magnify', route: '/search' },
]
</script>

<template>
  <v-app>
    <v-app-bar elevation="2" color="primary" density="comfortable">
      <v-app-bar-nav-icon v-if="isCompact" @click="drawer = !drawer" />
      <v-app-bar-title>
        <router-link to="/" class="brand d-inline-flex align-center">
          <v-avatar size="36" color="transparent" class="mr-2 brand-avatar">
            <v-img :src="logoUrl" alt="Stockajay logo" width="100%" height="100%" />
          </v-avatar>
          <span>Stockajay</span>
        </router-link>
      </v-app-bar-title>

      <template v-if="!isCompact">
        <v-btn
          v-for="item in navItems"
          :key="item.route"
          :to="item.route"
          :prepend-icon="item.icon"
          variant="text"
          class="text-none mx-1"
        >
          {{ item.title }}
        </v-btn>
      </template>
    </v-app-bar>

    <v-navigation-drawer v-if="isCompact" v-model="drawer" temporary>
      <v-list nav>
        <v-list-item
          v-for="item in navItems"
          :key="item.route"
          :to="item.route"
          :prepend-icon="item.icon"
          :title="item.title"
          @click="drawer = false"
        />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-container fluid class="pa-0">
        <v-alert
          v-if="!hasApiKey"
          type="warning"
          variant="tonal"
          class="ma-4"
          density="compact"
          icon="mdi-key-alert"
        >
          No Finnhub API key detected. Copy <code>.env.example</code> to
          <code>.env</code>, add your key from
          <a href="https://finnhub.io" target="_blank" rel="noopener">finnhub.io</a>,
          and restart the dev server.
        </v-alert>

        <router-view />
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
.brand {
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}
.brand:hover {
  opacity: 0.9;
}
.brand-avatar :deep(.v-img),
.brand-avatar :deep(.v-img__img) {
  width: 100% !important;
  height: 100% !important;
  object-fit: contain;
}
</style>
