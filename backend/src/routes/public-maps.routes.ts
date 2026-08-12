import { Router, Response } from 'express';
import { DatabaseService } from '../services/database.service';
import { IntegrationsService } from '../services/integrations.service';

const db = new DatabaseService();
const integrations = new IntegrationsService(db);

/**
 * Public maps — Places autocomplete / details / geocode for homepage + rider booking.
 * Uses Google Maps key from Integrations Hub (or GOOGLE_MAPS_API_KEY env).
 */
export const publicMapsRouter = Router();

publicMapsRouter.get('/places', async (req: any, res: Response) => {
  try {
    const q = String(req.query.q || req.query.input || '');
    const country = req.query.country ? String(req.query.country) : undefined;
    const sessionToken = req.query.sessionToken ? String(req.query.sessionToken) : undefined;
    const data = await integrations.placesAutocomplete(q, { country, sessionToken });
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
  }
});

publicMapsRouter.get('/place-details', async (req: any, res: Response) => {
  try {
    const placeId = String(req.query.placeId || '');
    const data = await integrations.placeDetails(placeId);
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
  }
});

publicMapsRouter.get('/geocode', async (req: any, res: Response) => {
  try {
    const address = String(req.query.address || req.query.q || '');
    const data = await integrations.geocodeAddress(address);
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
  }
});

publicMapsRouter.get('/status', async (_req: any, res: Response) => {
  try {
    const key = await (integrations as any).resolveGoogleMapsKey?.();
    res.json({
      status: 'success',
      data: {
        configured: Boolean(key),
        provider: 'google_maps',
        hint: key
          ? 'Places autocomplete ready'
          : 'Add google_maps api_key in Admin → Integrations Hub',
      },
    });
  } catch {
    res.json({
      status: 'success',
      data: { configured: false, provider: 'google_maps' },
    });
  }
});
