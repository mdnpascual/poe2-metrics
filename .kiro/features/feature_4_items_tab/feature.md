# Feature 4: Items Tab (Charts + Data Table)

## Status: MVP ✅

## Priority: 4

## Description
Main content area showing item aggregations as charts and a data table. Responds to filter sidebar selections. Shows top base types, rarity distribution, and a sortable table of aggregated data.

## Requirements
- Bar chart: Top 15 base types by count (Recharts)
- Pie chart: Rarity distribution (Unique/Rare/Magic)
- Data table (TanStack Table): base type | count | % | avg ilvl | corrupted %
- Clicking a bar in the chart adds that value as a filter
- Table is sortable by any column
- Shows "No data" state when filters match nothing

## Acceptance Criteria
- [ ] Bar chart renders top base types with correct counts
- [ ] Pie chart shows rarity split
- [ ] Table rows match chart data
- [ ] Clicking a chart bar updates the filter (e.g., adds baseType filter)
- [ ] Table sorts correctly on column header click
- [ ] Responds to sidebar filter changes

## Dependencies
- Feature 3 (needs filter sidebar for context)
- Feature 2 (needs itemAggregations query)

## Files
- `src/components/ItemsTab.tsx` — Main tab component
- `src/components/AggregateChart.tsx` — Reusable bar/pie chart
- `src/components/DataTable.tsx` — TanStack Table wrapper
- `src/graphql/queries.ts` — itemAggregations query
