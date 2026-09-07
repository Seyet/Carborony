# Password recovery email setup

The app uses this flow: `/forgot-password` → email code verification →
`/reset-password` → sign in with the new password.

## Hosted Supabase

1. Open **Authentication → Email Templates → Reset Password**.
2. Set the subject to `Reset your Carborony password`.
3. Paste `password-recovery.html` into the body and save.
4. Ensure the email OTP length is between 6 and 8 digits; the form accepts
   those lengths. Supabase controls expiry and rate limits.

The template must contain `{{ .Token }}` so the user receives a code. The default
link-only recovery email does not support the app's code-entry step. Keep the
existing Site URL, redirect allowlist, and SMTP configuration valid. Existing
recovery links remain supported through `/auth/callback` and `/auth/confirm`.

The server requests the email using `resetPasswordForEmail`, verifies the code
with `verifyOtp({ email, token, type: "recovery" })`, and writes the session into
cookies. The reset page and API require recent email verification before allowing
a password change. The request response does not disclose whether an account
exists. No service-role key is required for this flow.

For local Supabase, merge this section into your existing `supabase/config.toml`:

```toml
[auth.email.template.recovery]
subject = "Reset your Carborony password"
content_path = "./supabase/templates/password-recovery.html"
```

## Verification

Run `npm run test:auth` for the automated recovery service checks.

With a test account, request a code, enter an incorrect code, resend after the
cooldown, verify the newest code, and choose a new password. Confirm that the old
code cannot be reused and the new password works at sign-in. Also check unknown
email addresses, expired codes, and opening `/reset-password` without verification.

References: [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
and [OTP verification](https://supabase.com/docs/reference/javascript/auth-verifyotp).
