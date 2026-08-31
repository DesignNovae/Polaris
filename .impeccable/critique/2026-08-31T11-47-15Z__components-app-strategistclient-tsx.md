---
target: updated Strategist
total_score: 18
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
timestamp: 2026-08-31T11-47-15Z
slug: components-app-strategistclient-tsx
---
# Strategist design critique

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Strong retrieval and quota feedback, but failures can be silent and streamed updates lack an accessible live announcement. |
| 2 | Match system / real world | 2 | Academic framing is relevant, but terms such as “admit-median reference,” “KB grounded,” and “Only LLM” are unexplained. |
| 3 | User control and freedom | 2 | New chat and collapsible history exist, but there is no stop-generation action, exact retry, undo, or keyboard rail resizing. |
| 4 | Consistency and standards | 1 | The page shows 41% and 6% probabilities while rendering both a working Strategist and a premium lock rail. |
| 5 | Error prevention | 2 | Empty and repeated sends are guarded, but suggestions submit immediately and persistence can fail silently. |
| 6 | Recognition rather than recall | 2 | Context is visible, but mode explanations are hover-only and selected state is not exposed semantically. |
| 7 | Flexibility and efficiency | 2 | History search, modes, and keyboard send help, but there is no stop action, batch management, or focused expert path. |
| 8 | Aesthetic and minimalist design | 1 | Polished individual surfaces are undermined by five competing columns, overlaps, tiny text, and too many simultaneous controls. |
| 9 | Error recognition and recovery | 2 | Quota and disconnect states exist, but recovery is generic and exact prompt retry is absent. |
| 10 | Help and documentation | 1 | Probability, benchmarks, modes, model depth, and provenance lack contextual explanation. |
| **Total** | | **18/40** | **Poor** |

## Design Specificity Verdict

**Authored in voice, generic in interaction.** The warm editorial palette, serif typography, academic language, profile context, and source-oriented promises feel specific to Polaris. The structure remains a conventional AI chat surrounded by utility rails. Strategy should become tangible through one recommended move, expected impact, evidence, uncertainty, and a commitment mechanism; chat should deepen that decision rather than carry the whole product.

The deterministic detector returned zero findings for `components/app/StrategistClient.tsx`. That result is a false sense of safety: live testing found responsive breakage, inconsistent gating, missing selected-state semantics, missing live-region semantics, and undersized controls that static pattern matching did not detect.

No reliable user-visible overlay was produced. Browser URL security rejected the mutable-script preflight, so the evidence used fresh-tab DOM snapshots, computed bounds, interaction checks, and visual inspection at desktop and mobile widths.

## Overall Impression

The new Strategist has a convincing Polaris voice and a serious grounding model, but the surrounding shell hides that strength. The largest opportunity is to resolve product-truth contradictions and make one next action the dominant experience.

## What’s Working

1. **Distinct Polaris identity.** The warm paper-and-ink system, editorial serif, and long-horizon strategy language feel authored rather than generic.
2. **Strong AI trust scaffolding.** Retrieval state, web-search state, source chips, quota handling, verification warnings, and route explanations show care around grounded output.
3. **Useful zero state.** Personalized metrics, gap comparisons, and task-shaped prompts prevent an empty chat surface.

## Priority Issues

### [P1] The page contradicts its own product truth

The shell reports 41%, Live Context reports 6%, and a functioning Strategist appears beside a “Pro & Elite feature” lock rail. Users cannot tell which probability or entitlement is real.

**Fix:** Establish one probability source and one entitlement model. Either render the working product without the locked rail or gate the surface consistently. Add a timestamp, basis, and uncertainty to the probability.

**Suggested command:** `$impeccable harden`

### [P1] The core workspace breaks at common widths

At 1440×900, fixed rails leave roughly 364px for chat. At 390×844, the Send action clips off-screen and the four-column comparison becomes unreadable.

**Fix:** Make the shell route-aware, collapse secondary rails based on available container width, reserve a minimum chat width, wrap composer actions, and replace the mobile comparison table with stacked cards.

**Suggested command:** `$impeccable adapt`

### [P1] The opening state exposes too many controls

Four modes, three depth presets, five suggestions, capability badges, context, the gap analysis, tools, and history compete with the composer.

**Fix:** Default to automatic routing, place depth/model controls behind an Advanced disclosure, show one recommended prompt plus two alternatives, and move tools/context into drawers.

**Suggested command:** `$impeccable distill`

### [P1] Core interactions are not fully accessible

The textarea has no persistent accessible label, mode and depth buttons do not expose selected state, streaming updates lack a live region, rail resizing is pointer-only, and several touch targets are 21–32px high.

**Fix:** Add labels, `aria-pressed` or radio semantics, `aria-live` chat/status regions, keyboard resizing or a standard collapse control, visible management actions, stronger focus treatment, and 44px touch targets.

**Suggested command:** `$impeccable audit`

### [P2] The opening leads with deficit and false precision

A precise 6% score and deficit-oriented benchmark appear without confidence, data age, sources, or strengths.

**Fix:** Show a calibrated range, explain the main drivers, acknowledge strengths, and pair risk with one high-leverage action and its expected effect.

**Suggested command:** `$impeccable clarify`

## Persona Red Flags

**Alex — power user**

- Cannot stop a long generation or retry the exact failed prompt.
- Rename depends on double-click; edit/delete actions depend on hover.
- Persistent context and upsell rails consume the space needed for reading and writing.

**Jordan — first-timer**

- Sees two conflicting probability values with no explanation.
- Technical labels require prior AI knowledge.
- Too many initial choices obscure the obvious first action.
- Simultaneous working and locked states undermine confidence.

**Sam — accessibility-dependent user**

- Selected mode and reasoning depth are not announced.
- The composer depends on placeholder text rather than a durable label.
- Streamed thinking and completion are visual-only.
- Pointer-only resize and hover-dependent actions block keyboard workflows.
- Mobile clipping makes Send partly unreachable and the benchmark table unreadable.

## Minor Observations

- The initial mobile auto-scroll can hide the greeting and table header.
- “↩ to send” does not explain Shift+Enter for a newline.
- “Every answer cites its sources” overpromises when the opening benchmark itself is uncited.
- Available tools look actionable but are static list items.
- Hover-only mode descriptions do not work on touch.
- Repeated 9–10.5px labels weaken legibility.
- Pulsing indicators do not visibly honor reduced-motion preferences.

## Questions to Consider

- Is Strategist free, premium, or a premium preview—and what would the page look like if it told exactly one entitlement story?
- What if the first screen led with the single move most likely to improve the student’s position this week?
- Should students choose General/Research/Study/Coding and Fast/Balanced/Deep, or should Polaris absorb that routing complexity?
- Should a high-stakes admissions probability ever appear as one precise number, especially when another part of the screen disagrees?
