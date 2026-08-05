# MOVR Design System

Single source of truth for brand tokens across web, admin, and mobile.

## Tokens

- `tokens.json` — colors, gradient, type, spacing, radius, elevation
- `theme.ts` — same tokens as JS objects for React Native

### Brand colors

| Token | Hex | Use |
|---|---|---|
| jetBlack | `#000000` | App background |
| pureWhite | `#FFFFFF` | Primary text / logo on black |
| electricViolet | `#6A00FF` | Accent |
| motionBlue | `#0055FF` | Accent |
| movrGreen | `#3F7048` | Brand (gradient stop only — not semantic success) |

Primary gradient (CTAs / active indicators / hero bands only):

`linear-gradient(135deg, #3F7048 0%, #6A00FF 50%, #0055FF 100%)`

## Web (Tailwind)

Import via `frontend/web/tailwind.config.js` and `frontend/admin/tailwind.config.js`.

Use classes like `bg-jet-black`, `text-electric-violet`, `rounded-pill` — never hardcode hex in components.

Fonts: **Poppins** (primary), **Montserrat** (secondary).

## Mobile

```tsx
import theme from '@movr/design-system/theme';
import { Button } from '@movr/design-system/components/Button';
```

Both `mobile/customer` and `mobile/driver` must import from this package — do not duplicate components.

## Logo

Official assets in `assets/logo/`:
- `movr-mark.svg` — square mark
- `movr-wordmark.svg` — mark + wordmark

Always use these (or `MovrLogoMark` on web) — never recreate "MOVR" / "M" as styled text. Minimum height 24px; respect 0.5× cap-height safe area.

## Lint

Run `node scripts/check-raw-hex.js` to catch hardcoded hex outside this folder.
