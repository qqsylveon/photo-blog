# Ambient first-paint continuity

Native follow-up bugfix, base f9f0a53, same isolated worktree and existing PR. The screenshot shows the current home-entry gate prevents text rewind but leaves a flat empty field while client scripts load. AmbientBackground is SSR-hidden via v-show and immediately appears at opacity .85 after mounting.

Goal: a continuous first impression in both themes, without extending the loading wait or replaying text. Keep the existing home intro and visitor choices.

Approach: render a small, decorative SSR primer using the existing water palette/ripples or a subset of the actual night star coordinates. Crossfade the primer into the first painted Canvas frame over 900ms using compositor opacity only; text starts during the crossfade, without waiting for its completion. Read the ambient-off preference before paint. Reduced motion gets a static primer, and failed Canvas still leaves readable content. No new libraries, full-screen blockers, filters or extra drawing loops.

Files: AmbientPrimer.vue owns SVG/CSS; AmbientBackground.vue owns painted-state handoff; ambient-night.ts shares immutable star coordinates; useAmbientPreference.ts and nuxt.config.ts coordinate the pre-paint preference. Existing Canvas API/readiness and the 4s home fail-open remain intact.

- [x] RED: delayed external scripts reveal no decorative SSR atmosphere today; require visible themed primer before hydration and sampled intermediate Canvas opacity after release.
- [x] GREEN: implement themed primer, pre-paint preference and opacity crossfade; cover disabled effects, reduced motion and unavailable Canvas; inspect desktop/mobile screenshots.
- [x] Verify full unit/public suites, typecheck/build; one fresh final read-only review followed by one verified fix pass. No findings left unresolved.

Review focus: no initial or final background pop; no primer flash with effects off; no fixed extra wait; no mismatch on hydration; no new ambient loop or layout shift; keep night/pond artwork and route transitions continuous; no account/content mutations.

Final verification: 121 unit/component/integration tests and 81 public browser checks pass (1 expected mobile-hover skip); typecheck and production build pass. Browser checks include both themes on desktop/mobile, held external scripts, intermediate opacity and overlapping layers, disabled effects before hydration, no JS, reduced motion, unavailable Canvas, existing route/metadata/admin-header previews, and About navigation both after settling and during the 350ms blend. Visually inspected initial light/dark primers and the blend at 1440px and 390px. Production cold-loading checks capture intermediate opacity in both themes, retain the hidden primer during About navigation, and report no JavaScript errors.

Final review P2: the outgoing About snapshot could resurrect a faded primer and force the mirrored Canvas to full opacity. Both cases reproduced RED; exclude the primer from serialized content and mirror it separately at the live layer opacities/pose, through the existing drawing loop. Four desktop/mobile cases GREEN and full verification repeated. P3: pause the hidden water ripple as soon as handoff starts; verified in the first-paint checks. No deferred findings or declined-to-judge items.

Delivery: update the existing authorized feature PR, clean task-owned scratch, retain the active preview. No main merge.
