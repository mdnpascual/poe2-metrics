# PoE2 Build Explorer

## Overview
An interactive web UI for exploring Path of Exile 2 build data collected from character profiles. Provides cascading filters, aggregate charts, and drill-down tables across all character equipment, skills, and defensive stats.

## Tech Stack
- **Language:** TypeScript (strict, ES2022, ESM)
- **Frontend:** React 19, Vite, Tailwind CSS, shadcn/ui
- **Data Table:** TanStack Table
- **Charts:** Recharts
- **GraphQL Client:** urql
- **API:** Apollo Server 4 (standalone HTTP)
- **Database:** DuckDB (in-process, file-backed)
- **Codegen:** graphql-codegen (end-to-end type safety)
- **Formatting:** Prettier (tabs, tabWidth 4)

## Project Structure
```
explorer/
├── .kiro/project.md
├── DESIGN.md              - Full architecture & UI design doc
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── server/
│   ├── index.ts           - Apollo Server entry point
│   ├── schema.ts          - GraphQL type definitions
│   ├── resolvers.ts       - Query resolvers (DuckDB SQL)
│   ├── db.ts              - DuckDB connection + table setup
│   └── ingest.ts          - JSON capture → DuckDB ingestion
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── FilterSidebar.tsx
│   │   ├── ItemsTab.tsx
│   │   ├── SkillsTab.tsx
│   │   ├── DefensesTab.tsx
│   │   ├── AggregateChart.tsx
│   │   └── DataTable.tsx
│   ├── graphql/
│   │   ├── queries.ts
│   │   └── generated/
│   └── lib/
│       └── urql.ts
└── codegen.ts
```

## Data Flow
1. Server starts → reads JSON from `../scraper/data/poe.ninja/<latest>/captures/`
2. Ingests into DuckDB tables: characters, items, skills, flasks
3. Frontend sends GraphQL queries with filter params
4. Server resolves via DuckDB SQL (GROUP BY, COUNT, etc.)
5. Frontend renders charts + tables with results

## Key Design Decisions
- GraphQL for flexible filtering without multiple REST endpoints
- DuckDB for columnar analytics (fast GROUP BY on 2000+ characters)
- Cascading filters: selecting a class updates available options in other filters
- URL-driven state: filter selections encoded in query params for sharing
- All JSON fields preserved (no lossy CSV transformation)

## NPM Scripts
- `npm run dev` — Vite frontend dev server (HMR)
- `npm run dev:server` — API server with watch mode
- `npm run build` — Production build (frontend + server)
- `npm run codegen` — Regenerate GraphQL types
- `npm run ingest` — Manual data re-ingestion
- `npm run format` — Prettier

## Data Source
Reads collected JSON from a sibling project at `../scraper/data/poe.ninja/`. Each JSON file is one character profile containing: items (with full mod data), skills (with DPS), defensive stats, keystones, flask setup, and passive selections.

## Relationship to Data Collection
This project is a consumer of externally collected data. It does not collect anything itself. The data collection runs independently and deposits JSON into `data/`. This project reads that JSON on startup.

## Context Memory
Use `.kiro/memory.md` to persist important decisions, current state, known issues, and next steps across sessions. Update it after significant progress or decisions.
