# Review Page — Below-Standard Detail + Jump-to-Skill — Design Spec

**Date:** 2026-07-07
**Status:** Approved, ready for implementation plan
**Scope:** Enhance the assessment **Review** screen so each below-standard rating
is shown in full (name, category, complete official ACA standard, rating, note),
with a link that reopens the **Rate** screen positioned on that exact skill.

## Goal

On the review page today, below-standard skills are listed as a cramped
one-liner per item:

```
Bracing (Rescues) — Below: needs more commitment on the high brace
```

Make each below-standard rating a readable block showing the **complete official
standard** (the same reference text shown while rating) plus the assessor's note,
and add a **"Go to skill →"** link that jumps back to the Rate screen at that
skill so the assessor can re-rate or fix the note.

## Context (current state)

- `paddlerSummary(session, paddlerId)` (`src/lib/summary.js`) already computes
  `flagged` — the below-standard, feedback-required **core** skills — as items
  `{ skillId, name, category, rating, ratingLabel, feedback }`. It does **not**
  currently include the skill's full `standard` text.
- `src/screens/Review.jsx` renders `flagged` as `<ul class="review-below-list">`
  one-liners inside each paddler's card.
- Navigation is **screen-state based** (no URL router). `app.jsx` holds
  `screen` ∈ {setup, rate, review}; `Review` gets `onBack` (→ rate), `Rate` gets
  `onDone` (→ review). Switching screens unmounts/remounts the other.
- `Rate` (`src/screens/Rate.jsx`) tracks the current page with `const [i] =
  useState(0)`. Its page space is:
  `pages = intro ? [{intro:true}, ...visibleSkills] : visibleSkills`, where
  `visibleSkills = session.skills.filter(s => paddlers.some(p => p.target ===
  s.level))`. So `i` indexes `pages`, and the intro (when present) occupies
  index 0. Rate already supports jumping to any page via its Skills overlay
  (`setI(idx)`); it simply always **starts** at 0 on entry.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| What to show per below-standard item | **Full skill detail**: name · category · rating label, the complete official `standard` text, and the note |
| Jump-to-skill link | **In scope** this iteration — opens Rate positioned on that skill |
| Which set | Only below-standard (feedback-required) core skills — the existing `flagged` set. DNO/unrated excluded |
| Layout | Always-expanded (below-standard is the exception; lists stay short). No collapse toggle |
| Builds | Both public and private — no gating |
| Exports (PDF/CSV) | Unchanged this iteration |

## Architecture

Small, well-bounded change: one data field added to the summary, one new
presentational component, a shared pure helper for Rate's page indexing, and
screen-state wiring for the jump.

### 1. `src/lib/summary.js` — add `standard` to flagged items

Extend the local `item()` builder to include the skill's standard text:

```js
const item = (r, s) => ({
  skillId: r.skillId, name: skillLabel(s), category: s.category,
  standard: s.standard, rating: r.rating,
  ratingLabel: (scale.find(o => o.value === r.rating) || {}).label || '',
  feedback: r.feedback,
});
```

`s.standard` is already on the skill object (`skills.js` `loadConfig` keeps
`standard`). One line; `optionalItems` gains the field too, harmlessly. Keeps
Review a thin view.

### 2. `src/lib/rate-pages.js` (new) — shared, pure paging

Extract Rate's page construction so both Rate and the jump lookup use one source
of truth (DRY) and it becomes unit-testable:

```js
// The ordered pages of the Rate screen: an optional intro page (index 0) then
// the skills applicable to this session's paddlers, in skills order.
export function ratePages(session) {
  const visibleSkills = session.skills.filter(
    s => session.paddlers.some(p => p.target === s.level));
  const intro = session.intro && Array.isArray(session.intro.sections)
    && session.intro.sections.length ? session.intro : null;
  return intro ? [{ intro: true }, ...visibleSkills] : visibleSkills;
}

// Index of a skill in the Rate page space, or 0 (the first page) if not found.
export function indexOfSkill(session, skillId) {
  const i = ratePages(session).findIndex(p => !p.intro && p.id === skillId);
  return i >= 0 ? i : 0;
}
```

`Rate` replaces its inline `visibleSkills`/`pages` construction with
`ratePages(session)` (behavior-preserving).

### 3. `src/components/BelowStandardDetail.jsx` (new) — presentational block

Props: `items` (the `flagged` array) and `onEditSkill(skillId)`. For each item
renders a block: a header line `name · category · ratingLabel`, the full
`standard` (omitted if empty), the `feedback` note, and a **"Go to skill →"**
button calling `onEditSkill(item.skillId)`. Renders nothing for an empty list.
Keeps Review from growing and is independently testable.

### 4. `src/screens/Review.jsx` — use the component

Replace the `<ul class="review-below-list">` block with
`<BelowStandardDetail items={summary.flagged} onEditSkill={onEditSkill} />`,
where `onEditSkill` is a new prop threaded from `app.jsx`.

### 5. `src/app.jsx` — jump wiring

- Add `const [focusSkillId, setFocusSkillId] = useState(null)`.
- `Review` gets `onEditSkill={(id) => { setFocusSkillId(id); setScreen('rate'); }}`.
- Keep the existing `onBack={() => { setFocusSkillId(null); setScreen('rate'); }}`
  so plain "◀ Back to rating" still starts at the first page.
- `Rate` gets `focusSkillId={focusSkillId}`.

### 6. `src/screens/Rate.jsx` — open at the focused skill

Initialize the page index from `focusSkillId` via a lazy initializer (Rate
remounts on each entry, so this runs once per entry):

```js
export function Rate({ session, onChange, onDone, focusSkillId = null }) {
  const [i, setI] = useState(() => indexOfSkill(session, focusSkillId));
  ...
```

Unknown/optional/missing `focusSkillId` → `indexOfSkill` returns 0. Existing
Next/Prev/overlay navigation is unchanged.

## Data flow

Review card → `BelowStandardDetail` renders each `flagged` item with its full
standard + note → "Go to skill" → `onEditSkill(skillId)` → `app` sets
`focusSkillId` and `screen='rate'` → `Rate` mounts, `indexOfSkill` opens that
skill → assessor re-rates / edits the note → returns via existing `onDone` or the
Skills-overlay "Review →".

## Error handling / edge cases

- Skill with empty `standard` → render header + note, omit the standard line.
- `focusSkillId` not in the page space (optional skill, stale id, null) → Rate
  opens at index 0 (first page).
- Empty `flagged` → `BelowStandardDetail` renders nothing (matches today).
- Group of up to 5 paddlers → blocks stack within each card; below-standard is
  the exception, so lists are typically short. No pagination/collapse (YAGNI).

## Testing

- **Unit — `summary.js`:** a below-standard core result yields a `flagged` item
  whose `standard` equals the skill's standard text.
- **Unit — `rate-pages.js`:** `ratePages` includes the intro at index 0 when
  present and only paddler-applicable skills; `indexOfSkill` returns the correct
  page index for a present skill, and 0 for a missing/null id and for the intro.
- **Unit — `BelowStandardDetail`:** renders one block per item with the standard
  text and note, a "Go to skill" control per item, and nothing for `[]`.
- **Manual:** with a below-standard rating, the review page shows the full
  standard + note; "Go to skill" lands on that exact skill on the Rate screen;
  "◀ Back to rating" still opens the first page.

## Out of scope (YAGNI)

- Changes to PDF/CSV export.
- Surfacing DNO/unrated or optional-skill detail here.
- Collapse/expand toggles or per-card pagination.
- Any URL/router-based deep linking (the app is screen-state based).
