import { Router, Response } from 'express';
import { AuthRequest, authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { TokenService } from '../services/token.service';

const db = new DatabaseService();
const tokens = new TokenService(db);

export const tokenRouter = Router();

tokenRouter.use(authenticateToken);

tokenRouter.get('/balance', async (req: AuthRequest, res: Response) => {
  try {
    const balance = await tokens.getBalance(req.user!.id);
    const wallet = await tokens.ensureCustodialWallet(req.user!.id);
    res.json({ status: 'success', data: { ...balance, address: wallet.address } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

tokenRouter.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const history = await tokens.getHistory(req.user!.id);
    res.json({ status: 'success', data: history });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

tokenRouter.post('/redeem', async (req: AuthRequest, res: Response) => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ status: 'error', message: 'amount required' });
    }
    const result = await tokens.redeem(req.user!.id, amount);
    res.json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

tokenRouter.post('/sync', async (req: AuthRequest, res: Response) => {
  try {
    const result = await tokens.syncOnchainBalance(req.user!.id);
    res.json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

tokenRouter.get('/claim/eligibility', async (req: AuthRequest, res: Response) => {
  try {
    const eligibility = await tokens.getClaimEligibility(req.user!.id);
    res.json({ status: 'success', data: eligibility });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

tokenRouter.post('/claim/mark-claimed', async (req: AuthRequest, res: Response) => {
  try {
    const { allocationId, txHash } = req.body;
    const result = await tokens.markClaimed(req.user!.id, allocationId, txHash);
    res.json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

tokenRouter.post('/claim/custodial', async (req: AuthRequest, res: Response) => {
  try {
    const result = await tokens.claimCustodial(req.user!.id);
    res.json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

/**
 * Admin — create Merkle airdrop snapshot so users can claim (Phase 8).
 * Body: { label?, allocations: [{ userId?, address?, amount }] }
 * If address omitted, custodial wallet for userId is used.
 */
tokenRouter.post('/admin/airdrop-snapshot', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const allocations = Array.isArray(req.body?.allocations) ? req.body.allocations : [];
    if (!allocations.length) {
      return res.status(400).json({ status: 'error', message: 'allocations[] required' });
    }
    const snapshotList: Array<{ address: string; amount: string | number; userId?: string }> = [];
    for (const row of allocations) {
      const amount = Number(row.amount);
      if (!amount || amount <= 0) {
        return res.status(400).json({ status: 'error', message: 'each allocation needs amount > 0' });
      }
      let address = row.address as string | undefined;
      const userId = row.userId as string | undefined;
      if (!address && userId) {
        const wallet = await tokens.ensureCustodialWallet(userId);
        address = wallet.address;
      }
      if (!address) {
        return res
          .status(400)
          .json({ status: 'error', message: 'each allocation needs address or userId' });
      }
      snapshotList.push({ address, amount, userId });
    }
    const data = await tokens.persistAirdropSnapshot(snapshotList, req.body?.label);
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

export { tokens };
