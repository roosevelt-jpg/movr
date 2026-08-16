# Play Store readiness — content + hosts

## Legal URLs (must be live before production review)

Defaults live in `backend/src/scripts/cms-playstore-pages.ts`. Edit anytime in **Admin → Site content**.

| URL | Slug | Purpose |
|-----|------|---------|
| https://mymovr.io/privacy | `privacy` | Privacy policy (Play Data safety link) |
| https://mymovr.io/terms | `terms` | Terms of Service |
| https://mymovr.io/cookies | `cookies` | Cookie policy |
| https://mymovr.io/delete-account | `delete-account` | Account deletion + form |
| https://mymovr.io/data-safety | `data-safety` | Play Console Data safety helper copy |
| https://mymovr.io/app-permissions | `app-permissions` | Permission justifications |
| https://mymovr.io/play-store-listing | `play-store-listing` | Short/full description copy |
| https://mymovr.io/refund-policy | `refund-policy` | Refunds |
| https://mymovr.io/community-guidelines | `community-guidelines` | Conduct |
| https://mymovr.io/child-safety | `child-safety` | CSAE / child safety |
| https://mymovr.io/driver-terms | `driver-terms` | Driver partner terms |
| https://mymovr.io/support | `support` | Support + contact form |
| https://mymovr.io/contact | `contact` | Contact form |

Apps also delete from **Settings → Delete account** (customer) and **Account → Delete account** (driver). `POST /api/v1/me/account/delete` anonymizes the profile.

## Expo hosts (AAB builds)

- Customer: `mobile/customer-app` → package `io.movr.app`
- Driver: `mobile/driver-app` → package `io.movr.driver`

Icons, splash, notification glyph, 512×512 Play icon, and 1024×500 feature graphic are generated:

```bash
node scripts/generate-store-icons.mjs
```

Listing **screenshots** are still on you. Drop them in:

- `mobile/customer-app/store/screenshots/`
- `mobile/driver-app/store/screenshots/`

Then upload in Play Console (the repo does not publish them automatically).

```bash
cd mobile/customer-app
# 1. Create an Expo project and paste the UUID into extra.eas.projectId in app.json
npx eas-cli login
npx eas init
# 2. Firebase Console → download google-services.json into this folder (Android app io.movr.app)
# 3. Play Console → API access → service account JSON as play-service-account.json
npx eas build --platform android --profile production
npx eas submit --platform android --profile production
```

Repeat for `mobile/driver-app` (`io.movr.driver`).

`app.config.js` only wires `google-services.json` when the file exists, so EAS builds still work before FCM is added.

## You still need (cannot be done in git)

- [ ] Expo `projectId` UUIDs in both `app.json` files (`npx eas init`)
- [ ] Real `google-services.json` from Firebase for each package
- [ ] `play-service-account.json` for `eas submit`
- [ ] Phone screenshots (min 2 per app)
- [ ] Confirm https://mymovr.io/privacy and `/delete-account` load publicly
- [ ] Fill Play Console Data safety from `/data-safety`
- [ ] Content rating questionnaire, target audience 18+, not for children
- [ ] News, financial, and location declarations as prompted

Driver location uses a **foreground service while online**. Android background-location (`ACCESS_BACKGROUND_LOCATION`) is blocked so Play does not ask for the restricted background-location declaration.

## Third-party APIs (Admin → Integrations Hub)

| Integration | Needed for |
|-------------|------------|
| Paystack / Flutterwave | MoMo + card |
| Twilio / WhatsApp / SendGrid | OTP + channels |
| Google Maps | Places / geocode / reverse GPS label |
| OpenAI | Movr AI / voice |
| Firebase FCM / Expo Push | Notifications |
| Sentry | Crash reporting |
| AWS S3 | Media uploads |

Payment country routing: **Admin → Payment providers**.
