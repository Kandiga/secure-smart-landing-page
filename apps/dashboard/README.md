# Secure Smart Dashboard

Internal CRM/ERP dashboard foundation for Secure Smart.

Status: scaffold only. Do not deploy publicly until Supabase, RLS, auth, and protected routes are configured.

## Purpose

- Admin login for Netanel and Jeff.
- Trade application approval queue.
- Orders cockpit fed by website order/webhook events.
- Clear separation between customer sale pricing and internal purchasing power/cost data.
- Mobile-friendly order cards and desktop operations table.

## Local next steps

1. Create Supabase project.
2. Apply SQL migration in `../../supabase/migrations/20260503_secure_smart_foundation.sql`.
3. Copy `.env.example` to `.env.local` and fill values locally.
4. Install dependencies:
   `npm install`
5. Run locally:
   `npm run dev`

Never put service-role keys in browser code. Only server routes/actions may use `SUPABASE_SERVICE_ROLE_KEY`.
