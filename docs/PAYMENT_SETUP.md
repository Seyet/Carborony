# Paystack payout setup and storefront payments

Owners can open **Settings → Payments**, choose a Nigerian bank, resolve the
account name, and confirm the destination. The backend creates a Paystack
subaccount and stores it against the current business.

Storefront checkout offers Paystack online payment when an active payout account
and the return URL are configured. Bank transfer and pay on delivery remain available.
Online refunds are handled through Paystack and require support reconciliation;
changing an order status does not issue a refund.

## Configure

1. Apply `supabase/migrations/20260906010000_business_payment_setup.sql` to the
   Supabase project. This requires the existing business/profile foundation.
   Do not blindly replay the entire historical migration directory against an
   existing deployment; use its normal migration process.
2. Set `PAYSTACK_SECRET_KEY` on the server. Start with an `sk_test_...` key from
   your Paystack integration. Never use a `NEXT_PUBLIC_` variable for this key.
3. Set `PAYSTACK_PLATFORM_COMMISSION_PERCENT=0`, or the agreed platform percentage
   from 0 through 100 with up to two decimal places. This is Carborony's share,
   not Paystack's transaction fee. The owner must confirm the displayed rate.
4. Ensure `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) is configured for
   the server. Browser sessions have owner-scoped read access only to payout rows.
5. Restart the development server or redeploy after changing environment values.

The first release requires the business country `NG` and currency `NGN`. Account
numbers are treated as strings to preserve leading zeros. The database stores
only the last four digits; the full number is sent to Paystack for verification
and creation and is not included in application logs.

## Retry and recovery

A unique database reservation per business, provider, and test/live mode is saved
before the create request. Only the request that successfully inserts this row
can create a subaccount. Create requests are never automatically retried.

If a request times out, returns an uncertain result, or fails to save the provider
response locally, the row remains reserved. **Check setup status** searches the
provider for the original operation marker and completes the existing record.
This search checks up to 1,000 subaccounts. If a match cannot be established, the
application leaves the setup pending for support review; it must not create a
second account just because a listing returned no match.

Support can use the server-only `operation_id` to locate the description
`Carborony setup <operation_id>` in Paystack. Confirm the original request has
finished, check the integration and mode, and reconcile the matching record. Only
clear an unresolved reservation after confirming there is no provider subaccount.
A definitive 400/422 rejection releases the reservation automatically.

Test and live modes use separate rows. Switching to a live key requires live
setup again. Keep the same Paystack integration; changing integration keys does
not migrate existing subaccounts. Bank-account changes are not enabled in this
release. Review them through support to avoid changing a settlement destination
without an explicit audit process.

`connected` means the provider account was created and saved locally. It does not
mean provider onboarding requirements are complete. Checkout additionally requires
an active account, NGN currency, and the configured return URL.
The provider's active/verification flags are retained separately.

## Verification

- `npm run test:payments`: mocked provider/database boundary checks for owner
  access, confirmation, concurrent reservations, uncertain creation, recovery,
  commission validation, account privacy, and test/live separation.
- `npm run test:auth`: existing password recovery regression suite.
- `npm run check`: ESLint and TypeScript.
- `npm run build -- --webpack`: production compilation if the environment blocks
  Turbopack's local worker ports.

After applying the migration, use Paystack's test environment to verify real bank
resolution and subaccount creation. Check that an owner in business A cannot read
business B's payout row, staff cannot read/write payout rows, and authenticated
clients cannot insert/update/delete rows directly. No live payouts are made by
the automated tests.

References:
- https://paystack.com/docs/api/subaccount/
- https://paystack.com/docs/api/verification/#resolve-account-number
- https://paystack.com/docs/api/miscellaneous/#bank

## Online checkout activation

1. Apply `supabase/migrations/20260906020000_storefront_online_payments.sql` and
   `supabase/migrations/20260906030000_harden_storefront_online_payments.sql` after
   the payout setup migration. These also require the existing storefront, order
   and completed-order inventory migrations. Apply the final file after development
   changes have finished; these migrations are not designed to be replayed.
2. Set `PAYMENTS_APP_URL` to the canonical app origin, for example
   `https://your-app.example`. For test mode on your machine use
   `http://localhost:3000` (or your actual dev port). Live mode requires HTTPS.
   The server constructs callbacks from this value, never the browser's Host header.
