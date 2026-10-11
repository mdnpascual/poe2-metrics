# Features Index

## Implementation Order (by dependency)

| # | Feature | MVP? | Depends On | Status |
|---|---------|------|-----------|--------|
| 1 | Data Ingestion Pipeline | ✅ | — | ✅ Done |
| 2 | GraphQL API Server | ✅ | Feature 1 | ✅ Done |
| 3 | Frontend Scaffold & Filter Sidebar | ✅ | Feature 2 | ✅ Done |
| 4 | Items Tab (Charts + Table) | ✅ | Feature 2, 3 | ✅ Done |
| 5 | Item Drill-Down View | ❌ | Feature 4 | ✅ Done (repurposed as mod frequency) |
| 6 | Skills Tab | ❌ | Feature 2, 3 | Skipped |
| 7 | Defenses Tab | ❌ | Feature 2, 3 | Skipped |
| 8 | Mod Frequency Analysis | ❌ | Feature 4 | ✅ Done (merged into Feature 5) |
| 9 | Affix Co-occurrence / Crafting Advisor | ❌ | Feature 2 | ✅ Done |
| 10 | Tier Lookup API | ❌ | Feature 2 | Not started |
| 11 | Open in Trade | ❌ | Feature 9 | ✅ Done |
| 12 | AWS Migration | ❌ | — | In progress (torn down to $0) |

## Dependency Graph

```
Feature 1 (Ingestion)
    └── Feature 2 (GraphQL API)
            ├── Feature 3 (Frontend + Filters)
            │       └── Feature 4 (Items Tab) ← MVP complete here
            │               ├── Feature 5 (Item Drill-Down)
            │               └── Feature 8 (Mod Frequency)
            ├── Feature 6 (Skills Tab)
            └── Feature 7 (Defenses Tab)
```

## MVP Definition
Features 1–4 constitute the MVP. After those are done, you can:
- Ingest scraped data
- Start the API server
- Open the frontend
- Filter by class/slot/rarity
- See charts of top base types and rarity distribution
- Browse aggregate item table
