# Play Store readiness — content + hosts

## What was created

### Admin-editable pages (Site content / CMS)
Defaults live in `backend/src/scripts/cms-playstore-pages.ts`. Edit anytime in **Admin → Site content**.

| URL | Slug | Purpose |
|-----|------|---------|
| https://mymovr.io/privacy | `privacy` | Privacy policy (Play Data safety link) |
| https://mymovr.io/terms | `terms` | Terms of Service |
| https://mymovr.io/cookies | `cookies` | Cookie policy |
| https://mymovr.io/delete-account | `delete-account` | **Required** account deletion + form |
| https://mymovr.io/data-safety | `data-safety` | Play Console Data safety helper copy |
| https://mymovr.io/app-permissions | `app-permissions` | Permission justifications |
| https://mymovr.io/play-store-listing | `play-store-listing` | Short/full description copy |
| https://mymovr.io/refund-policy | `refund-policy` | Refunds |
| https://mymovr.io/community-guidelines | `community-guidelines` | Conduct |
| https://mymovr.io/child-safety | `child-safety` | CSAE / child safety |
| https://mymovr.io/driver-terms | `driver-terms` | Driver partner terms |
| https://mymovr.io/support | `support` | Support + contact form |
| https://mymovr.io/contact | `contact` | Contact form |

To load / refresh defaults without wiping other pages: restart API (`ensureCmsDefaults`) or Admin → **Ensure defaults**.  
To reset legal pack after editing seed: Admin → **Seed** (overwrites all seed slugs) — or set page `meta.adminLocked: true` in DB to skip pack refresh.

### Expo hosts (AAB builds)
- Customer: `mobile/customer-app` → package `io.movr.app`
- Driver: `mobile/driver-app` → package `io.movr.driver`

```bash
cd mobile/customer-app
# add placeholder icons under ./assets (icon.png, splash.png, adaptive-icon.png)
npx eas-cli login
npx eas build --platform android --profile production
```

### Third-party APIs (only keys left)
**Admin → Integrations Hub** — paste keys for:

| Integration | Needed for |
|-------------|------------|
| Paystack / Flutterwave | MoMo + card |
| Twilio / WhatsApp / SendGrid | OTP + channels |
| Google Maps | Places / geocode |
| OpenAI | Movr AI / voice |
| Firebase FCM / Expo Push | Notifications |
| Sentry | Crash reporting |
| AWS S3 | Media uploads |

Payment country routing: **Admin → Payment providers**.

## Play Console checklist
- [ ] Privacy policy URL → `/privacy`
- [ ] Account deletion URL → `/delete-account`
- [ ] Data safety form ← copy from `/data-safety`
- [ ] Listing text ← `/play-store-listing`
- [ ] Replace Expo `assets/*` icons
- [ ] Set EAS `projectId` in `app.json`
- [ ] Add `play-service-account.json` for `eas submit`
- [ ] Internal testing track → production
