# MOVR Design System

Single source of truth for brand tokens across web, admin, and mobile.

## Tokens

- `tokens.json` — colors, gradient, type, spacing, radius, elevation, admin density, marketing motion
- `theme.ts` — same tokens as JS objects for React Native
- `tokens.css` — CSS custom properties
- `tailwind.preset.js` — Tailwind preset that **imports** `tokens.json` (do not hardcode hex in app configs)

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

`frontend/web` and `frontend/admin` use:

```js
presets: [require('../../design-system/tailwind.preset.js')]
```

Classes: `bg-jet-black`, `text-electric-violet`, `bg-movr-gradient`, `rounded-pill`, `shadow-focus-glow`.

Fonts: **Poppins** (primary), **Montserrat** (secondary) via Google Fonts in each app's `index.html`.

### Marketing hero (homepage / merchant / driver landings only)

```html
<section class="movr-hero">
  <div class="movr-hero-glow movr-hero-glow-a"></div>
  <div class="movr-hero-glow movr-hero-glow-b"></div>
  <div class="movr-hero-shimmer"></div>
  …
</section>
```

Respects `prefers-reduced-motion: reduce`. Do **not** use these classes inside product UI.

## Admin density

Admin Tailwind adds tighter `admin-*` spacing and `text-admin-*` sizes. Prefer:

- `frontend/admin/src/components/DataTable.tsx`
- `FilterBar.tsx`
- `DetailPanel.tsx`

for ops/finance/identity review — not consumer Card layouts.

## Mobile

```tsx
import theme from '@movr/design-system/theme';
import { Button } from '@movr/design-system/components/Button';
import { Tab } from '@movr/design-system/components/Tab';
```

Shared components: Button, Input, Card, Badge, Tab, StatusPill, EmptyState, LoadingSpinner, VerifiedBadge.

## Logo

Official assets in `assets/logo/`:

- `movr-mark.svg` — square mark
- `movr-wordmark.svg` — mark + wordmark

Web: `MovrWordmark` / `MovrLogoMark`. Minimum height **24px**. Never recreate "MOVR" as styled text.

## Content

See `CONTENT_GUIDE.md` for tone-of-voice rules.

## Lint

```bash
pnpm lint:tokens          # report raw hex outside design-system
pnpm lint:tokens:strict   # fail CI if any remain
```
