# PoE2 Build Explorer

## Problem

The current workflow (transform JSON → CSV → Excel pivot table) is slow, lossy (drops many JSON fields), and requires manual effort every run. We want an interactive web UI that exposes ALL scraped fields with cascading filters — click a class, then a slot, then see breakdowns by rarity, base type, mods, etc.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser (React + TanStack Table + Recharts)    │
│  - Cascading filter sidebar                      │
│  - Sortable/groupable data table                 │
│  - Aggregate charts (bar, pie)                   │
└─────────────────────┬───────────────────────────┘
                      │ GraphQL queries
                      ▼
┌─────────────────────────────────────────────────┐
│  API Server (Node + Apollo Server)              │
│  - GraphQL schema with full character/item model│
│  - Resolvers read from DuckDB                   │
└─────────────────────┬───────────────────────────┘
                      │ SQL
                      ▼
┌─────────────────────────────────────────────────┐
│  DuckDB (in-process, file-backed)               │
│  - Ingests all JSON captures on startup/refresh │
│  - Full schema: characters, items, skills, etc. │
└─────────────────────────────────────────────────┘
```

## Why GraphQL?

- Client requests exactly the fields it needs — no over/under-fetching
- Cascading filters map naturally to nested query arguments
- Aggregation queries (COUNT, GROUP BY) exposed as dedicated query types
- Schema acts as documentation of all available fields
- Flexible enough to add new views without API changes

## Why DuckDB?

- Already a project dependency in the scraper
- Columnar storage is perfect for analytical GROUP BY / COUNT queries
- No external DB server needed — single file
- Reads JSON natively with `read_json_auto`
- Fast enough for ~2000 character JSONs (analytical workload)

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 19, Vite, TypeScript | Fast dev, strong typing |
| UI Components | shadcn/ui (Radix + Tailwind) | Accessible, composable filters/tables |
| Data Table | TanStack Table | Sorting, grouping, virtual scroll |
| Charts | Recharts | Simple bar/pie for aggregates |
| GraphQL Client | urql | Lightweight, good caching |
| API | Apollo Server 4 (standalone) | Mature, good DX, schema-first |
| Database | DuckDB (Node binding) | Analytical queries, JSON ingestion |
| Codegen | graphql-codegen | Type-safe queries end-to-end |

## Data Model (DuckDB Tables)

### `characters`
| Column | Source |
|--------|--------|
| id | SHA of account+name |
| account | `.account` |
| name | `.name` |
| league | `.league` |
| class | `.class` |
| base_class | `.baseClass` |
| level | `.level` |
| life | `.defensiveStats.life` |
| energy_shield | `.defensiveStats.energyShield` |
| mana | `.defensiveStats.mana` |
| spirit | `.defensiveStats.spirit` |
| evasion_rating | `.defensiveStats.evasionRating` |
| armour | `.defensiveStats.armour` |
| fire_res | `.defensiveStats.fireResistance` |
| cold_res | `.defensiveStats.coldResistance` |
| lightning_res | `.defensiveStats.lightningResistance` |
| chaos_res | `.defensiveStats.chaosResistance` |
| effective_hp | `.defensiveStats.effectiveHealthPool` |
| keystones | array of keystone names |
| source_file | file path |

### `items`
| Column | Source |
|--------|--------|
| id | `.itemData.id` |
| character_id | FK to characters |
| slot | `.itemSlot` (numeric) |
| inventory_id | `.itemData.inventoryId` (Boots, Helmet, etc.) |
| name | `.itemData.name` |
| base_type | `.itemData.baseType` |
| type_line | `.itemData.typeLine` |
| rarity | `.itemData.rarity` / frameTypeId |
| ilvl | `.itemData.ilvl` |
| corrupted | `.itemData.corrupted` |
| fractured | `.itemData.fractured` |
| desecrated | `.itemData.desecrated` |
| quality | `.itemData.qualityProperty` |
| explicit_mods | array |
| fractured_mods | array |
| crafted_mods | array |
| enchant_mods | array |
| desecrated_mods | array |
| rune_mods | array |
| implicit_mods | array |
| mods_structured | JSON (the `.mods` object with id + stats) |
| sockets | array of socket types |
| requirements | JSON |
| properties | JSON |

### `skills`
| Column | Source |
|--------|--------|
| character_id | FK |
| skill_name | `.skills[].allGems[0].name` (main gem) |
| support_gems | array of support gem names |
| dps | `.skills[].dps[].dps` |
| level | gem level |
| quality | gem quality |

### `flasks`
| Column | Source |
|--------|--------|
| character_id | FK |
| base_type | `.flasks[].itemData.baseType` |
| rarity | `.flasks[].itemData.rarity` |
| explicit_mods | array |

## UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│  PoE2 Build Explorer                              [Refresh]  │
├────────────┬─────────────────────────────────────────────────┤
│  FILTERS   │  MAIN CONTENT                                   │
│            │                                                  │
│  Class     │  ┌─── Summary Bar ───────────────────────────┐  │
│  [x] All   │  │ 1,847 characters | 27,705 items          │  │
│  [ ] Monk  │  └──────────────────────────────────────────-┘  │
│  [ ] Sorc  │                                                  │
│  ...       │  ┌─── Tab: Items | Skills | Defenses ────────┐  │
│            │  │                                            │  │
│  Slot      │  │  [Bar Chart: Top 15 Base Types]           │  │
│  [x] All   │  │                                            │  │
│  [ ] Helm  │  │  ┌─ Data Table ────────────────────────┐  │  │
│  [ ] Boots │  │  │ Base Type  | Count | % | Avg ilvl  │  │  │
│  ...       │  │  │ Hubris Ci..| 342   |18%| 83        │  │  │
│            │  │  │ ...        |       |   |           │  │  │
│  Rarity    │  │  └────────────────────────────────────-┘  │  │
│  [x] All   │  │                                            │  │
│  [ ] Unique │  │  [Pie Chart: Rarity Distribution]         │  │
│  [ ] Rare  │  │                                            │  │
│            │  └────────────────────────────────────────────┘  │
│  Keystone  │                                                  │
│  [ ] CI    │                                                  │
│  [ ] ...   │                                                  │
│            │                                                  │
│  Corrupted │                                                  │
│  [x] Any   │                                                  │
│  [ ] Yes   │                                                  │
│  [ ] No    │                                                  │
└────────────┴─────────────────────────────────────────────────┘
```

