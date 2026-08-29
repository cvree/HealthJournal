/* Global test environment setup.

   One job: give Testing Library's async helpers a budget that survives a loaded
   CI runner.

   vite.config.ts already raises vitest's `testTimeout` to 15s, with a comment
   explaining why — several suites mount the whole App (React + recharts + xlsx)
   in jsdom, and under CPU contention that is slow through no fault of the code.
   But `testTimeout` governs the *test*, not `waitFor`, which carries its own
   default of 1000ms and blows that budget long before the test runs out. That
   gap is exactly how a green suite fails on a runner: the Pages deploy failed on
   `waitFor(() => expect(saved().sun.length).toBe(1))` after 1695ms — the test had
   twelve seconds left, and the assertion had already given up.

   Individual suites had been patching around this by passing `{ timeout: 5000 }`
   at call sites (see aiWizard.test.tsx), which works but only where someone
   remembered. Setting the default once covers every existing `waitFor` and
   `findBy*`, and every one written later.

   This does not weaken any assertion. A wrong expectation still fails; it just
   waits longer before saying so. The ceiling stays below `testTimeout` so a
   genuine hang still surfaces as the assertion that failed rather than an
   unhelpful test-level timeout. */
import { configure } from "@testing-library/dom";

configure({ asyncUtilTimeout: 5000 });
