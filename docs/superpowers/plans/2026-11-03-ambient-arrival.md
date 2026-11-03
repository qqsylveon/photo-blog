# Ambient first-paint continuity

Native follow-up bugfix, base f9f0a53, same isolated worktree and existing PR. The screenshot shows the current home-entry gate prevents text rewind but leaves a flat empty field while client scripts load. AmbientBackground is SSR-hidden via v-show and immediately appears at opacity .85 after mounting.

Goal: a continuous first impression in both themes, without extending the loading wait or replaying text. Keep the existing home intro and visitor choices.

Approach: render a small, decorative SSR primer using the existing water palette/ripples or a subset of the actual night star coordinates. Crossfade the primer into the first painted Canvas frame over 900ms using compositor opacity only; text starts during the crossfade, without waiting for its completion. Read the ambient-off preference before paint. Reduced motion gets a static primer, and failed Canvas still leaves readable content. No new libraries, full-screen blockers, filters or extra drawing loops.

Files: AmbientPrimer.vue owns SVG/CSS; AmbientBackground.vue owns painted-state handoff; ambient-night.ts shares immutable star coordinates; useAmbientPreference.ts and nuxt.config.ts coordinate the pre-paint preference. Existing Canvas API/readiness and the 4s home fail-open remain intact.

- [x] RED: delayed external scripts reveal no decorative SSR atmosphere today; require visible themed primer before hydration and sampled intermediate Canvas opacity after release.
- [x] GREEN: implement themed primer, pre-paint preference and opacity crossfade; cover disabled effects, reduced motion and unavailable Canvas; inspect desktop/mobile screenshots.
- [ ] Verify relevant/full tests, typecheck/build; one fresh final read-only review with one verified fix pass if needed; sync existing authorized PR and clean task-only scratch, retain preview. No main merge.

Review focus: no initial or final background pop; no primer flash with effects off; no fixed extra wait; no mismatch on hydration; no new ambient loop or layout shift; keep night/pond artwork and route transitions continuous; no account/content mutations.

Verified so far: 121 unit/component/integration tests and 77 public browser checks pass (1 expected mobile-hover skip); typecheck passes. Browser checks include both themes on desktop/mobile, held external scripts, intermediate opacity and overlapping layers, disabled effects before hydration, no JS, reduced motion, unavailable Canvas, and existing route/metadata/admin-header previews. Visually inspected initial light/dark primers and the 350ms blend at 1440px and 390px.
