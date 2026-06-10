import type { Request, Response } from 'express';
import { assertMt5SyncToken, syncMt5Trades } from '../services/mt5SyncService.js';

/**
 * Handles MT5 local bridge sync requests.
 */
export class Mt5Controller {
  /**
   * POST /api/mt5/sync
   *
   * @param req - Express request with normalized MT5 trades.
   * @param res - Express response.
   */
  async sync(req: Request, res: Response) {
    assertMt5SyncToken(req.header('x-mt5-sync-token'));
    const result = await syncMt5Trades(req.body);
    res.json({ data: result });
  }
}
