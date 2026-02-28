# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router entrypoints, pages, layouts, server actions, and API routes under `app/api/**`.
- `components/`: Feature UI and shared primitives. Base reusable UI lives in `components/ui/`.
- `lib/`: Core logic (AI, auth/session, logging, DB). Database schema/migrations live in `lib/db/` and `lib/db/migrations/`.
- `hooks/`: Shared React hooks.
- `public/`: Static assets (icons, preview images).

## Build, Test, and Development Commands
Use Bun for local workflows:
- `bun install`: Install dependencies.
- `bun dev`: Start local dev server at `http://localhost:3000`.
- `bun run build`: Production build.
- `bun run start`: Run production server.
- `bun run test`: Run Vitest test suite once (`tests/**/*.test.ts`).
- `bun run test:watch`: Run Vitest in watch mode.
- `bun run check`: Run Biome formatter + linter + assists.
- `bun run lint`: Apply Biome lint fixes.
- `bun run format`: Apply Biome formatting.
- `bun run type-check`: TypeScript type check (`tsc --noEmit`).
- `bun run db:generate | db:migrate | db:push | db:studio`: Drizzle schema/migration workflows.

## Coding Style & Naming Conventions
- Language: TypeScript + React (Next.js App Router).
- Formatting/linting: Biome (`biome.json`) is the source of truth.
- Indentation: tabs; strings: double quotes.
- Path alias: use `@/*` imports from project root.
- Naming: `kebab-case` file names, PascalCase component exports, `use-*.ts(x)` hooks, and `route.ts` for App Router handlers.

## Testing Guidelines
- Framework: Vitest (`vitest.config.ts`) with Node test environment.
- Test location/pattern: `tests/**/*.test.ts` (current coverage focuses on `tests/security/`).
- Local commands: `bun run test` for CI-style runs, `bun run test:watch` while iterating.
- Required pre-PR quality gate: run `bun run test`, `bun run check`, and `bun run type-check`.
- For DB changes, include migration files in `lib/db/migrations/` and verify flows in `bun dev`.

## Commit & Pull Request Guidelines
- Follow Conventional Commit style seen in history: `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`.
- Keep commits focused and atomic (one logical change per commit).
- Husky pre-commit currently runs `bun run test`; keep commits in a passing state.
- PRs should include:
  - concise description of user impact,
  - linked issue/task,
  - screenshots for UI changes,
  - notes for env/config/migration updates.

## Security & Configuration Tips
- Copy `.env.example` to `.env` and never commit secrets.
- Required secrets include AI provider keys, sandbox credentials, and crypto/auth keys.
- Treat API routes under `app/api/**` as external surfaces: validate inputs and avoid leaking internal errors.
