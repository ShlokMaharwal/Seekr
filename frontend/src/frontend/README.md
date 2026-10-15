# Seekr frontend

Feature UI and the REST client live in this folder. The app uses React, TypeScript, Tailwind CSS v4, and the project's TanStack Start router.

- `config.ts`: Set `API_BASE_URL` (default `http://localhost:4000`) and `USE_MOCK` (default `true`). Set `USE_MOCK` to `false` when the REST backend is available. The backend must allow the frontend origin through CORS and be reachable from the deployed host for initial route loads.
- `api.ts`: All REST requests, typed responses, mock data, and query definitions.
- `shell.tsx`: Navigation, footer, and light/black theme switching. The selected theme is stored locally; no user or search data is persisted.
- `search-box.tsx`: Debounced autocomplete, keyboard selection, and query highlighting.
- `dashboard.tsx`: Crawler controls, live feed, and metrics charts.

URL routing is kept in `src/routes` to preserve the framework's route generation. The mock crawler state is in-memory and resets on refresh. Dashboard statistics and chart values are illustrative demo data; the mock search/document collection is consistent with its result counts. No backend, authentication, or database is included.