### Filter Behavior
- Cascading: selecting "Martial Artist" under Class updates all other filter counts
- Multi-select: can pick multiple classes, slots, etc.
- URL-driven: filter state stored in URL query params (shareable links)
- Instant: debounced GraphQL re-fetch on filter change

### Main Content Tabs
1. **Items** — base type distribution, mod frequency, rarity breakdown
2. **Skills** — main skill popularity, support gem combos, DPS distribution
3. **Defenses** — life/ES/evasion/armour distributions, resistance coverage

### Drill-down
- Click a bar in the chart → filters to that value
- Click a row in the table → expands to show individual items with full mod lists

## GraphQL Schema (Highlights)

```graphql
type Query {
  characters(filter: CharacterFilter): [Character!]!
  itemAggregations(filter: ItemFilter): ItemAggregation!
  skillAggregations(filter: SkillFilter): SkillAggregation!
  filterOptions(filter: CharacterFilter): FilterOptions!
}

input CharacterFilter {
  classes: [String!]
  keystones: [String!]
  minLevel: Int
}

input ItemFilter {
  characterFilter: CharacterFilter
  slots: [String!]
  rarities: [String!]
  corrupted: Boolean
  baseTypes: [String!]
}

type ItemAggregation {
  totalCount: Int!
  byBaseType: [CountEntry!]!
  byRarity: [CountEntry!]!
  byMod: [CountEntry!]!
  avgIlvl: Float!
}

type CountEntry {
  name: String!
  count: Int!
  percentage: Float!
}

type FilterOptions {
  classes: [CountEntry!]!
  slots: [CountEntry!]!
  rarities: [CountEntry!]!
  keystones: [CountEntry!]!
}
```

## Ingestion Pipeline

On server start (or manual refresh):
1. Scan `../scraper/data/poe.ninja/` for the latest timestamped folder
2. Read all JSON files from its `captures/` subdirectory
3. Parse each JSON, normalize into DuckDB tables
4. Build indexes on class, inventory_id, rarity, base_type

Can also accept a `--data <path>` flag to point at a specific captures folder.

## Project Structure

```
explorer/
├── .kiro/
│   └── project.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── DESIGN.md              ← this file
├── server/
│   ├── index.ts           ← Apollo Server entry
│   ├── schema.ts          ← GraphQL type defs
│   ├── resolvers.ts       ← Query resolvers
│   ├── db.ts              ← DuckDB setup + ingestion
│   └── ingest.ts          ← JSON → DuckDB loader
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
│   │   └── generated/      ← codegen output
│   └── lib/
│       └── urql.ts
└── codegen.ts
```

## Development Workflow

```bash
# Terminal 1: API server (auto-restarts on change)
npm run dev:server

# Terminal 2: Vite frontend (HMR)
npm run dev

# After schema changes:
npm run codegen
```

## MVP Scope (v0.1)

1. DuckDB ingestion of characters + items
2. GraphQL API with `filterOptions` + `itemAggregations`
3. Filter sidebar (class, slot, rarity)
4. Bar chart of top base types
5. Pie chart of rarity distribution
6. Basic data table with counts

## Future (v0.2+)

- Mod frequency analysis ("what % of helmets have +life?")
- Skill tab with DPS distributions
- Compare two classes side-by-side
- Time-series (track meta shifts across scrape runs)
- Export filtered data to CSV
