import type { Request, Response } from 'express';
import { ExchangeService } from '../services/exchangeService.js';
import { TradeService } from '../services/tradeService.js';

const exchangeService = new ExchangeService();
const tradeService = new TradeService();

/**
 * Handles exchange integration HTTP requests.
 */
export class ExchangeController {
  /**
   * GET /api/exchange/balance
   *
   * @param _req - Express request.
   * @param res - Express response.
   */
  async balance(_req: Request, res: Response) {
    const data = await exchangeService.getBalance();

    res.json({ data });
  }

  /**
   * POST /api/sync/trigger
   *
   * @param _req - Express request.
   * @param res - Express response.
   */
  async triggerSync(_req: Request, res: Response) {
    const affectedRows = await tradeService.rebuildDailySummary();

    res.json({
      data: {
        status: 'completed',
        affectedRows
      }
    });
  }
}
