# Feature 8: Mod Frequency Analysis

## Status: Post-MVP

## Priority: 8

## Description
Analyze which mods appear most frequently on items for a given slot+class combination. Answers "what % of Martial Artist helmets have +life?" Uses the normalized mod class (numbers replaced with #).

## Requirements
- Normalize mods (replace numeric values with #) for grouping
- Bar chart: Top 20 mods by frequency for current filter
- Show percentage of items that have each mod
- Filter by mod type: explicit, fractured, crafted, desecrated
- Search/filter within mod list

## Acceptance Criteria
- [ ] Mod frequency chart renders with normalized mod text
- [ ] Percentages are correct relative to total items in filter
- [ ] Can switch between explicit/fractured/crafted views
- [ ] Text search narrows the mod list

## Dependencies
- Feature 4 (extends items tab)
- Feature 2 (needs byMod aggregation in itemAggregations)

## Files
- `src/components/ModFrequency.tsx`
- Server: additional resolver logic for mod unnesting + grouping
