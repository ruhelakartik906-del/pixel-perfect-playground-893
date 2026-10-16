# Plan: Functional Routiva CRM authentication

## Scope
Build the login, registration, password reset, approval-state routing, protected dashboard, pending approval, blocked account, and logout flow. Keep the existing public website design unchanged.

## What will change
- Replace the placeholder Login and Get Started pages with real forms.
- Add Forgot Password and Reset Password pages.
- Add protected CRM pages for Dashboard and Pending Approval / Restricted Access.
- Make public CTA links that start account creation go to `/register`.
- Use Lovable Cloud authentication for real signup, login, logout, password recovery, and sessions.
- Store user profile data with pending approval by default.

## Database and access rules
- Create a `profiles` table for full name, email, phone, company name, role, account status, avatar, and timestamps.
- New signups get:
  - role: `client`
  - account status: `pending`
- Users can read their own profile and update safe personal fields only.
- Users cannot update their own role or approval status.
- Admin-only approval actions will be reserved for a later admin panel, unless already present in the project.

## Authentication behavior
- Login validates the form and signs in with email/password.
- Active users go to `/dashboard`.
- Pending users go to `/pending-approval`.
- Blocked users go to a restricted access page.
- Existing sessions are respected on refresh.
- Logout clears the session and returns to `/login`.
- Registration creates a real account and shows email verification / approval guidance.
- Password recovery sends a reset email and `/reset-password` lets the user set a new password.

## UI behavior
- Use the existing Routiva visual system: white/light-blue background, centered premium cards, rounded fields, blue actions.
- The dashboard uses the requested CRM direction: dark navy sidebar, light workspace, white metric cards, and royal blue actions.
- No homepage, navbar, footer, color, or public-section redesign.

## Verification
- Check that the auth pages load.
- Check invalid login shows an error.
- Check protected dashboard redirects when signed out.
- Check the new pages have route metadata.
- Check build output after changes and fix any errors.
