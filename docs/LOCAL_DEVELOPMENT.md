# Local development

Use Node.js 22 and npm. Install the backend with `npm ci`; install the separate
frontend with `npm ci --prefix frontend`. Build before starting native services:
`npm run build`.

Copy `.env.example` to `.env` and choose an admin token. Docker Compose reads this
file automatically. Native Node processes do not load it automatically; export
the variables in your shell before running the development commands.

For Docker, run `docker compose up --build -d`. The API is exposed at
`http://localhost:4001`. Copy `frontend/.env.example` to `frontend/.env` and run
`npm run dev:frontend`; Vite reads that frontend environment file.

For native development, start Redis and MongoDB, run `npm run dev:api` and
`npm run dev:crawler`, and set `VITE_API_BASE_URL=http://localhost:4000` in
`frontend/.env`. Then run `npm run dev:frontend`.

Run backend checks with `npm run build` and `npm test`. Frontend checks are
separate: `npm run build --prefix frontend` and `npm test --prefix frontend`.
