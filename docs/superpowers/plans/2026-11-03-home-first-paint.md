# Home first-paint continuity

Native bugfix execution; base5800ef3, existing isolated worktree, branch codex/home-first-paint. User explicitly asks to eliminate the static-home flash when opening the site from the admin link. No layout redesign or forced loading delay.

Confirmed cause: admin target=_blank opens a cold SSR document. SSR emits visible glyphs, useHomeAnimations dynamically imports GSAP only after mount, and AmbientBackground starts hidden until mounted/RAF. The visible static content is subsequently reset by GSAP.from.

Scope: small pre-paint JS opt-in gate for the homepage only; CSS holds animation targets until the first enabled ambient frame and GSAP initial styles are ready. Paint the ambient frame synchronously after its visible canvas is sized. No-JS and reduced-motion remain readable. A bounded 4s fail-open shows static content when client loading fails and prohibits a late animation restart. Preserve reversible home motion, theme/ambient choices, other pages, data and main preview.

- [x] RED browser regression: cold popup from isolated admin, held external scripts, currently visible static text; observe failure.
- [x] Coordinate pre-paint bootstrap, first background frame and animation handoff; catch failures and release all listeners/timers on disposal.
- [x] GREEN cold popup in both themes, blocked/failed loaders, no JS, reduced motion, effects off; complete suite/typecheck/build and relevant browser suites.
- [ ] One fresh final read-only review; one verified material-fix pass if needed, sync authorized feature branch/PR, clean owned scratch and retain preview. No main merge without authorization.

Review focus: no SSR flash on a new tab; only wait for enabled background; static fallback cannot reset on late chunks; rapid navigation/disposal cannot leave hidden content or stale global flags; preserve non-JS/reduced-motion accessibility; no private data mutations. No implementation agents, no dependencies.
Verified:121 unit/component/integration tests,69 public browser checks,9 isolated backend browser checks (199 total),1 expected mobile-hover skip. Typecheck and production build pass. Production homepage SSR/intro/background inspected at3133; captured PNG and live readiness state. Video encoding was unavailable because ffmpeg is not installed; frame-by-frame browser assertions verify the actual no-rewind/paint-order behavior without that optional artifact. No real content/account writes.
