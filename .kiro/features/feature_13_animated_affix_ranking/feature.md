# Feature 13: Animated Affix Ranking

## Status: Done

## Description
Clicking a bar in the Crafting Advisor co-occurrence chart adds the affix to `selectedMods` and
re-sorts the list. Remaining rows slide to their new rank and their bars tween to the new width.

Recharts can't do this: `Bar` animates by array index (`prevData[index]`), and axis tick labels
don't animate. Implemented as Option A: a custom list with FLIP animation, no new dependencies.

## Acceptance Criteria
- [x] Remaining rows slide to their new rank on select
- [x] Bars tween to the new width
- [x] Removing a selected affix / changing base types also animates
- [x] Tooltip shows `N items (P%)`
- [x] `prefers-reduced-motion: reduce` disables all animation
- [x] No new dependencies, no server/schema changes

## As Built
- `src/components/AnimatedBarList.tsx` replaces the Recharts `BarChart` block in `CraftingAdvisor.tsx`.
- FLIP keyed by affix name, using `offsetTop` (layout-based, relative to the list container) so
  scroll and in-flight transforms don't skew the delta.
- Axis: fixed 0-100% with 0/25/50/75/100 labels, matching the old chart.
- First mount: no animation (rows and bars render at final state).
- New rows fade in; removed rows disappear instantly (no fade-out).
- No row cap: 100 rows animated without visible jank in testing.
- Gotcha: an inline callback ref is called with `null` on every render, so `prevTops` must not
  be pruned in the ref callback (it is rebuilt in the layout effect instead).
- Matches the old Recharts look: 1px vertical axis line between label and bars, a short 5px tick
  to the left of it pointing at each label, 32px bars in 40px rows (tighter padding).
- Labels wrap to two lines (`line-clamp-2`, 14px line height) instead of truncating; a third
  line would be ellipsized, full text is in the `title`.
- Tooltip follows the mouse: one `position: fixed` popover rendered at list level (not inside
  rows, since a row's transform would become its containing block), cleared on click.
- Prettier was run on `CraftingAdvisor.tsx` and reformatted unrelated lines in that file.
