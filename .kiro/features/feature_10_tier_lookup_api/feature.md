# Feature 10: Item Tier Lookup API

## Status: Not started

## Priority: Next (after Feature 9)

## Description
A GraphQL query that returns the top N desirable affixes per base type, suitable for consumption by an external item scanner program. The scanner fetches the full lookup table once at startup and uses it locally to determine if a scanned item's affixes are "high value" (top 8 most common affixes for that base type among top players).

## Use Case
1. External C# program starts → calls GraphQL once to fetch all tier data
2. Program scans items in-game at ~0.8s intervals
3. For each item, checks its base type + affixes against the cached lookup
4. If the item has at least 1 affix in the top 8 for its base type → alarm

## GraphQL Query (proposed)
```graphql
type Query {
  tierLookup(minCount: Int, topN: Int): [BaseTierEntry!]!
}

type BaseTierEntry {
  baseType: String!
  slot: String!
  topAffixes: [TierAffix!]!
}

type TierAffix {
  name: String!          # normalized mod (e.g., "+# to maximum Life")
  count: Int!
  percentage: Float!     # % of items with this base that have this affix
  rank: Int!             # 1 = most common
}
```

## Behavior
- Returns ALL base types with their top N affixes (normalized)
- `topN` param controls how many affixes per base type (default 8)
- `minCount` filters out base types with fewer than N total items (avoids noise from rare bases)
- Affix sources: explicit + fractured + crafted + desecrated + enchant (same merge logic as mod frequency)
- Deduplication: same normalized mod counts +1 per item max
- Respects existing character filters (class, keystone) if provided

## Client Integration Pattern
```
// Pseudocode for C# scanner
startup:
  response = graphql.query(tierLookup(topN: 8, minCount: 5))
  lookup = Dictionary<baseType, Set<normalizedAffix>>

on_item_scanned(item):
  tier_affixes = lookup[item.baseType]
  item_affixes = normalize(item.mods)
  matches = intersect(item_affixes, tier_affixes)
  if matches.count >= 1:
    play_alarm()
```

## Response Shape (example)
```json
{
  "tierLookup": [
    {
      "baseType": "Kamasan Tiara",
      "slot": "Helm",
      "topAffixes": [
        { "name": "#% increased [EnergyShield|Energy Shield]", "count": 20, "percentage": 66.7, "rank": 1 },
        { "name": "+# to maximum [EnergyShield|Energy Shield]", "count": 18, "percentage": 60, "rank": 2 },
        ...
      ]
    },
    ...
  ]
}
```

## Performance
- Single query returns all base types (~100-200 entries × 8 affixes each)
- Response size: ~50-100KB JSON
- Query time: <200ms (all in-memory DuckDB)
- Client fetches once at startup, no refresh needed (data changes weekly)

## Acceptance Criteria
- [ ] `tierLookup` query returns all base types with top N affixes
- [ ] Affixes are normalized (numbers → #)
- [ ] Deduplication per item per normalized mod
- [ ] `minCount` filters noisy low-sample bases
- [ ] Response is small enough for a single fetch (<200KB)
- [ ] Can be consumed by external programs (C#, Python, etc.)

## Dependencies
- Feature 2 (GraphQL API)
- Feature 1 (Data ingestion with items)

## Files
- `server/schema.ts` — add BaseTierEntry, TierAffix types
- `server/resolvers.ts` — add tierLookup resolver

## Notes
- No PII exposed (only base types + normalized mod text + counts)
- Data only refreshes when `npm run ingest` is run (weekly at most)
- The C# program will need a GraphQL client (e.g., GraphQL.Client NuGet) or can just POST raw JSON to the endpoint
