# Natural pond wandering Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline, preserving the user's Native execution preference. One fresh final review after verification.

**Goal:** Fish and prawns wander independently rather than circling in formation.
**Architecture:** A scene-local, seeded fixed-step steering model replaces shared orbit samples. Random goals, bounded acceleration/turning, boundary steering and short-range avoidance produce smooth independent movement.
**Tech Stack:** Existing TypeScript canvas; no dependencies.
**Spec:** docs/superpowers/specs/2026-11-01-natural-pond-design.md

## Global Constraints

Preserve density (4 mobile/6 desktop), detailed cached artwork, full pond range, theme and pixel budget. Accept brief crossings instead of forcing permanent separation. Preserve existing residents across responsive density changes. Keep user content and main preview untouched; sync the authorized development branch.

## Review Focus

- Independent destinations and centre crossings, no shared circuit or fixed lane.
- Smooth motion and headings at turns and encounters; no sudden positional corrections.
- Pause/resume does not catch up with a teleport or unbounded work.
- Mobile/landscape/wide bounds and density changes retain existing identities.
- Multiple scene instances/seeds do not share mutable movement state.

### Task 1: Independent natural movement

Files: app/utils/pond-swimmers.ts, app/utils/ambient-pond.ts, app/utils/ambient-shrimp.ts, tests/unit/pond-swimmers.test.ts, tests/unit/ambient-shrimp.test.ts.
Interface: createPondSwimmers(seed?:number) returns a sample(time:number,width:number,height:number):PondSwimmer[] controller local to each scene. Shrimp drawing consumes its supplied pose; remove its obsolete standalone orbit sampler.

- [x] Add and observe RED: existing trajectories never enter the middle of the pond.
- [x] Add seeded simulation coverage for centre/full-height roaming, non-repeating independent headings, bounded frame motion, no prolonged piles, viewport changes, isolated scenes and long pauses.
- [x] Implement independent wander steering and connect the live scene; keep the prawn rig/art unchanged.
- [x] Run npm test and npm run typecheck; inspect actual desktop/mobile preview and accelerated route traces, run production build.
- [x] Review once; fix material findings with RED→GREEN, record outcome, commit/push and clean only owned scratch.

## Verified outcome

Replaced the shared orbit with independent scene-local seeded random goals, gradual turns/speed changes and local avoidance. Bodies may briefly cross; no shared circuit or reserved lanes. Preserved artwork, density, theme and rendering budget. Resident positions survive resize and long tab pauses without teleporting.

Regression RED: the old orbit produced zero centre visits. GREEN: 118 unit/component/integration tests, 6 relevant desktop/mobile browser checks, typecheck and production build. Six-minute traces and actual wide/mobile homepage inspected. Initial all-suite simulation test timeouts came from per-frame matcher overhead, resolved by aggregating identical bounds/continuity assertions before checking the same thresholds.

One fresh read-only final review: no actionable findings, no deferred minors or rulings. Additional simulation across 12 seeds and six viewports for six minutes each stayed within bounds and crossed the centre; longest body overlap 1.8 seconds, maximum movement 2.47 px per 50 ms. No content/account changes. Keep main preview and active worktree; sync existing authorized development branch, no merge/deploy.
