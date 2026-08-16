import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { getPushService } from '../services/push.service';

const db = new DatabaseService();
const push = getPushService(db);

export const devicesRouter = Router();

devicesRouter.use(authenticateToken);

async function register(req: AuthRequest, res: Response) {
  try {
    const token = String(req.body.token || req.body.fcmToken || req.body.fcm_token || '').trim();
    if (!token) {
      return res.status(400).json({ status: 'error', message: 'Push token is required' });
    }
    await push.registerToken({
      userId: req.user!.id,
      token,
      platform: String(req.body.platform || 'android'),
      app: String(req.body.app || 'customer'),
      provider: req.body.provider,
    });
    res.json({ status: 'success', data: { registered: true } });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message || 'Could not register device' });
  }
}

devicesRouter.post('/fcm', register);
devicesRouter.post('/push', register);

devicesRouter.delete('/fcm', async (req: AuthRequest, res: Response) => {
  try {
    const token = String(req.body?.token || req.query.token || '').trim();
    await push.unregisterToken(req.user!.id, token || undefined);
    res.json({ status: 'success', data: { unregistered: true } });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

devicesRouter.delete('/push', async (req: AuthRequest, res: Response) => {
  try {
    const token = String(req.body?.token || req.query.token || '').trim();
    await push.unregisterToken(req.user!.id, token || undefined);
    res.json({ status: 'success', data: { unregistered: true } });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});
