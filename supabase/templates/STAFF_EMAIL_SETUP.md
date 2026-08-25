# Staff invitation email setup

The staff flow uses two Supabase Auth templates because it supports both new
employees and employees who already have a Carborony account.

## Hosted Supabase project

1. Open **Authentication → Email Templates** in the Supabase dashboard.
2. Select **Invite user**.
3. Set the subject to `You’re invited to {{ .Data.business_name }} on Carborony`.
4. Paste the complete contents of `staff-invite.html` into the message body and save.
5. Select **Magic Link**.
6. Set the subject to `Review your Carborony staff invitation`.
7. Paste the complete contents of `staff-magic-link.html` into the message body and save.
8. Open **Authentication → URL Configuration**.
9. Set the production **Site URL** and add these redirect URLs:
   - `http://localhost:3000/staff/invitations/**`
   - `https://YOUR_PRODUCTION_DOMAIN/staff/invitations/**`

The templates send the token hash through `/auth/confirm`, allowing the Next.js
server to exchange it for an authenticated cookie before rendering the protected
invitation page.

## Server environment

Add the current project secret key only to the server environment:

```dotenv
SUPABASE_SECRET_KEY=your-project-secret-key
```

The legacy `SUPABASE_SERVICE_ROLE_KEY` name is also supported. Never expose
either value through a `NEXT_PUBLIC_` variable. Configure custom SMTP
before production use so invitation delivery is not limited by Supabase's default
mailer.

## Local Supabase CLI (optional)

If local email templates are configured in `supabase/config.toml`, point the
invite and magic-link template `content_path` values at these two HTML files.
