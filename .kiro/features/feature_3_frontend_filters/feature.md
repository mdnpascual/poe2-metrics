# Feature 3: Frontend Scaffold & Filter Sidebar

## Status: MVP ✅

## Priority: 3

## Description
React + Vite + Tailwind frontend with a filter sidebar that fetches available options from the GraphQL API. Selecting filters updates URL query params and triggers data re-fetch.

## Requirements
- Vite + React 19 + Tailwind CSS setup
- urql client configured pointing at localhost:4000/graphql
- FilterSidebar component with multi-select checkboxes for: Class, Slot, Rarity, Keystone
- Each filter group shows item count next to each option
- Filters stored in URL search params (shareable state)
- Selecting a filter triggers `filterOptions` re-fetch to update other group counts
- Summary bar: "X characters | Y items matching"
- Debounced re-fetch (300ms) on filter change

## UI Behavior
- All filters default to "All" (no filter applied)
- Clicking a checkbox adds/removes from the active set
- Counts next to each option reflect current filter state (cascading)
- "Clear all" button resets filters

## Acceptance Criteria
- [ ] `npm run dev` starts Vite on localhost:5173
- [ ] Sidebar renders with class/slot/rarity options from API
- [ ] Checking "Martial Artist" updates slot/rarity counts
- [ ] URL updates with filter state (e.g., `?class=Martial+Artist&slot=Helmet`)
- [ ] Summary bar shows correct totals

## Dependencies
- Feature 2 (needs API to fetch filter options)

## Files
- `src/main.tsx` — App entry
- `src/App.tsx` — Layout with sidebar + content area
- `src/components/FilterSidebar.tsx` — Filter groups
- `src/lib/urql.ts` — urql client setup
- `src/graphql/queries.ts` — filterOptions query
- `vite.config.ts` — Vite config
- `tailwind.config.ts` — Tailwind config
- `index.html` — HTML shell
