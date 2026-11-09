# Login email OTP setup

Login now requires email + password, then a 6–8 digit email code. Password checks use an isolated server client; the browser receives session cookies only after code verification. The verification endpoint checks the password again. Passwords stay in component memory and are never stored in browser storage.

In hosted Supabase, open Authentication → Email Templates → Magic Link and install `staff-magic-link.html`. This shared template contains `{{ .Token }}` for login and retains the staff invitation link. Set a general subject such as “Your Noddar sign-in code”. Keep the OTP length between 6 and 8 digits. The Reset Password template is separate.

The application uses `signInWithOtp` with `shouldCreateUser: false`, and `verifyOtp` with type `email`. Resend repeats the password check and has a 60-second UI cooldown; Supabase enforces provider rate limits and expiry.

This is an application login step, not Supabase AAL2 MFA. Supabase password authentication remains available at its public API; database policies requiring stronger authentication need a separate MFA design.

Run `node --test tests/login-otp.test.mjs` and `npm run test:auth`. For delivery validation, use a test account to submit a password, confirm protected pages remain inaccessible, enter an incorrect code, resend after cooldown, verify the latest code, and confirm the intended destination opens. Check Auth and SMTP logs if mail does not arrive.
