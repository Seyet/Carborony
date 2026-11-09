# API request protections

The shared `handleJsonPost` boundary in `src/lib/api/server.ts` checks origins, JSON media type, actual streamed bytes, and schema validation before invoking a handler.

## Deployment configuration

Set the server-only `TRUSTED_APP_ORIGINS` variable to comma-separated exact origins for custom domains, for example:

```dotenv
TRUSTED_APP_ORIGINS=https://app.example.com,https://shop.example.com
```

Use scheme and hostname, with a port if needed; no paths, wildcards, credentials, queries or fragments. Invalid configuration rejects origin-bearing requests with a configuration error. Production custom domains must be listed before deployment or their browser API requests will return 403. Environment variable changes require redeployment.

The Vercel-provided `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, and `VERCEL_BRANCH_URL` also supply allowed HTTPS origins. No request `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`, or request URL establishes trust. Development additionally permits localhost and 127.0.0.1 on port 3000; configure any additional development origins explicitly.

Explicit cross-site Fetch Metadata is rejected. Non-browser clients without Origin remain supported and must still pass authentication, authorization and JSON validation. Origin checks are browser CSRF defenses, not authentication: non-browser clients can forge or omit these headers. Webhooks use their existing signature-verification boundary.

## Body limits

The default maximum JSON body is 16 KiB, with existing per-handler limits retained. Oversized declared Content-Length is rejected before reading; actual streamed bytes are always counted, including requests with missing or understated lengths. Reading stops and the producer is cancelled on overflow. Malformed JSON, invalid/truncated UTF-8 and failed streams return 400; overflow returns 413 before a handler runs. Cancellation is not awaited so a broken producer cannot prevent the error response.

This bounds application-side body accumulation. Deployment/proxy body limits and connection/read timeouts should remain enabled too. Other route handlers that do not use `handleJsonPost` have separate request-processing boundaries.

Run `node --test tests/api-request-security.test.mjs`, `npm run check`, and `npm test`.
