# Feature 11: Open in Trade (Crafting Advisor)

## Status: Done

## Description
Add an "Open in Trade" button to the Crafting Advisor that builds a PoE 2 trade URL from the user's selected affixes and opens it in the browser. The button becomes clickable when at least 2 affixes are selected. Rarity filter is automatically applied based on the number of selected affixes, and base type is included when exactly 1 is selected.

## Rules

### Rarity Logic
- 2 selected affixes → filter to **Magic** items only
- 3+ selected affixes → filter to **Rare** items only
- If the sidebar rarity filter (`filters.rarities`) has any values toggled, use that instead of the rule-based logic above

### Base Type Logic
- If exactly 1 base type is selected in `selectedBaseTypes` → include it as the `type` field in the query
- If 0 or 2+ base types are selected → omit the type filter

### Affix Stats
- Map each selected normalized mod to a stat filter entry: `{type: 'and', filters: [{id: <modId>, value: {min: 1}}]}`
- The mod ID mapping may need a lookup (e.g. `explicit.stat_xxxx`) or can use the text-based search format that pathofexile.com/trade2 supports

### Other Sidebar Filters
- Respect `filters.slots` if set (map to equipment type filter category)
- No account or price filters (this is a general search, not a specific item lookup)

## Trade URL Format
Based on the arevtur project's `buildItemTradeUrl`:
```
https://www.pathofexile.com/trade2/search/poe2/{league}?q={encodedQuery}
```

Where `query` is:
```json
{
  "query": {
    "type": "Kamasan Tiara",
    "filters": {
      "type_filters": {
        "filters": {
          "rarity": { "option": "magic" }
        }
      }
    },
    "stats": [
      {
        "type": "and",
        "filters": [
          { "id": "explicit.stat_xxx", "value": { "min": 1 } }
        ]
      }
    ]
  }
}
```

## UI Concept
```
┌──────────────────────────────────────────────────┐
│  Selected Affixes (3)                            │
│  [+# to maximum Life            ] [×]           │
│  [#% increased Energy Shield    ] [×]           │
│  [+#% to Cold Resistance        ] [×]           │
│                                                  │
│  [ 🔗 Open in Trade ]   ← enabled (3 affixes)  │
│    "Searching: Rare only"                        │
└──────────────────────────────────────────────────┘
```

- Button disabled + greyed out when <2 affixes selected
- Tooltip or subtext shows current rarity logic: "Magic (2 mods)" or "Rare (3+ mods)" or "Rarity: from filter"
- Clicking opens URL in a new browser tab (`window.open`)

## Acceptance Criteria
- [ ] Button appears in Crafting Advisor below the selected affixes section
- [ ] Button is disabled when fewer than 2 affixes are selected
- [ ] With 2 affixes selected: rarity = magic
- [ ] With 3+ affixes selected: rarity = rare
- [ ] If sidebar `rarities` filter is active, use that instead of the count-based rule
- [ ] If exactly 1 base type selected, include it as the `type` filter
- [ ] If 0 or 2+ base types, omit `type` filter
- [ ] Opens pathofexile.com/trade2/search/poe2/{league} in a new tab with the query
- [ ] League value is configurable (currently `runesofaldur` or from env/config)

## Dependencies
- Feature 9 (Crafting Advisor) — builds on existing component

## Files
- `src/components/CraftingAdvisor.tsx` — add button + URL building logic

## Notes
- The main challenge is mapping normalized mod text (e.g. `+# to maximum Life`) to trade stat IDs (e.g. `explicit.stat_3299347043`). Options:
  - **Option A**: Use the trade site's text search endpoint to resolve IDs at click time
  - **Option B**: Maintain a local mapping of common normalized mods → stat IDs
  - **Option C**: Use the `term` field in the filter which accepts freetext (trade site supports this)
- Start with Option C if the trade site supports text-based stat filters; fall back to A or B if needed
- The league string should match what pathofexile.com/trade2 expects (check URL format)
