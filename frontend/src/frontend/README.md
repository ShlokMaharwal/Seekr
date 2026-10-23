# Seekr UI modules

- `config.ts` reads `VITE_API_BASE_URL` and `VITE_USE_MOCK`. Normal operation uses
  the backend; the optional mock mode contains illustrative fixture data.
- `api.ts` owns REST types, query definitions, and admin-token storage. Tokens use
  localStorage with an in-memory fallback when storage is blocked.
- `search-box.tsx` handles debounced autocomplete, keyboard selection, and safe
  React text highlighting.
- `dashboard.tsx` shows crawl controls, events, and metrics. The admin route gates
  its queries behind a token form so failed authentication can be corrected.
- `shell.tsx` supplies navigation and the saved light/dark preference.

Routes live in `../routes`; shared algorithms and backend code live in the root
`packages/` and `apps/` directories. See the root README for local startup and ports.
