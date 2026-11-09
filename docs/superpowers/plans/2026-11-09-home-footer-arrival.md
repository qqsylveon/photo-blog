# Home footer and progressive scene arrival

Native follow-up in the existing isolated worktree, base7228176. User requirements: homepage ICP link 豫ICP备2026056885号 to http://beian.miit.gov.cn/ visible without scrolling; no ICP on gallery/about; smoother first paint through full ambient scene.

Keep the footer in normal flow and share the initial viewport between header, invitation and footer. Reserve mobile navigation/safe-area space; shrink spacing on short displays, while allowing naturally longer/custom text to remain readable. Retain non-registration footer text elsewhere.

Extend the existing opacity handoff with a single renderer-owned arrival clock: water/initial stars first, then foliage/flowers, then swimmers/birds/meteors over about1.8s. Use smooth per-element alpha in the existing draw loop; no extra Canvas, imagery, libraries, waits or motion reset on resize. Preserve reduced-motion/off/failed-loading paths and About's live-layer mirror.

- [x] Reproduce homepage overflow/link behavior with browser checks; add a meaningful timing test for layered arrival before implementation.
- [x] Implement normal-flow single-screen home footer and progressive scene rendering; inspect desktop/mobile, including short landscape.
- [ ] Verify unit/type/build and relevant public browser coverage; final read-only review, sync the existing authorized PR, clean task-only artifacts, leave preview running. No main merge.

Review focus: ICP link accessible above mobile navigation; no overflow with normal two-line copy; long copy/zoom remains readable; no ICP in gallery/about or their outgoing snapshots; no alpha jump/scene rewind on resize or theme change; no extra simulation loops; account/data untouched.

Verification:123 unit/component tests,83 public browser checks pass,1 expected mobile-hover skip; typecheck/production build pass. Registration tested at2560×1271,1440×600,390×844,667×375 with zero document overflow and no fixed-navigation overlap. Existing gallery/About footer, cold-loading, theme, fallback, snapshot and navigation checks pass. Scene-clock tests reproduce missing elapsed-time propagation RED and pass GREEN, including resize preservation and deliberate resume/theme resets. Screenshots visually inspected in light/dark, portrait/short landscape; owned browser closed.
