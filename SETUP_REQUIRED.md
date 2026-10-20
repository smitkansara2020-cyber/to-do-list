# Setup Required (Pending User Authorization / Return)

> **Notice**: As per autonomous working guidelines, all features requiring live credentials, secret API keys, payment authorizations, DNS alterations, or production cloud deployments are prepared locally and deferred here for your safe return.

---

### 1. 🔑 Google & Microsoft OAuth Credentials (Two-Way Calendar Sync)
- [ ] **Google Cloud Console**: Create OAuth 2.0 Client ID (Web Application) with redirect URI `https://<your-domain>/auth/callback/google-calendar`. Enable `Google Calendar API`.
- [ ] **Microsoft Entra / Azure Portal**: Create App Registration with `Calendars.ReadWrite` permissions and redirect URI `https://<your-domain>/auth/callback/outlook-calendar`.
- [ ] Enter `VITE_GOOGLE_CLIENT_ID` and `VITE_MICROSOFT_CLIENT_ID` in `.env`.
- [ ] Local sync engine & mock tests already verified: `src/lib/calendar/calendar-provider.ts` & `src/lib/calendar/calendar-sync.test.ts`.

### 2. 🗄️ Database Migrations (Supabase)
- [ ] Run prepared SQL migrations in Supabase SQL editor:
  - `supabase/migrations/20261020_shared_boards.sql`: Adds tables `boards`, `board_members`, and Row Level Security policies.
  - `supabase/migrations/20261020_web_push.sql`: Adds table `web_push_subscriptions` for offline reminders.
  - `supabase/migrations/20261020_task_attachments.sql`: Adds task attachments storage bucket and RLS policies.
- [ ] *Note*: The client app currently utilizes backward-compatible JSON metadata fallback (`__PINBOARD_META__:<payload>`) so the app works seamlessly even before migrations are applied.

### 3. ✉️ Custom Branded Email & SMTP Service
- [ ] Provide custom SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) in Supabase Auth -> Email Settings.
- [ ] Review email templates in `src/lib/email-templates/verify-email.html` and `src/lib/email-templates/reset-password.html`.

### 4. 🔔 Web Push Notifications Keys (VAPID)
- [ ] Generate VAPID keypair (`npx web-push generate-vapid-keys`).
- [ ] Add `VITE_VAPID_PUBLIC_KEY` in `.env` and `VAPID_PRIVATE_KEY` in Supabase vault / server secrets.
- [ ] Web Push service worker handler is configured in `public/sw.js` and client logic in `src/lib/push-notifications.ts`.

### 5. 🌐 Production Deployment & Custom Domain
- [ ] Connect repository to Vercel or Cloudflare Pages (pre-configured with `vercel.json` SPA rewrites & security headers).
- [ ] Configure custom domain DNS records (CNAME / A records with SSL).

### 6. 💻 Native Windows Desktop Packaging (Tauri)
- [ ] Run `npm run tauri build` on your Windows developer machine with Visual Studio C++ Build Tools installed to produce the `.msi` / `.exe` installer.
- [ ] Configured in `src-tauri/tauri.conf.json` with system tray, minimize-to-tray, and always-on-top focus widget.