3. In the Paystack dashboard, set the webhook URL to:
   `https://your-app.example/api/payments/paystack/webhook`.
   For local webhook testing use a public HTTPS tunnel to your local server.
   Configure the webhook in the same test/live mode and integration as the key.
4. Check the owner's account in Settings → Payments, publish the storefront, and
   choose **Pay online with Paystack** at checkout. Only businesses using NGN and
   an active saved subaccount can start online checkout.
5. Complete a Paystack test checkout before enabling live mode. Test transactions
   create orders and consume stock in this database, so use a test business/database.

Amounts include the database-priced cart and selected delivery zone, rounded to
kobo. The saved owner-approved platform commission is fixed per transaction.
Paystack processing fees are borne by the platform (`bearer: account`), including
when platform commission is zero. The buyer pays the displayed order total.

Initialization stores one random reference and locks the checkout's amount and
items. The browser retains the checkout key across reloads. A lost provider
response is not retried with a new reference. An unresolved initialization shows
payment status; support should inspect the original reference in Paystack and
recover its checkout URL or establish that no transaction was initialized before
resetting its initialization state. Never create a replacement payment merely
because a request timed out. Unpaid orders do not reserve stock and need normal
owner follow-up or cancellation if abandoned.

Paystack returns customers to `/store/<slug>/payment?reference=...`. This page
verifies server-side and can resume an existing checkout. A signed `charge.success`
webhook independently invokes the same verification, so a closed browser does not
prevent settlement. The raw request HMAC is checked before parsing; unknown or
unrelated references are ignored. Database/provider failures return non-200 so
Paystack retries. No card details or full webhook payloads are stored or logged.

Only a successful provider verification with the exact amount, currency,
reference, mode and order metadata marks an order paid. The database locks this
transition and consumes tracked stock once using the existing completion movement
marker. Completing the order later cannot deduct stock again. If stock is exhausted
or the order was cancelled, the receipt remains recorded and the order needs
support review; it cannot be fulfilled automatically. Order history explains this.
The order remains pending for the owner to confirm and fulfil after payment.

Payment review rows retain a server-only reason. Rechecking the payment retries
inventory recording against the already verified provider transaction, so a stock
review can become paid after inventory is corrected. Cancelled orders and payment
detail mismatches remain in review. Migration
`20260906040000_fix_storefront_payment_inventory_settlement.sql` also repairs
eligible review rows created by the earlier pending-order inventory precondition.

Automated refunds and disputes are not implemented. The existing manual refund
status action is blocked for these online orders to avoid claiming a refund that
never happened. Refund via Paystack, then have support reconcile the ledger and
stock after confirming the provider result. Do not rotate between test/live keys
while transactions in the previous mode still require verification; use separate
deployments/databases or finish reconciliation before changing modes.

## Online payment verification

- `npm run test:payments` includes initialization retries, destination/amount
  tampering, callback verification, webhook signatures and database failures.
- SQL integration tests use a local PostgreSQL WASM runtime and minimal domain
  fixtures, with the actual normalization/inventory/payment migration functions.
  Install `@electric-sql/pglite` in a temporary directory, then run
  `PGLITE_MODULE=/path/to/node_modules/@electric-sql/pglite/dist/index.js npm run test:payments:sql`.
  Without that variable, the SQL test is explicitly skipped.
- Exercise success, cancelled checkout, repeated webhook delivery, browser closure
  before callback, payment after cancellation, and stock exhaustion in test mode.
  Confirm offline checkout still works. The local fixture test does not replace
  applying the migration and testing against the full Supabase schema in staging.

Provider references:
- https://paystack.com/docs/api/transaction/
- https://paystack.com/docs/payments/webhooks/
- https://paystack.com/docs/payments/split-payments/
