# useEffect Audit

Baseline: [React - You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

Rule of thumb used for this audit:
- Keep `useEffect` when it synchronizes with an external system: browser APIs, DOM, subscriptions, timers, storage, network polling, router side effects triggered by async state, or third-party widgets.
- Question `useEffect` when it mirrors props/query data into local state, derives render data, or reacts to a user event that could be handled directly in the event handler.

## Summary

- Keep: effects that subscribe, persist, focus, scroll, poll, or bridge to storage/router/auth/query cache.
- Review: effects that reset or reshape local state from props/query results.
- Highest-priority refactors:
  - `components/drafts-dashboard-client.tsx`
  - `components/settings-page-client.tsx`
  - `components/tools-dashboard-client.tsx`
  - `components/runs-dashboard-client.tsx`

## File-by-file

### Keep

- `components/app-sidebar.tsx:90`
  Reads a cookie after mount. This is browser storage synchronization and is reasonable if we want to avoid hydration mismatch from reading `document.cookie` during render.

- `components/chats-dashboard-client.tsx:225`
  Resets transient chat UI when the active project changes. This is local state reset tied to a conceptual page switch. It could be replaced with a keyed subtree, but the current effect is understandable.

- `components/chats-dashboard-client.tsx:232`
  Clears optimistic state when the requested thread changes. Similar to the above: acceptable, though a keyed child component could simplify it further.

- `components/chats-dashboard-client.tsx:241`
  Auto-scrolls the message container. DOM synchronization is a valid Effect.

- `components/tool-connection-checklist.tsx:175`
  Calls `onResolved` once when all toolkits are ready. This is a side effect caused by async external state, so an Effect is reasonable.

- `components/tool-connection-checklist.tsx:184`
  Resets the one-shot guard when readiness falls back. Internal bookkeeping for the side effect above; acceptable.

- `components/run-workspace.tsx:206`
  Auto-scrolls the terminal feed. DOM synchronization is a valid Effect.

- `components/run-workspace.tsx:571`
  Schedules run advancement/resume polling. This is synchronization with async server state and a timer, so it belongs in an Effect.

- `components/dashboard-home-client.tsx:14`
  Redirects when no projects exist. Router navigation based on async data is a valid Effect.

- `components/providers/query-provider.tsx:114`
  Synchronizes auth scope with local state, localStorage, and persisted query cache. This is external storage/cache coordination and belongs in an Effect.

- `components/tools-dashboard-client.tsx:536`
  Persists the catalog snapshot. Browser storage synchronization is a valid Effect.

- `components/tools-dashboard-client.tsx:672`
  Handles OAuth return cleanup, cache invalidation, and URL cleanup. This is external/router synchronization and belongs in an Effect.

- `components/providers/auth-provider.tsx:111`
  Hydrates user state from localStorage. Browser storage synchronization is a valid Effect.

- `components/providers/auth-provider.tsx:159`
  Subscribes to Supabase auth changes and resolves the initial session. Subscription setup/cleanup is exactly what Effects are for.

- `components/providers/project-provider.tsx:123`
  Hydrates project selection from localStorage. Browser storage synchronization is a valid Effect.

- `components/providers/project-provider.tsx:129`
  Keeps project selection, snapshot storage, and query invalidation in sync with auth/project data. This is external storage/cache coordination.

- `lib/query/use-delayed-visibility.ts:8`
  Delays visibility with a timer. Timers are an acceptable Effect use.

- `hooks/use-mobile.ts:8`
  Subscribes to a media query and updates state on changes. Browser API subscription is a valid Effect.

- `components/ui/carousel.tsx:91`
  Exposes the Embla API to the parent when available. Third-party instance synchronization is acceptable.

- `components/ui/carousel.tsx:96`
  Subscribes to Embla events and cleans them up. Valid subscription Effect.

- `components/ui/calendar.tsx:193`
  Focuses the active day button. DOM synchronization is a valid Effect.

- `components/ui/sidebar.tsx:131`
  Registers a keyboard shortcut and cleans it up. Browser event subscription is a valid Effect.

### Review

- `components/nav-user.tsx:58`
  Mount-only hydration flag. This is a common SSR guard, but it is not the kind of external synchronization React is advocating for. It may be replaceable with a server-safe render fallback, `dynamic(..., { ssr: false })`, or by letting the parent avoid rendering user-specific UI until auth hydration completes.

- `components/theme-switcher.tsx:13`
  Another mount-only hydration flag. Likely acceptable in practice with `next-themes`, but it is still a hydration workaround rather than core Effect logic.

- `components/project-onboarding-screen.tsx:47`
  Mount-only hydration flag. Probably replaceable by relying on project loading state instead of an explicit `hasHydrated` effect.

- `components/objective-intake.tsx:58`
  Mount-only hydration flag. Same comment as above.

- `components/ui/sidebar.tsx:106`
  Mount-only `hasMounted` state used for `data-ready`. This looks more like hydration bookkeeping than necessary external synchronization.

- `components/runs-dashboard-client.tsx:327`
  Auto-clears delete confirmation with a timer. Because this behavior starts from a click, React's guidance suggests considering whether the timer setup belongs directly in the event handler instead of a follow-up Effect.

- `components/drafts-dashboard-client.tsx:1074`
  Same auto-clear confirmation timer pattern as runs. Probably movable to the delete-click flow.

- `components/runs-dashboard-client.tsx:339`
  Normalizes the URL when there is no requested run ID. Acceptable, but it is still URL bookkeeping caused by render state. If the route can establish a default selection earlier, this effect could disappear.

- `components/drafts-dashboard-client.tsx:1086`
  Same URL-normalization pattern for drafts. Acceptable, but a candidate for route-level/default-selection cleanup.

- `components/runs-dashboard-client.tsx:368`
  Pushes `workspaceProjectId` into project context. This is synchronizing two local sources of truth. It may be necessary for deep links, but it is worth checking whether the selected run/project relationship can be established in one place instead.

- `components/runs-dashboard-client.tsx:377`
  Copies workspace data into the runs list cache. This is query-cache bookkeeping. It is not a React anti-pattern in the same way as derived UI state, but it is still post-render synchronization that might be better centralized in mutation/query utilities.

- `components/drafts-dashboard-client.tsx:1171`
  Reads sessionStorage and shows a toast once. This is browser storage and notification side effects, so it is acceptable, but it is worth keeping isolated because it is easy for these effects to spread.

- `components/drafts-dashboard-client.tsx:1247`
  Redirects to the run when the draft enters `executing`. Router navigation based on async state is valid, but it is still a side-effect boundary worth keeping narrow.

### Likely Refactor

- `components/settings-page-client.tsx:144`
  Mirrors `user?.email` into local state. This is the exact “adjust state when props change” pattern React warns about. Prefer keying the form by user identity, or keeping a draft state that initializes once per account instead of syncing on every prop change.

- `components/tools-dashboard-client.tsx:567`
  Adjusts `selectedCategoryId` because `visibleCategories` changed. This is derived state from render data. Prefer deriving an `effectiveSelectedCategoryId` during render:
  `selectedCategoryId` if valid, otherwise the first visible category, otherwise `""`.

- `components/tools-dashboard-client.tsx:666`
  Clears `openToolkitSlug` when it no longer matches filtered options. This is another derived-state cleanup effect. Prefer deriving an `effectiveOpenToolkitSlug` in render, or updating selection directly in the event paths that change the filter/search.

- `components/drafts-dashboard-client.tsx:1200`
  Copies fetched flow data into multiple local state variables. This is the strongest "you might not need an effect" smell in the repo. The effect is maintaining parallel state for answers, generated answers, current step, active question, review markdown, edit mode, mode, and error. This should be rethought as either:
  - a keyed child component that initializes once per draft, or
  - a reducer/state model where user edits are the source of truth and server data becomes the initial state.

- `components/drafts-dashboard-client.tsx:1223`
  Derives `mode` from `flowQuery.data` and `toolPreflight` after render. This is another derived-state effect and should likely become render-time derivation, unless there is a very specific requirement to preserve a user-overridden mode independently.

## Suggested Cleanup Order

1. Refactor `components/drafts-dashboard-client.tsx` first.
   This is the clearest case of state mirroring and should remove the most Effect complexity.

2. Refactor `components/settings-page-client.tsx`.
   The email form reset is a smaller, contained version of the same anti-pattern.

3. Refactor `components/tools-dashboard-client.tsx`.
   Replace category and toolkit reset effects with derived selection values.

4. Revisit timer-based confirmation effects in runs/drafts.
   These may be fine to keep, but they are good candidates for event-driven cleanup if we want to align more strictly with the React guidance.

5. Decide whether hydration-flag effects are an accepted house style.
   If yes, document them as an explicit exception. If no, replace them gradually with server-safe rendering patterns.

## Note on `react-expert` Skill

The current `react-expert` skill is a research workflow for authoritative React behavior. It does not currently encode a project convention or checklist for auditing `useEffect` usage across this codebase. If we want this to become a standing practice, we should add a short repo-specific guideline rather than rely on the skill alone.
