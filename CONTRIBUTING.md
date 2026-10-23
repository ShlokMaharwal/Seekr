# Contributing to Seekr

Thanks for your interest in contributing! Here's how to get started.

## Prerequisites

- **Node.js 22+** and npm
- **Docker** and Docker Compose (for Redis and MongoDB)

## Getting started

```bash
# Clone the repo
git clone https://github.com/ShlokMaharwal/Seekr.git
cd Seekr

# Install dependencies
npm ci

# Start infrastructure (Redis + MongoDB)
docker compose up redis mongo -d

# Build all packages
npm run build

# Run all tests
npm test
```

## Project structure

| Directory       | Description                           |
| --------------- | ------------------------------------- |
| `packages/core` | Pure algorithms (index, ranker, trie) |
| `apps/api`      | Express API server                    |
| `apps/crawler`  | Distributed crawler workers           |
| `frontend`      | React frontend (TanStack Start)       |
| `bench`         | Benchmarks                            |
| `scripts`       | Utility scripts (seed, etc.)          |

## Running tests

```bash
# All workspaces
npm test

# Single workspace
npm test --workspace=packages/core
npm test --workspace=apps/api
npm test --workspace=apps/crawler
```

## Code style

- TypeScript strict mode
- No `any` types
- Conventional commit messages: `feat:`, `fix:`, `test:`, `chore:`, `docs:`, `ci:`

## Making changes

1. Create a branch from `main`
2. Make your changes
3. Run `npm run build && npm test` to verify
4. Open a pull request with a clear description

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
