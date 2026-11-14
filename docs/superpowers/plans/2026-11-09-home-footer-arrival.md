# Home footer and progressive scene arrival

Native follow-up in the existing isolated worktree, base7228176. User requirements: homepage ICP link 豫ICP备2026056885号 to http://beian.miit.gov.cn/ visible without scrolling; no ICP on gallery/about; smoother first paint through full ambient scene.

Keep the footer in normal flow and share the initial viewport between header, invitation and footer. Reserve mobile navigation/safe-area space; shrink spacing on short displays, while allowing naturally longer/custom text to remain readable. Retain non-registration footer text elsewhere.

Extend the existing opacity handoff with a single renderer-owned arrival clock: water/initial stars first, then foliage/flowers, then swimmers/birds/meteors over about1.8s. Use smooth per-element alpha in the existing draw loop; no extra Canvas, imagery, libraries, waits or motion reset on resize. Preserve reduced-motion/off/failed-loading paths and About's live-layer mirror.

- [x] Reproduce homepage overflow/link behavior with browser checks; add a meaningful timing test for layered arrival before implementation.
- [x] Implement normal-flow single-screen home footer and progressive scene rendering; inspect desktop/mobile, including short landscape.
- [x] Verify unit/type/build and full public browser coverage; one fresh read-only review and one verified material-fix pass completed. No findings deferred.

Review focus: ICP link accessible above mobile navigation; no overflow with normal two-line copy; long copy/zoom remains readable; no ICP in gallery/about or their outgoing snapshots; no alpha jump/scene rewind on resize or theme change; no extra simulation loops; account/data untouched.

Final verification:123 unit/component tests,87 public browser checks pass,1 expected mobile-hover skip; typecheck/production build pass. Registration tested at2560×1271,1440×600,390×844,667×375 with zero document overflow and no fixed-navigation overlap. Existing gallery/About footer, cold-loading, theme, fallback, snapshot and navigation checks pass. Scene-clock tests reproduce missing elapsed-time propagation RED and pass GREEN, including resize preservation and deliberate resume/theme resets. Screenshots visually inspected in light/dark, portrait/short landscape; at200% text the document grows naturally without text/footer overlap. Production SSR returns200 on all three public pages with registration only on home and class-based main sizing retained. Owned browser and test production server closed.

Final review P2 fixes: snapshot sanitization strips IDs, so sizing now uses a class preserved in outgoing snapshots; direct-child layout selectors prevent target-page styles leaking into the outgoing page. Quotation/link/footer positions tested before and after the target layout swap. Canvas resizing clears its bitmap, so the active scene now redraws synchronously in the resize handler; native pixel checks keep the previous frame visible even while scheduled RAF is withheld. Both issues RED→GREEN, four desktop/mobile checks; whole verification repeated. No declined-to-judge or minor findings; no second review.

Delivery: update the existing authorized feature PR, clean this task's scratch, retain the active3000 preview (logs outside the task directory). No main merge.
