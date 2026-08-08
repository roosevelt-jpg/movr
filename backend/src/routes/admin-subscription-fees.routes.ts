import { Router, Response } from 'express';
import {
  AuthRequest,
  authenticateToken,
  requireAdmin,
} from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import {
  SubscriptionFeeService,
  SubscriptionAudience,
} from '../services/subscription-fee.service';

const db = new DatabaseService();
const fees = new SubscriptionFeeService(db);

export const adminSubscriptionFeesRouter = Router();

adminSubscriptionFeesRouter.get(
  '/subscription-fees/plans',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await fees.listPlans({
        audience: (req.query.audience as string) || undefined,
        countryCode: (req.query.country as string) || undefined,
        activeOnly: req.query.all === '1' ? false : true,
      });
      res.json({ status: 'success', data });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

adminSubscriptionFeesRouter.put(
  '/subscription-fees/plans',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      if (req.body.amount == null || Number.isNaN(Number(req.body.amount))) {
        return res.status(400).json({ status: 'error', message: 'amount required' });
      }
      const row = await fees.upsertPlan(req.body);
      await db
        .query(
          `INSERT INTO audit_log (admin_id, action, resource_type, resource_id, reason, metadata)
           VALUES ($1,'subscription_plan_upsert','plan',$2,$3,$4::jsonb)`,
          [
            req.user!.id,
            row.id,
            req.body.reason || 'Upsert subscription plan',
            JSON.stringify({ amount: row.amount, audience: row.audience }),
          ]
        )
        .catch(() => undefined);
      res.json({ status: 'success', data: row });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

adminSubscriptionFeesRouter.get(
  '/subscription-fees/rules',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await fees.listRules((req.query.audience as string) || undefined);
      res.json({ status: 'success', data });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

adminSubscriptionFeesRouter.put(
  '/subscription-fees/rules',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.body.audience || !req.body.plan_id) {
        return res.status(400).json({ status: 'error', message: 'audience and plan_id required' });
      }
      const row = await fees.upsertRule(req.body);
      res.json({ status: 'success', data: row });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

adminSubscriptionFeesRouter.post(
  '/subscription-fees/resolve',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const audience = (req.body.audience || 'driver') as SubscriptionAudience;
      let ctx = {
        audience,
        countryCode: req.body.countryCode || req.body.country_code || null,
        city: req.body.city || null,
        vehicleCategory: req.body.vehicleCategory || req.body.vehicle_category || null,
        vehicleTypeCode: req.body.vehicleTypeCode || req.body.vehicle_type_code || null,
        interval: (req.body.interval || 'monthly') as 'weekly' | 'monthly',
        userId: req.body.userId || undefined,
      };
      if (req.body.userId) {
        const inferred = await fees.inferContextFromUser(req.body.userId, audience);
        ctx = {
          ...inferred,
          ...Object.fromEntries(
            Object.entries(ctx).filter(([, v]) => v != null && v !== '')
          ),
          audience,
        } as typeof ctx;
      }
      const data = await fees.resolve(ctx);
      res.json({ status: 'success', data });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

adminSubscriptionFeesRouter.get(
  '/subscription-fees/preview',
  authenticateToken,
  requireAdmin,
  async (_req: AuthRequest, res: Response) => {
    try {
      const data = await fees.previewMatrix();
      res.json({
        status: 'success',
        data,
        meta: {
          model: 'flat_subscription_not_commission',
          note: 'Drivers keep 100% of fare. MOVR charges recurring subscriptions by vehicle size, country, and city.',
        },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);
