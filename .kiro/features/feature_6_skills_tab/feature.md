# Feature 6: Skills Tab

## Status: Post-MVP

## Priority: 6

## Description
Tab showing skill/gem popularity and DPS distributions. Which main skills are most popular per class, what support gems pair with them, and DPS histogram.

## Requirements
- Bar chart: Top 20 main skills by usage count
- Bar chart: Top 20 support gems by usage count
- DPS histogram (bucketed)
- Table: skill name | usage count | avg DPS | top 3 supports
- Responds to character filter (class, keystone)

## Acceptance Criteria
- [ ] Skills tab shows skill popularity chart
- [ ] Support gem chart renders
- [ ] DPS histogram with reasonable buckets
- [ ] Filtering by class shows only that class's skills
- [ ] Table is sortable

## Dependencies
- Feature 3 (filter sidebar)
- Feature 2 (needs skillAggregations query)

## Files
- `src/components/SkillsTab.tsx`
- `src/graphql/queries.ts` — skillAggregations query
