# Feature 5: Item Drill-Down View

## Status: Post-MVP

## Priority: 5

## Description
Clicking a row in the items aggregate table expands to show individual items matching that criteria — full mod lists, rune mods, socket info. Paginated list of actual items.

## Requirements
- Expandable row or modal showing individual items for a given base type + filters
- Each item card shows: name, base type, rarity, ilvl, all mod categories
- Paginated (20 per page)
- Mod text formatted with color coding (explicit=blue, fractured=gold, crafted=purple)
- Link to original poe.ninja profile if possible

## Acceptance Criteria
- [ ] Clicking a table row shows individual items
- [ ] Items display all mod types with visual distinction
- [ ] Pagination works
- [ ] Back/close returns to aggregate view

## Dependencies
- Feature 4 (items tab provides the aggregate table to drill into)
- Feature 2 (needs `items` query with pagination)

## Files
- `src/components/ItemDrillDown.tsx`
- `src/components/ItemCard.tsx`
