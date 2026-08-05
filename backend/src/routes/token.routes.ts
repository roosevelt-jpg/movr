import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
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

export { tokens };
