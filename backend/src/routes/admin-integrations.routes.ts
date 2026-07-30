import { Router, Response } from 'express';
import { AuthRequest, authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { IntegrationsService } from '../services/integrations.service';

const db = new DatabaseService();
const integrations = new IntegrationsService(db);

export const adminIntegrationsRouter = Router();

adminIntegrationsRouter.use(authenticateToken, requireAdmin);

adminIntegrationsRouter.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await integrations.listIntegrations();
    res.json({ status: 'success', data: rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminIntegrationsRouter.get('/:key', async (req: AuthRequest, res: Response) => {
  try {
    const detail = await integrations.getIntegration(req.params.key);
    if (!detail) {
      return res.status(404).json({ status: 'error', message: 'Integration not found' });
    }
    res.json({ status: 'success', data: detail });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminIntegrationsRouter.put('/:key/credentials', async (req: AuthRequest, res: Response) => {
  try {
    const detail = await integrations.saveCredentials(
      req.params.key,
      req.body.credentials || req.body,
      req.user?.id
    );
    res.json({ status: 'success', data: detail });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

adminIntegrationsRouter.post('/:key/test', async (req: AuthRequest, res: Response) => {
  try {
    const result = await integrations.testConnection(req.params.key);
    res.json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

adminIntegrationsRouter.patch('/:key/enable', async (req: AuthRequest, res: Response) => {
  try {
    const detail = await integrations.setEnabled(req.params.key, true, req.user?.id);
    res.json({ status: 'success', data: detail });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

adminIntegrationsRouter.patch('/:key/disable', async (req: AuthRequest, res: Response) => {
  try {
    const detail = await integrations.setEnabled(req.params.key, false, req.user?.id);
    res.json({ status: 'success', data: detail });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});
