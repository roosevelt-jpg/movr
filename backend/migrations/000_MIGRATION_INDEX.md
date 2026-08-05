# MOVR Migration Index

Strict 3-digit zero-padded sequential numbers. No letter suffixes.
Old playbook names map to these filenames — use the **new** name everywhere.

| Old filename | New filename | Phase |
|---|---|---|
| 000A_payment_provider_config.sql | 001_payment_provider_config.sql | 0A |
| 000B_integrations_hub.sql | 002_integrations_hub.sql | 0C |
| 002_super_app_shell.sql | 003_super_app_shell.sql | 1 |
| 003_marketplace.sql | 004_marketplace.sql | 2 |
| 004_merchant_portal.sql | 005_merchant_portal.sql | 3 |
| 005_delivery_control.sql | 006_delivery_control.sql | 4 |
| 005A_kyc_attestation.sql | 007_kyc_attestation.sql | 5A |
| 006_token_system.sql | 008_token_system.sql | 5B |
| 007_points.sql | 009_points.sql | 6 |
| 008_staking.sql | 010_staking.sql | 7 |
| 009_claims.sql | 011_claims.sql | 8 |
| 010_referrals.sql | 012_referrals.sql | 10 |
| 011_delivery_enhancements.sql | 013_delivery_enhancements.sql | 11 |
| 012_driver_performance.sql | 014_driver_performance.sql | 13 |
| 013_subscription_extensions.sql | 015_subscription_extensions.sql | 14 |
| 014_rental_expansion.sql | 016_rental_expansion.sql | 15 |
| 015_rewards_engine.sql | 017_rewards_engine.sql | 16 |
| 016_ops_console.sql | 018_ops_console.sql | 17 |
| 017_financial_engine.sql | 019_financial_engine.sql | 18 |
| 018_inbox.sql | 020_inbox.sql | 19 |
| 019_multi_country.sql | 021_multi_country.sql | 20 |
| 020_perf_indexes.sql | 022_perf_indexes.sql | 21 |
| 021_alt_channels.sql | 023_alt_channels.sql | 22 |
| 022_vehicle_types_pricing.sql | 024_vehicle_types_pricing.sql | 24 |
| 023_dynamic_pricing.sql | 025_dynamic_pricing.sql | 25 |
| 024_national_id_linking.sql | 026_national_id_linking.sql | 26 |
| 025_cross_border_transfers.sql | 027_cross_border_transfers.sql | 27 |
| 026_trip_recording.sql / legacy `001_add_security_features.sql` | 028_trip_recording.sql | 28 |

## Later append-only migrations (after the original 0D map)

| Filename | Purpose |
|---|---|
| 029_ride_experience.sql | Ride experience extras |
| 030_africa_currencies.sql | Africa-wide currencies + city pricing / FX |
| 031_cms.sql | CMS pages + sections for marketing content |

## Notes

- Baseline schema lives in `backend/scripts/init.sql` (users, rides, payments, etc.).
- Migrations are ordered by **execution order**, not gap-analysis row number.
- If a future phase must insert between existing migrations, append at the end with the next number.
- Phases 5B / 7 / 8 / 9 (token / staking / claims / staking webapp) remain **on hold** for live enablement (flags off until legal/privacy go-ahead).
- Brand logo files live in `design-system/assets/logo/` — do not recreate the mark as styled text.
