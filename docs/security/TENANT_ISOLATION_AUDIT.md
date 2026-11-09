# Tenant isolation audit

## Status and scope

Repository audit completed for application boundaries and the latest definitions of all **36 distinct SECURITY DEFINER functions** present in local migrations. Local adversarial tests pass against application handlers and the actual payment/inventory migrations. **Hosted Supabase isolation is not yet verified.** No live database policies were changed, no live test users were created, and no production records were accessed or modified during this audit.

The repository lacks the original orders, customer CRM, reports, membership/permission-helper, and Storage RLS migrations. Local fixtures do not reproduce these missing policies. Application tests therefore establish that handlers bind IDs to the verified current business; they do not establish that hosted direct Data API access is safe. The hosted audit/probes below are required to close that gap.

## Findings and fixes

| Finding | Evidence | Change |
| --- | --- | --- |
| POS sale and invoice RPCs accepted membership without module permission | `20260823070000_external_pos_items_and_invoices.sql` | New migration requires `sales.manage` before any business data operations. |
| Payment state RPC accepted all business members | `20260906080000_reconcile_reviewed_order_payments.sql` | New migration requires `sales.view`; lookup still constrains both business and order. |
| Report and dashboard export handlers lacked explicit export permission checks | `get-report-export.ts`, `export-overview.ts` | Reject without `reports.export` before constructing queries. The underlying hosted report RPCs still require independent review. |
| Product media finalization relied on external RLS/FKs to reject a foreign product ID | `manage-media.ts` | All mutations now require `products.manage`; finalization verifies the product belongs to the current business before storage or metadata operations. |
| Document and expense download handlers relied on RLS for module permission | transaction document and expense attachment services | Explicit `sales.view` / `expenses.view` checks, in addition to existing business-scoped lookups. |
| Attachment cleanup trusted a path passed by its caller | `manage-attachment.ts` | Reject paths outside the business/expense prefix before any lookup or deletion. |
| Existing/default execution privileges can survive function replacement | Reviewed definer migrations | Explicit role grants for each reviewed signature; revoke PUBLIC, anon, authenticated and service_role first, then grant only reviewed callers. Internal/trigger functions get no direct grants. |

These are repository-level findings. Existing hosted definitions may differ; inspect them before applying replacement function definitions.

## Function review

`definer-inventory.json` lists each function signature, latest source file, authorization boundary and permitted caller roles. All reviewed functions pin an empty search path. The review distinguishes:

- Internal normalization, inventory, payment guards and dashboard helpers: no direct client execution; authorization comes from parent operations.
- Service-only Instagram credential/sync/connection and verified checkout/settlement functions: never callable with anon or authenticated keys. Backend callers remain responsible for verifying actors, store scope and provider responses. `service_role` deliberately bypasses RLS and is not tenant-isolated by database policies.
- Authenticated RPCs: verify membership/module permissions or an initiating user-bound OAuth state, and constrain related IDs by business.
- Public catalogue search: intentional public data for published storefronts. Draft reads require `settings.view`. Public catalogue images, logos and banners are not private tenant files. Expense attachments must remain private.

`tests/definer-inventory.test.mjs` fails if a new local definer signature is introduced without a review entry, the source changes without updating the inventory, search_path is unpinned, or a reviewed execution signature is missing from the grant migration. This is an audit regression gate, not a substitute for semantic code review. Hosted-only functions and overloads are listed by the catalog audit and are deliberately not modified by name alone.

## Local verification

Run `npm run check` and `npm test`.

- `tenant-isolation.test.mjs`: guessed IDs for orders, customers, receipts/invoices, product media and expense files; foreign stored file paths; cleanup guards; explicit export permissions; current-business scoping of mutations and dashboard exports. The fake client intentionally has no RLS so missing application filters are detectable.
- `online-payments-sql.test.mjs`: runs real payment and hardening migrations in PGlite, impersonates two independent business owners, checks payout SELECT RLS and denied direct writes, rejects foreign-business POS/invoice/payment-state calls, tests cross-business order IDs, denies members without module permissions, and checks effective execution grants for every reviewed signature installed in that SQL fixture. Optional Instagram/dashboard functions absent from the fixture are not fabricated or claimed as runtime-tested.
- Existing SQL tests cover draft/public catalogue scoping, dashboard business scoping and payment ledger restrictions. Permission helpers in these fixtures are test boundaries; the hosted helper implementations still need review.

## Hosted verification steps

1. Run `scripts/security/audit-hosted-database.sql` as administrator in Supabase SQL Editor. It is a read-only catalog inspection and returns no customer/order/file contents. Review all RLS policies (including INSERT/UPDATE WITH CHECK), definer bodies and inherited execution grants, exposed views, composite business/object foreign keys and bucket visibility. Also review membership/role-management writes so users cannot grant themselves access to another business. Treat hosted-only functions and missing local dependencies as unresolved until reviewed.
2. Compare current hosted POS/invoice/payment-state definitions to the replacements in `20261109010000_tenant_rpc_execution_hardening.sql`, then apply that migration alongside the app changes. It changes grants only for exact reviewed signatures; optional missing modules emit notices. Core POS/invoice/payment-state dependencies must exist. This migration is prepared locally and has **not** been applied remotely.
3. In a dedicated test project create two owners with no cross-membership, each with a business, order, customer and a real private expense attachment. Add a payout account for the SQL write fixture. Use short-lived **user** access tokens for direct REST testing; never use the service key.
4. Run `node --env-file=.env.local scripts/security/probe-tenant-isolation.mjs` with these environment variables set locally:

   ```text
   AUDIT_TENANT_A_JWT
   AUDIT_TENANT_A_BUSINESS_ID
   AUDIT_TENANT_A_ORDER_ID
   AUDIT_TENANT_A_CUSTOMER_ID
   AUDIT_TENANT_A_PRIVATE_FILE_PATH
   AUDIT_TENANT_B_JWT
   AUDIT_TENANT_B_BUSINESS_ID
   AUDIT_TENANT_B_ORDER_ID
   AUDIT_TENANT_B_CUSTOMER_ID
   AUDIT_TENANT_B_PRIVATE_FILE_PATH
   ```

   The script also uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Do not paste tokens into chat or commit them. It makes real, read-only Data API queries and short-lived private-file signing requests in both directions, with own-tenant positive controls. It rejects missing RPCs/expired tokens instead of treating them as passes. It does not print tenant records or signed URLs. Public bucket reads are intentionally not treated as a breach. It does not test writes.
5. Replace all placeholders in `scripts/security/probe-tenant-writes.sql` and run it on the dedicated test project. It validates fixture existence and nonmembership before impersonating an authenticated owner. It attempts foreign order/customer/file/payout writes, tenant reassignment and a cross-business customer reference. **All writes are enclosed in a transaction ending in ROLLBACK**, including any write that wrongly succeeds. Run in both directions. Unexpected errors are failures requiring review; do not suppress them.
6. Test direct Storage API upload, overwrite, delete and list operations with both test users too. SQL metadata probes do not test the Storage service's upload tokens or object bytes. Verify expense-attachments is private and signed URLs remain bearer capabilities until they expire.

No result from steps 1–6 is claimed until run against the hosted project. This is the remaining audit boundary.

References: https://supabase.com/docs/guides/database/functions and https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/storage/security/access-control
