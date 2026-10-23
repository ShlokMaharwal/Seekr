# Local development

Use Node.js 22 and npm. Install the backend with `npm ci`; install the separate
frontend with `npm ci --prefix frontend`. Build before starting native services:
`npm run build`.

Copy `.env.example` to `.env` and choose an admin token. Docker Compose reads this
file automatically. The root native development and seed scripts also load it;
individual workspace scripts require exported variables if used directly.

For Docker, run `docker compose up --build -d`. The API is exposed at
`http://localhost:4001`. Copy `frontend/.env.example` to `frontend/.env` and run
`npm run dev:frontend`; Vite reads that frontend environment file.

For native development, start Redis and MongoDB, run `npm run dev:api` and
`npm run dev:crawler`, and set `VITE_API_BASE_URL=http://localhost:4000` in
`frontend/.env`. Then run `npm run dev:frontend`.

Use `npm run seed` with Docker or `npm run seed -- --local` with the native API.
The CLI sends `ADMIN_TOKEN`, defaults to port 4001, and accepts `--max-pages`,
`--workers`, `--delay-ms`, `--url`, and `--watch`. `npm run clean -- --dry-run`
previews the bounded generated-output cleanup.

Run backend checks with `npm run build` and `npm test`. Frontend checks are
separate: `npm run build --prefix frontend` and `npm test --prefix frontend`.
