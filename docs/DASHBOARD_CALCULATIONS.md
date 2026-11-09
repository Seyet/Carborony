# Dashboard calculations

Apply `supabase/migrations/20261109000000_dashboard_all_sales_channels.sql` to Supabase with the app update. The dashboard and CSV export use the new all-channel RPCs; the previous functions remain available for compatibility.

Sales totals combine completed sales with paid orders that have no completed or refunded sales record linked to them. Paid orders count before fulfillment. Unpaid, cancelled, refunded, and payment-review orders do not add revenue. Existing sales record status handling is retained in recent transactions.

Online orders use the verified payment date. Other paid orders use their completion date, falling back to placement date. Sales use their sold date. Date filters and comparison periods use the business timezone, including the final date in the range.

Revenue, charts and recent transactions share one document source; top products combine sale and order line items. Profit is estimated revenue minus item costs and recorded expenses. Sales use saved unit costs. Order costs use inventory consumption snapshots when present, falling back to current variant or product cost when no historical snapshot exists. Provider fees are only deducted if recorded as expenses. Shipping and tax remain part of document totals; product rankings use line totals.

Customer, stock, catalogue, order and expense metrics retain their existing database calculations. Do not add order totals to sales independently elsewhere: linked sales already represent those orders.

Validate with `node --test tests/dashboard-sales-sql.test.mjs` and `npm run typecheck`.
