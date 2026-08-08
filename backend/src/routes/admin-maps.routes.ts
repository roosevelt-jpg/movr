import { Router, Response } from 'express';
import { AuthRequest, authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { IntegrationsService } from '../services/integrations.service';

const db = new DatabaseService();
const integrations = new IntegrationsService(db);

export const adminMapsRouter = Router();

adminMapsRouter.use(authenticateToken, requireAdmin);

/** Places Autocomplete — power zone pickers from Google Maps & Places. */
adminMapsRouter.get('/places', async (req: AuthRequest, res: Response) => {
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

/** Place Details — lat/lng + country for zone creation. */
adminMapsRouter.get('/place-details', async (req: AuthRequest, res: Response) => {
  try {
    const placeId = String(req.query.placeId || '');
    const data = await integrations.placeDetails(placeId);
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
  }
});

/** Geocode free-text address into a zone center. */
adminMapsRouter.get('/geocode', async (req: AuthRequest, res: Response) => {
  try {
    const address = String(req.query.address || req.query.q || '');
    const data = await integrations.geocodeAddress(address);
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
  }
});
