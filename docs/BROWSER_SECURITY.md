# Browser security headers

`next.config.ts` applies security headers to all routes, including auth screens, storefronts, APIs and static assets.

Enforced now: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a Permissions Policy disabling camera, microphone, location, browser payment APIs, hardware access and motion sensors. Paystack checkout uses a top-level redirect, not the browser Payment Request API or an embedded frame.

CSP is report-only: it observes violations without blocking resources. Framing is already blocked by X-Frame-Options. The policy permits same-origin resources, the configured Supabase origin for media/connections, and blob/data previews. Supabase WebSocket connections are allowed. Google fonts are downloaded during the build and served locally; Meta and Paystack API calls run on the server, so their domains do not need browser CSP allowances.

Inline scripts are temporarily allowed for Next.js hydration and inline styles for React/UI styles. Development also permits eval and local WebSocket connections for debugging and hot reload. Production does not allow eval. This policy is an initial baseline; inline script protection needs nonces or hashes before it provides stronger XSS mitigation.

After deployment, inspect response headers and browser console CSP diagnostics on login/OTP/recovery, dashboard, uploads/previews, Instagram, storefront checkout and document downloads. Reports currently appear in browser developer tools; there is no report collector or central alerting configured. Add a monitored reporting endpoint before unattended production observation. Avoid sending full URLs with auth tokens or customer data into logs.

Once expected resources are accounted for and violations reviewed, change the report-only header to `Content-Security-Policy` in a separate rollout. Keep development exceptions out of production. An intentional iframe integration requires revisiting both X-Frame-Options and frame-ancestors.
