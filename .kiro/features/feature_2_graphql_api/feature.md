# Feature 2: GraphQL API Server

## Status: MVP ✅

## Priority: 2

## Description
Apollo Server 4 with a GraphQL schema that exposes all character/item data via queries. Resolvers translate GraphQL filter inputs into DuckDB SQL and return aggregated results.

## Requirements
- Standalone Apollo Server on port 4000
- Schema with queries: filterOptions, itemAggregations, items, skillAggregations, defenseDistribution
- Resolvers execute parameterized DuckDB queries
- Filter inputs compose into WHERE clauses
- Return aggregated counts (GROUP BY) and raw item lists (paginated)
- CORS enabled for local Vite dev server

## Key Queries
1. `filterOptions(filter)` — returns available values + counts for sidebar (cascading)
2. `itemAggregations(filter)` — GROUP BY base_type, rarity, mod; AVG ilvl
3. `items(filter, limit, offset)` — paginated raw item list
4. `skillAggregations(filter)` — skill popularity, support gem frequency
5. `defenseDistribution(filter)` — histograms of life/ES/armour/evasion

## Acceptance Criteria
- [ ] Server starts and serves GraphQL playground at localhost:4000
- [ ] `filterOptions` returns correct counts per class/slot/rarity
- [ ] Filters cascade: filtering by class reduces counts in other dimensions
- [ ] `itemAggregations` returns top base types with counts
- [ ] `items` returns paginated results with full mod arrays
- [ ] Handles empty filters (returns all data)

## Dependencies
- Feature 1 (data must be ingested first)

## Files
- `server/index.ts` — Server entry
- `server/schema.ts` — Type definitions
- `server/resolvers.ts` — Query resolvers with DuckDB SQL
