# Stockajay — CIS 658 Hackathon

*(Stockajay — a blend of **stock**, **track**, and **Jay**; pronounced like "strategy".)*

A live stock portfolio web app built with the Vue family (Vue 3, Vue Router, Pinia) and Vuetify 4. Users land on a hero home page with live popular-ticker cards and market news, can search any real stock, view live quotes and company info, and add holdings with shares + buy price to a personal portfolio that auto-refreshes every 30 seconds.

## Live demo

Deployed to GitHub Pages via the `gh-pages` branch. The URL is in the repo's GitHub Pages settings and the Blackboard submission.

## Run locally

```bash
cp .env.example .env
# then edit .env and paste your Finnhub API key (https://finnhub.io)

npm install
npm run dev
```

Open <http://localhost:5173>.

## Deploy

```bash
npm run build
npm run deploy
```

`build` uses `--base=./` so hashed assets resolve from the GitHub Pages sub-path, and `deploy` pushes `dist/` to the `gh-pages` branch via the `gh-pages` npm package.

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Vue 3 + `<script setup>` + TypeScript |
| Routing | Vue Router with `createWebHashHistory()` (works on GitHub Pages with no server config) |
| State | Pinia (Composition API stores) with `localStorage` persistence for holdings |
| UI | Vuetify 4 (dark theme) + MDI icons + responsive nav drawer |
| HTTP | Axios with response interceptor + exponential-backoff retry |
| Data source | [Finnhub](https://finnhub.io) — `/search`, `/quote`, `/stock/profile2`, `/news` |
| Build | Vite 5 |
| Deploy | `gh-pages` → GitHub Pages |

## Project structure

```
src/
  main.ts                        Vue + Pinia + Router + Vuetify wiring
  App.vue                        v-app shell, app bar, responsive nav drawer, missing-key banner
  router/index.ts                hash-history routes (/, /portfolio, /search)
  services/finnhub.ts            typed Axios wrappers, FinnhubError, retry-with-backoff
  stores/portfolioStore.ts       Pinia store: holdings, quotes, computed gain/loss, localStorage
  views/HomeView.vue             hero + popular stocks grid + market news column
  views/PortfolioView.vue        portfolio dashboard with 30s auto-refresh
  views/SearchView.vue           stock search + live quote + add-to-portfolio
  components/AddHoldingDialog.vue   shares + buy-price dialog
  assets/                        hero.jpg, favicon.png
```

---

## Development note

### AI tools used

- **Cursor** with Claude (Anthropic) as the primary coding assistant.
- Used for: Vite/Vue scaffolding, Pinia store design, Vuetify 4 component wiring, Finnhub API integration, error-handling architecture, responsive layout, and writing this README.
- Used Gemini to generate the logo for the app

### Stock data service

- **[Finnhub](https://finnhub.io)** free tier.
- Endpoints used:
  - `GET /search?q=...` — symbol / company search
  - `GET /quote?symbol=...` — real-time quote (current price, $ change, % change, open, previous close, day high/low, timestamp)
  - `GET /stock/profile2?symbol=...` — company name, exchange, industry, logo
  - `GET /news?category=general` — market news headlines for the Home page
- API key is loaded from `VITE_FINNHUB_KEY` (see `.env.example`). If the key is missing at startup, the app shows a persistent inline warning banner with setup instructions.

### Features — working

- **Home page** with a full-bleed hero (tagline + CTAs), a live "Popular stocks" grid (AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA, NFLX) that auto-refreshes every 60s, and a market-news column. Ticker cards deep-link into Search with the symbol pre-filled.
- **Search** with debounced Finnhub lookup, a result list, and a detail panel showing live quote (price, $ change, % change, open, prev close, day high/low, last updated) plus company profile (name, exchange, industry, logo).
- **Add to portfolio** dialog for shares + buy price, defaulted to the current market price.
- **Portfolio dashboard**:
  - Per-holding card with current price, today's change, shares, buy price, market value, unrealized gain/loss ($ and %), and last-updated timestamp.
  - Summary cards: total value, total gain/loss + %, holding count, last refresh time.
  - Auto-refresh every 30s plus a manual refresh button.
  - Remove holding with confirmation.
- **Persistence**: holdings survive page reloads via `localStorage` (Pinia `$subscribe`).
- **Live data on every view** from the external Finnhub API.
- **Routing**: Vue Router with `createWebHashHistory()` for direct-URL access on GitHub Pages.
- **Responsive UI**: inline nav links on desktop, hamburger + `v-navigation-drawer` on tablet/phone.
- **Error UX**: a custom `FinnhubError` with friendly messages (auth, rate-limit, network, 4xx/5xx), an Axios response interceptor, automatic exponential-backoff retry for retryable errors, and inline `v-alert`s with a "Try again" button on every view (Home, Search, Portfolio) so errors are actionable instead of disappearing.

### Features — incomplete / future work

- No historical price chart (Finnhub's candle endpoint is on a paid tier for recent data).
- No authentication — portfolio is stored per-browser in `localStorage`.
- All values assumed USD; no multi-currency.
- News column depends on Finnhub's general feed; no category filter or sentiment tagging.

### Vue-family usage

- **Vue 3** — Composition API with `<script setup lang="ts">` across every component.
- **Vue Router** — 3 routes (`/`, `/portfolio`, `/search`), hash history, deep-link query params (`/search?q=AAPL`).
- **Pinia** — `portfolioStore` with state (`holdings`, `quotes`), getters (`totalValue`, `totalGainLoss`, `holdingsWithQuotes`), actions (`addHolding`, `removeHolding`, `refreshQuotes`), and `$subscribe` for `localStorage` persistence.
- **Vuetify 4** — layout grid, `v-app-bar`, `v-navigation-drawer`, `v-card`, `v-dialog`, `v-alert`, `v-snackbar`-less inline errors, `useDisplay()` breakpoints.

### Deployment limitations & API notes

- The Finnhub API key is a **public browser key**. Embedding a key in any client-only SPA is inherently exposed; the real mitigations are an origin-restricted key or a server-side proxy. For a hackathon prototype this trade-off is acceptable.
- The actual key is **not committed** — `.env` is gitignored. Graders should copy `.env.example` to `.env` and paste their own Finnhub key.
- Finnhub free tier has a rate limit of ~60 requests/minute. The app batches quote requests in parallel on each refresh cycle (30s for portfolio, 60s for popular tickers on Home), which stays well under the cap for a typical <20-holding portfolio.
- Finnhub's `/news` endpoint occasionally returns 403 on free-tier keys depending on region; when that happens the Home page surfaces an inline error with a Try-again button and the rest of the app continues to work.
- GitHub Pages is static, so no server-side proxy is set up. Routing uses `createWebHashHistory()` to avoid 404s on direct-URL access.
