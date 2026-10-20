# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**PoE2 Metrics** (package name `poe2-build-explorer`) — a read-only analytics explorer for Path of
Exile 2 character builds. Scraped character JSON is ingested into DuckDB, served through an Apollo
GraphQL API, and rendered by a React frontend as cascading filters, charts, and tables.
Live at https://poe2metrics.mduh.dev.

Further reading (don't duplicate it here — read it when relevant):

- `README.md` — user-facing overview of features and GraphQL queries
- `DESIGN.md` — full architecture and UI design
- `.kiro/project.md` — high-level tech stack, data flow, key design decisions
- `.kiro/features/` — per-feature specs (see "Feature workflow" below)
- `.kiro/memory.md` — personal working notes (gitignored; may be out of date, verify against code)

## Stack

- TypeScript (strict, ES2022, ESM — server imports use `.js` extensions, e.g. `./schema.js`)
- Frontend: React 19, Vite 6, Tailwind 3, TanStack Table, Recharts, urql
- Backend: Apollo Server 4 via `expressMiddleware` on Express 5 with `compression` (port 4000)
- Database: DuckDB, in-process, file-backed at `explorer_v2.duckdb` in the repo root
- Formatting: Prettier — **tabs, tabWidth 4**. Run `npm run format` on touched files.

## Layout

```
server/
  index.ts      Express + Apollo entry point (port 4000)
  schema.ts     GraphQL typeDefs
  resolvers.ts  Resolvers — DuckDB SQL aggregations
  db.ts         DuckDB connection + table setup (path: explorer_v2.duckdb)
  ingestv2.ts   Current ingestion: 8 worker threads parse, main thread batch-inserts
  ingest.ts     Legacy v1 ingestion
  deploy.ts     Frontend deploy (build → S3 sync → CloudFront invalidation)
src/
  App.tsx, main.tsx
  components/   FilterSidebar, ItemsTab, CraftingAdvisor
  graphql/queries.ts  Hand-written queries
  lib/urql.ts
aws-infra/      EC2 provisioning, systemd unit, custom-domain script, instance notes
*.ps1           Local run / tunnel / AWS start-stop / EC2 deploy scripts (Windows PowerShell 5.1)
```

## Commands

```powershell
.\run.ps1                 # backend (4000) + frontend (5173) together
npm run dev:server        # backend only, watch mode
npm run dev               # Vite dev server; proxies /graphql → :4000 and /api/trade2 → pathofexile.com
npm run build             # tsc -b && vite build — use this as the typecheck
npm run format            # prettier
npm run ingest:v2         # re-ingest from ../scraper/data/poe.ninja/<latest>/ (DELETES and rebuilds the DB)
```

There is no test suite. Verify changes with `npm run build` and, for UI/API changes, by running
the app. `npm run codegen` exists but there is no codegen config and nothing imports generated
types — queries in `src/graphql/queries.ts` are hand-typed.

## Data & ingestion

- Source data lives in a sibling project: `../scraper/data/poe.ninja/`. This repo never scrapes.
- Ingestion is a full replace. If the DB schema in `db.ts`/`ingestv2.ts` changes, the DB must be
  re-ingested.
- `*.duckdb`, `*.bak`, `*.wal` are gitignored and large (~150MB). Don't read them as text.
- A stale `explorer_v2.duckdb.wal` next to the DB makes DuckDB fail on startup
  (`Connection was never established`). Stop the server and delete the `.wal`.

## Invariants

- **No PII.** The API returns only aggregated counts/percentages. Never expose character names,
  account names, or individual item rows through the schema or UI.
- Filters are **cascading**: every query takes the filter input and counts reflect the other
  active filters. Keystone multi-select is AND; Base Type is non-self-filtering.
- **Redact AWS identifiers in committed files.** Real instance / SG / subnet / distribution IDs,
  account numbers, and ARNs live only in the gitignored `deploy.config.json` and
  `.kiro/memory.md`. Committed docs and scripts use placeholders like `i-xxxxxxxxxxxxxxxxx`.
- Never read, print, or commit `*.pem` files (the SSH key lives under `.kiro/`, gitignored).

## Deployment (outward-facing — confirm with the user before running)

- `npm run deploy:frontend` — build, upload to S3, invalidate CloudFront
- `npm run deploy:backend` / `deploy:db` / `deploy:all` — `deploy-ec2.ps1` SCPs to EC2 and restarts
  the `poe2-explorer` systemd service
- `npm run aws:start` / `aws:stop` — start/stop EC2; start also rewrites the CloudFront origin
- `aws-infra/add-custom-domain.ps1` — idempotent, supports `-DryRun`

## Shell: Windows PowerShell 5.1 (Desktop edition, not pwsh 7)

Applies to the `*.ps1` scripts and to commands run in the PowerShell tool.

- No `&&` / `||`: use `A; if ($?) { B }`. No ternary `?:`, `??`, or `?.`.
- No Unix tools (`head`, `tail`, `grep`, `which`, `touch`, `rm -rf`, `mkdir -p`): use `Select-Object -First/-Last`, `Get-Command`, `Remove-Item -Recurse -Force`, `New-Item -ItemType Directory -Force`.
- No inline env vars (`VAR=x cmd`): use `$env:VAR = 'x'; cmd`.
- Don't redirect native stderr (`2>&1`): 5.1 wraps lines as errors and sets `$?` false even on exit 0.
- `Set-Content`/`Add-Content` default to ANSI; pass `-Encoding utf8`. Note 5.1's utf8 writes a BOM, which can break JSON/shebang consumers. For BOM-free output use `[IO.File]::WriteAllText(path, text)`. (This bit `aws-start.ps1`: the AWS CLI rejected a BOM-prefixed CloudFront config.)
- `ConvertFrom-Json` returns PSCustomObject (no `-AsHashtable`); `ConvertTo-Json` defaults to `-Depth 2`, so pass `-Depth 10` or nested data gets truncated.
- Use `npm.cmd`/`npx.cmd` if script execution policy blocks `npm.ps1`.
- Quote paths with spaces; call exes with `& "path\to.exe"`. Use single-quoted here-strings `@'...'@` (closing `'@` at column 0) for multiline literals.
- Use `--%` to stop PowerShell from parsing args like `--format=%H`.

## Feature workflow

Feature specs live in **`.kiro/features/`** — keep using that folder; don't create a parallel one.

- `.kiro/features/README.md` is the index: number, name, dependencies, status. Update it when a
  feature's status changes.
- Each feature is `.kiro/features/feature_<N>_<snake_name>/feature.md`, with a `## Status:` line
  near the top, a description, rules/requirements, and (once built) an "As Built" section noting
  where reality diverged from the original plan.
- New features take the next number. Write the spec before implementing non-trivial work, and
  update its status / "As Built" notes when done.

## Project memory

**`.kiro/memory.md` is the source of truth for project state** — current status, live
infrastructure (real AWS IDs), how-to-run notes, known issues, and next steps. Keep using it:

- Read it at the start of work that touches deployment, data, or feature status.
- Update it after significant progress or decisions (e.g. a feature finished, infra changed,
  a new gotcha found). Use absolute dates (`2026-10-17`), not "yesterday".
- It is gitignored, so real resource IDs belong there and not in committed files.
- Don't put project state in Claude Code's own per-user memory; reserve that for personal
  preferences about how to work. Durable, shareable conventions go in this file instead.
