# Build Progress — movr-cursor-build-prompts

## Latest: Phases 25–28 (playbook complete for active phases)

| Phase | Status | Artifacts |
|---|---|---|
| 25 Dynamic pricing | Done | `025_dynamic_pricing.sql`, `pricing-engine.service.ts`, admin `PricingEnginePage`, fare `surgeReason` on estimates |
| 26 National ID linking | Done | `026_national_id_linking.sql`, Ghana Card / DVLA verifiers, `linkIdentityDocuments`, `IdentityLinkPage`, driver `IdentityOnboardingScreen` |
| 27 Cross-border transfers | Done | `027_cross_border_transfers.sql`, `wallet-transfer.service.ts`, quote/transfer/claim routes, `SendMoneyScreen` |
| 28 Trip recording | Done | `028` + consent/`trip_recordings`, `trip-recording.service.ts` (local + async upload), admin playback gate, driver recording panel |

## Still ON HOLD
5B, 7, 8, 9 — token / staking / claims / staking-webapp

## Hygiene
- Apply `init.sql` then migrations `001`→`028` in order
- `TRIP_RECORDING_ENABLED=false` until legal review
- Gov ID APIs (NIA/DVLA) degrade to OCR + manual review without credentials
