/**
 * Admin vehicle types & pricing routes (Phase 24).
 * Implementation lives on `adminVehicleRouter` in channels.routes.ts
 * (mounted at `/api/v1/admin/vehicle-types`).
 * Public rider source of truth: `GET /api/v1/vehicle-types?region=...`
 * (`vehicle-types.routes.ts`).
 */
export { adminVehicleRouter as adminVehiclePricingRouter } from './channels.routes';
