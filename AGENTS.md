# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router entrypoints, pages, layouts, server actions, and API routes under `app/api/**`.
- `components/`: Feature UI and shared primitives. Base reusable UI lives in `components/ui/`.
- `lib/`: Core logic (AI integration, auth/session, logging, DB access). Database schema and migrations are in `lib/db/` and `lib/db/migrations/`.
- `hooks/`: Shared React hooks.
- `public/`: Static assets (icons, preview images).
- Root config: `next.config.ts`, `biome.json`, `drizzle.config.ts`, `tsconfig.json`.

## Build, Test, and Development Commands
Use Bun for local workflows:
- `bun install`: Install dependencies.
- `bun dev`: Start local dev server at `http://localhost:3000`.
- `bun run build`: Production build.
- `bun run start`: Run production server.
- `bun run check`: Run Biome formatter + linter + assists.
- `bun run lint`: Apply Biome lint fixes.
- `bun run format`: Apply Biome formatting.
- `bun run type-check`: TypeScript strict type check (`tsc --noEmit`).
- `bun run db:generate | db:migrate | db:push | db:studio`: Drizzle schema/migration workflows.

## Coding Style & Naming Conventions
- Language: TypeScript + React (Next.js App Router).
- Formatting/linting: Biome (`biome.json`) is the source of truth.
- Indentation: tabs; strings: double quotes.
- Path alias: use `@/*` imports from project root.
- Naming patterns:
  - React components/files: `kebab-case` files, PascalCase exports.
  - Hooks: `use-*.ts(x)`.
  - Route handlers: `route.ts` in App Router segments.

## Testing Guidelines
- There is currently no dedicated unit/integration test framework configured in this repo.
- Required pre-PR quality gate: run `bun run check` and `bun run type-check`.
- For DB changes, include updated migration files in `lib/db/migrations/` and verify flows manually in `bun dev`.

## Commit & Pull Request Guidelines
- Follow Conventional Commit style seen in history: `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`.
- Keep commits focused and atomic (one logical change per commit).
- PRs should include:
  - concise description of user-visible impact,
  - linked issue/task,
  - screenshots or short recordings for UI changes,
  - notes for env/config/migration updates.

## Security & Configuration Tips
- Copy `.env.example` to `.env` and never commit secrets.
- Required secrets include AI provider keys, sandbox credentials, and crypto/auth keys.
- Treat API routes under `app/api/**` as external surfaces: validate inputs and avoid leaking internal errors.
