# First-visit module guides

Apply `supabase/migrations/20261109020000_user_module_tutorials.sql` with this app update. Accounts created after the migration automatically see a short guide on their first visit to each accessible module, after completing business setup. Existing accounts are enrolled with automatic guides disabled to avoid interrupting established users; they can use the Page guide button.

Guides cover the dashboard, sales, sales history, catalogue, orders, inventory, customers, expenses, reports, activity, website, Instagram, staff and settings. Coming-soon modules and public storefronts have no automatic guides. Longer route matches take precedence, so Sales history has its own guide. Module access permissions are respected. The dialogs provide an introduction, rather than highlighting specific page elements.

Users can move Back/Next, finish with Got it, skip or close a guide, replay it from Page guide, or disable all automatic guides. Finishing or skipping records a separate user/module row. Progress follows the account across devices and businesses; it is not stored in browser storage. Manual replay remains available even when automatic guides are off.

The API derives user_id from the verified session, validates module IDs and statuses, and uses user-scoped RLS for SELECT/INSERT/UPDATE. There are no new SECURITY DEFINER functions. Separate module rows avoid overwriting unrelated guide completions when requests overlap.

If the migration is missing or the progress query fails, the workspace remains usable and guides are manual-only. Persistence errors show a toast; dismissals remain suppressed for the current mounted session but may appear again on reload if the save failed.

Content lives in `src/features/tutorials/guides.ts`; UI is `module-tutorial.tsx`. When adding a module, update the database module_id constraint along with the registry and tests. Copy should describe features that exist and avoid promising actions unavailable to the user's role.

Validation: `npm run check`, `npm test`, and `npm run build -- --webpack`. SQL tests verify existing/new account rollout, per-user progress isolation, write constraints and anonymous denial. Service tests cover route matching, permissions, identity binding and missing-persistence behavior. For a browser smoke test, create a new test account after applying the migration, finish business setup, visit Dashboard and Catalogue, finish one guide and skip the other, reload, then replay each using Page guide. Check mobile layout, Escape/close, keyboard navigation, disabling automatic guides and a second user account.
