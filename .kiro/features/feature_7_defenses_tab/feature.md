# Feature 7: Defenses Tab

## Status: Post-MVP

## Priority: 7

## Description
Tab showing defensive stat distributions across characters. Histograms of life, ES, armour, evasion. Average resistances. Helps answer "what's a typical life pool for Martial Artist?"

## Requirements
- Histograms: life, energy shield, armour, evasion (bucketed, Recharts)
- Summary cards: avg life, avg ES, avg effective HP
- Resistance bar chart (avg fire/cold/lightning/chaos per class)
- Responds to character filter

## Acceptance Criteria
- [ ] Life histogram renders with reasonable buckets
- [ ] ES histogram renders
- [ ] Averages displayed as summary numbers
- [ ] Filtering by class shows only that class's distributions

## Dependencies
- Feature 3 (filter sidebar)
- Feature 2 (needs defenseDistribution query)

## Files
- `src/components/DefensesTab.tsx`
- `src/graphql/queries.ts` — defenseDistribution query
