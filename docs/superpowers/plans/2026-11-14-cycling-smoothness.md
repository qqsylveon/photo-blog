# Cycling transition smoothness

**Goal:** Keep the approved cyclist and curved page reveal, reduce dropped frames, and shorten the ride from 2500ms to 2200ms (2300ms including cleanup).

**Evidence:** A 2560×1440 Chrome trace shows layout and paint on virtually every ride frame. The animation repeatedly reads layout after SVG/style mutations, rebuilds a 51-point full-page clip, queries SVG descendants, and reads background computed styles.

**Approach:** Cache geometry with ResizeObserver and cache SVG references. Move the fixed curved clipping surface, its counter-translated content, and the cyclist using synchronized browser-managed transform animations. Keep the outgoing content stationary and its background moving, with the temporary background bitmap capped at a 1920px long edge. Keep photographs and the live background at their normal resolution. Retain the original connected pedal geometry, responsive off-screen exit, cancellation, and the animation-API fallback. Do not add dependencies or modify gallery/home behavior, data, or the artwork.

- [x] Add a browser regression proving travel continues while application animation callbacks are held, and update timing assertions; verify failures before implementation.
- [x] Implement cached geometry and compositor transforms, retaining resizing, cancellation, theme/ambient continuity, and a fallback when browser animations are unavailable.
- [x] Run 27 focused unit/component tests and 12 targeted desktop/mobile browser regressions. Compare traces at the same viewport and inspect representative light/desktop and dark/mobile frames.
- [x] Obtain a fresh review; cover the no-Canvas effects toggle and high-resolution bitmap budget with regressions.

**Release checks:** Final typecheck and production build passed. Delivery target is the existing `codex/home-first-paint` branch, without merging `main`.
