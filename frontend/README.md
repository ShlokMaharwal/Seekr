# Seekr frontend

Feature UI and the REST client live in this folder. The app uses React, TypeScript, Tailwind CSS v4, and the project's TanStack Start router.

- `config.ts`: Reads `VITE_API_BASE_URL` (default `http://localhost:4000`) and `VITE_USE_MOCK` (default `false`). Copy `.env.example` to `.env` to use the Docker API at `http://localhost:4001`. Vite reads this file when it starts.
- `api.ts`: All REST requests, typed responses, mock data, and query definitions.
- `shell.tsx`: Navigation, footer, and light/black theme switching. The selected theme is stored locally; no user or search data is persisted.
- `search-box.tsx`: Debounced autocomplete, keyboard selection, and query highlighting.
- `dashboard.tsx`: Crawler controls, live feed, and metrics charts.

URL routing lives in `src/routes`. Set `VITE_USE_MOCK=true` only for the isolated UI demo: its statistics are illustrative, and the mock crawler resets on refresh. Normal operation uses the backend in `../apps`. Enter the configured admin token in the dashboard for protected requests.
