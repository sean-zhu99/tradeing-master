import type { Request, Response } from 'express';
import { fetchTradeKlineData } from '../services/marketDataService.js';
import { ValidationError } from './tradeController.js';

/**
 * Handles market-data endpoints used by trade review charting.
 */
export class MarketController {
  /**
   * GET /api/market/trades/:id/kline
   *
   * @param req - Express request with trade id.
   * @param res - Express response.
   */
  async tradeKline(req: Request, res: Response) {
    const id = parseId(req.params.id);
    const data = await fetchTradeKlineData(id);

    if (!data) {
      res.status(404).json({ message: '交易记录不存在' });
      return;
    }

    res.json({ data });
  }
}

function parseId(value: string | undefined): number {
  const id = Number(value);

  if (!Number.isInteger(id) || id < 1) {
    throw new ValidationError('id 必须是大于 0 的整数');
  }

  return id;
}
