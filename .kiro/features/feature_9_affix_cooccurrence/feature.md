# Feature 9: Affix Co-occurrence / Crafting Advisor

## Status: Done

## Description
Given a base type and one or more selected affixes, show the most likely other affixes that appear alongside them in the dataset. Answers: "If I have a Kamasan Tiara with +# to maximum Life, what other mods do top players pair with it?"

This helps players make crafting decisions by showing real-world mod pairings from top builds.

## UI Concept
A new tab or page with:
1. **Input filters**: Select a base type + one or more affixes (normalized)
2. **Results**: Ranked list of co-occurring affixes (normalized), sorted by frequency
3. **Interpretation**: "Of the 45 Kamasan Tiaras with +# to maximum Life, 38 (84%) also have #% increased Energy Shield"

## Workflow
1. User selects a base type from dropdown (or clicks from the existing base types chart)
2. User picks one or more affixes from the mod list (normalized mods, could reuse the mod frequency data)
3. System finds all items matching that base type + those affixes
4. System returns all OTHER affixes on those items, ranked by frequency
5. Each result shows: mod name (normalized), count, percentage of matching items

## GraphQL Query (proposed)
```graphql
type Query {
  affinityMods(filter: AffinityFilter): AffinityResult!
}

input AffinityFilter {
  characterFilter: CharacterFilter
  baseType: String!
  selectedMods: [String!]!
  slot: String
}

type AffinityResult {
  matchingItems: Int!
  coOccurringMods: [CountEntry!]!
}
```

## Logic
1. Find all items where `base_type = X`
2. For each selected mod (normalized), filter to items whose (explicit+fractured+crafted+desecrated+enchant) mods contain that pattern
3. From the remaining items, unnest all their mods, normalize, exclude the selected mods themselves
4. Count + rank the remaining mods

## Matching Challenge
The selected mods are normalized (e.g., `+# to maximum Life`) but stored mods have real values (`+85 to maximum Life`). Need to normalize stored mods at query time and compare. Options:
- **Option A**: Pre-compute normalized mods during ingestion (new column `normalized_explicit_mods`)
- **Option B**: Normalize in JS after fetching — unnest all mods for matching items, normalize, then filter

Option B is simpler (no schema change) but slower. With ~87k items it should still be fast enough.

## UI Layout
```
┌──────────────────────────────────────────────────┐
│  Crafting Advisor                                │
├──────────────────────────────────────────────────┤
│                                                  │
│  Base Type: [Kamasan Tiara      ▼]               │
│  Slot:      [Helm               ▼] (optional)   │
│                                                  │
│  Selected Affixes:                               │
│  [+# to maximum Life            ] [×]           │
│  [+# to maximum Energy Shield   ] [×]           │
│  [+ add affix...                 ]               │
│                                                  │
│  ─────────────────────────────────────────────── │
│  Matching items: 12                              │
│                                                  │
│  Most likely paired affixes:                     │
│  ┌────────────────────────────────┬─────┬─────┐ │
│  │ Affix                          │Count│  %  │ │
│  ├────────────────────────────────┼─────┼─────┤ │
│  │ #% increased Energy Shield     │  10 │ 83% │ │
│  │ +#% to Cold Resistance         │   8 │ 67% │ │
│  │ +#% to Lightning Resistance    │   7 │ 58% │ │
│  │ ...                            │     │     │ │
│  └────────────────────────────────┴─────┴─────┘ │
└──────────────────────────────────────────────────┘
```

## Acceptance Criteria
- [ ] Can select a base type and see available mods for it
- [ ] Can select 1+ mods and see co-occurring mods ranked by frequency
- [ ] Results exclude the already-selected mods
- [ ] Percentage is relative to items matching ALL selected criteria
- [ ] Works with existing class/slot filters from the main sidebar

## Dependencies
- Feature 2 (GraphQL API) — needs new resolver
- Feature 1 (Data) — uses existing items table

## Files (proposed)
- `server/schema.ts` — add AffinityFilter + AffinityResult types
- `server/resolvers.ts` — add affinityMods resolver
- `src/components/CraftingAdvisor.tsx` — new tab/page component
- `src/App.tsx` — add tab navigation
