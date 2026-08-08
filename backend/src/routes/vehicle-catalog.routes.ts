import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database.service';
import { VehicleCatalogService } from '../services/vehicle-catalog.service';

const db = new DatabaseService();
const catalog = new VehicleCatalogService(db);

export const publicVehicleCatalogRouter = Router();

/** Autocomplete vehicle makes (global DB + NHTSA cache). */
publicVehicleCatalogRouter.get('/vehicles/makes', async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || req.query.query || '');
    const limit = Number(req.query.limit) || 25;
    const data = await catalog.searchMakes(q, limit);
    res.json({
      status: 'success',
      data: data.map((m) => ({ id: m.id, name: m.name })),
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** Autocomplete models for a make (optionally filtered by year). */
publicVehicleCatalogRouter.get('/vehicles/models', async (req: Request, res: Response) => {
  try {
    const make = String(req.query.make || '');
    if (!make) {
      return res.status(400).json({ status: 'error', message: 'make is required' });
    }
    const q = String(req.query.q || req.query.query || '');
    const year = req.query.year ? Number(req.query.year) : undefined;
    const limit = Number(req.query.limit) || 40;
    const data = await catalog.searchModels(make, q, year, limit);
    res.json({
      status: 'success',
      data: data.map((m) => ({
        id: m.id,
        makeId: m.make_id,
        make: m.make_name,
        name: m.name,
        bodyStyle: m.body_style || null,
        yearStart: m.year_start || null,
        yearEnd: m.year_end || null,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** Model years for make (+ optional model). */
publicVehicleCatalogRouter.get('/vehicles/years', async (req: Request, res: Response) => {
  try {
    const make = String(req.query.make || '');
    if (!make) {
      return res.status(400).json({ status: 'error', message: 'make is required' });
    }
    const model = String(req.query.model || '');
    const years = await catalog.listYears(make, model || undefined);
    res.json({ status: 'success', data: years });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** Combined typeahead suggestions. */
publicVehicleCatalogRouter.get('/vehicles/suggest', async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || req.query.query || '');
    const limit = Number(req.query.limit) || 20;
    const data = await catalog.suggest(q, limit);
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * Decode VIN / chassis number via NHTSA global automobile database.
 * Autocompletes make, model, year, body, fuel, transmission.
 */
publicVehicleCatalogRouter.get('/vehicles/decode-vin/:vin', async (req: Request, res: Response) => {
  try {
    const result = await catalog.decodeVin(req.params.vin);
    if (!result.ok) {
      return res.status(400).json({ status: 'error', message: result.message, data: result });
    }
    res.json({
      status: 'success',
      data: {
        ...result,
        vehicleTypeHint: catalog.mapBodyToVehicleType(result.bodyStyle || result.vehicleType),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

publicVehicleCatalogRouter.post('/vehicles/decode-vin', async (req: Request, res: Response) => {
  try {
    const result = await catalog.decodeVin(String(req.body?.vin || req.body?.chassis || ''));
    if (!result.ok) {
      return res.status(400).json({ status: 'error', message: result.message, data: result });
    }
    res.json({
      status: 'success',
      data: {
        ...result,
        vehicleTypeHint: catalog.mapBodyToVehicleType(result.bodyStyle || result.vehicleType),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});
