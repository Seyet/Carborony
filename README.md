# Carborony

Business management and social commerce application with a merchant workspace,
catalogue, inventory, orders, sales, reports, public storefronts, and Paystack
checkout. Business data is scoped through Supabase authorization and PostgreSQL
Row Level Security.

## Stack

- Next.js App Router, React, and strict TypeScript
- Tailwind CSS and shadcn/ui
- Supabase Auth, PostgreSQL, and Storage-ready clients
- Zod validation, Lucide icons, and Sonner notifications
- Vercel-ready runtime configuration

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add the following values from **Supabase → Project Settings → API** to
`.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Then open [http://localhost:3000](http://localhost:3000). Without Supabase
credentials, the public authentication screens remain previewable and protected
`/app` routes redirect to `/login`.

## Supabase setup

1. Create or select a Supabase project.
2. In **Authentication → Sign In / Providers → Email**, keep the email provider
   enabled, turn on **Confirm Email**, and keep the email OTP length set to six
   digits. The signup OTP step fails closed when confirmation is disabled.
3. In **Authentication → Email Templates → Confirm signup**, include the OTP
   token in the message body, for example:

   ```html
   <h2>Verify your Carborony account</h2>
   <p>Your verification code is:</p>
   <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">
     {{ .Token }}
   </p>
   ```

   Remove `{{ .ConfirmationURL }}` for a code-only signup experience. Configure
   custom SMTP before production email delivery.
4. Add the local and production `/auth/callback` and `/auth/confirm` URLs to the
   project's allowed redirect URLs.
5. Apply every migration in `supabase/migrations` in timestamp order using the
   Supabase SQL editor, or initialize/link the Supabase CLI and run
   `supabase db push`.
6. Keep Row Level Security enabled. The migrations create policies for the
   foundational `profiles`, `businesses`, `business_members`, and `roles`
   tables.

The migrations also create profile automation, confirmation-time initial
business provisioning, business-owner membership automation, timestamp
triggers, membership helper functions, indexes, and seed roles. The dashboard
domain migration adds products, categories, inventory, customers, orders,
sales, expenses, tenant-safe policies, and dashboard aggregate functions.
Paystack payment setup and storefront checkout are implemented. Outbound
marketing automation remains deferred.

## Signup flow

Registration collects the account holder's full name, email, phone number,
business name, and password. The JSON registration endpoint creates the pending
Supabase user and sends the configured confirmation email. `/verify-otp` accepts
the six-digit email code, establishes the session, and redirects to the merchant
dashboard. Only the pending email address is retained in session storage between
those two screens; passwords and OTPs are never persisted by the application.

When the email is confirmed, the database migration creates the user's initial
business and owner membership idempotently. Phone numbers are contact data only;
this flow verifies the email address, not the phone number.

## Commands

```bash
npm run dev        # development server
npm run lint       # ESLint with zero warnings allowed
npm run typecheck  # strict TypeScript check
npm run check      # lint and typecheck
npm test           # all tests, including local PostgreSQL regression tests
npm run build      # optimized production build
npm start          # run the production build
```

## JSON API convention

Client-side mutations use same-origin JSON Route Handlers. Requests send
`Content-Type: application/json` and responses use one of these envelopes:

```json
{ "ok": true, "data": {}, "message": "Optional success message" }
```

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A safe error message",
    "fields": {}
  }
}
```

The authentication mutations live under `/api/auth/*`, including registration,
OTP verification, and OTP resend handlers. They validate body size, content
type, origin, and payloads before calling Supabase, and never return sessions or
tokens. `/auth/callback` and `/auth/confirm` remain browser redirect handlers
because Supabase email and PKCE links navigate to them directly.

## Instagram catalogue import

The Instagram integration uses Meta's **Instagram API with Instagram Login**
and requests `instagram_business_basic`. Configure the server-only Meta values
shown in `.env.example`, add this exact production OAuth redirect URI in the
Meta dashboard, and apply the latest database migration:

```text
https://carborony.vercel.app/api/integrations/instagram/callback
```

```bash
npx supabase db push
```

Owners connect the account under **Settings → Integrations** and manually sync
recent posts. Caption rules create editable suggestions; imports are never
turned into catalogue products until an authorized user confirms the review and
chooses **Add as catalogue draft** or **Approve & publish**. Access tokens are
encrypted before storage and are never exposed to browser code.

## Architecture

```text
src/
├── app/                    # routing, layouts, loading, and error boundaries
│   ├── (auth)/             # public account routes
│   ├── api/                # typed JSON Route Handlers
│   ├── app/                # protected merchant workspace
│   └── auth/               # Supabase callback and OTP confirmation handlers
├── components/
│   ├── common/             # reusable empty, error, and loading states
│   ├── layout/             # responsive application shell and navigation
│   └── ui/                 # shared shadcn/ui design-system primitives
├── features/               # feature-owned UI, validation, services, and data
├── lib/
│   ├── api/                # shared JSON client/server contracts
│   ├── auth/               # server-side session and redirect helpers
│   └── supabase/           # browser, server, and request-proxy clients
└── types/                  # database and tenant context types

supabase/
└── migrations/             # versioned PostgreSQL schema changes
```

Route protection uses the request proxy for session refresh and navigation
redirects, plus a verified server-side user check at the protected app boundary.
Future data access and server actions must continue checking authorization close
to the data source and must scope business-owned records by `business_id`.

The public storefront lives at `/store/[slug]`, with product details, a cart,
and checkout. Catalogue search and category filters run in PostgreSQL and return
24 products per page. Card responses contain one thumbnail, a short description,
and the variant pricing/stock needed by the grid; product pages load full details.
Cart and metadata reads do not fetch the catalogue. Prices and availability are
verified again during checkout.

## Storefront optimization rollout

Apply `20260921090000_paginate_public_storefront.sql` to the existing database
**before deploying the updated application**. It adds a read-only RPC and keeps
the existing product-detail RPC available. Published-store and authorized-preview
visibility rules are preserved. No persistent cache of prices, stock, or private
storefront previews is introduced.

The image optimizer allows only the `product-media`, `storefront-media`, and
`business-logos` public storage paths on `NEXT_PUBLIC_SUPABASE_URL`. Set that URL
at build time. Local Supabase hosts remain subject to Next.js's default private-IP
image-fetch restrictions; use hosted storage when verifying optimized images.

## Automated verification

`npm test` runs SQL regression tests using the pinned PGlite development
dependency, without hosted database credentials. The SQL suites cover bounded
catalogue pagination, search, preview visibility, payment settlement, inventory,
and retrying reviewed payments after stock repair. Their minimal domain fixtures
are not a replacement for testing all migrations and production RLS policies
against a staging Supabase database.

GitHub Actions runs lint, typechecking, all tests, and a production build. For
performance comparisons, use the same catalogue and device/network conditions
before and after deployment, and record image transfer sizes, storefront response
sizes, page-load timings, and the catalogue RPC duration.
