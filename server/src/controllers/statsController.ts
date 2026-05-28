import type { Request, Response } from 'express';
import { StatsService } from '../services/statsService.js';
import { parsePagination, ValidationError } from './tradeController.js';

const statsService = new StatsService();

/**
 * Handles statistical analysis HTTP requests.
 */
export class StatsController {
  /**
   * GET /api/summary/daily
   *
   * @param req - Express request with optional date filters and pagination.
   * @param res - Express response.
   */
  async daily(req: Request, res: Response) {
    const startDate = getOptionalDate(req.query.startDate, 'startDate');
    const endDate = getOptionalDate(req.query.endDate, 'endDate');
    const pagination = parsePagination(req);
    const result = await statsService.getDailySummary(startDate, endDate, pagination);

    res.json({ data: result.items, pagination: result.pagination });
  }

  /**
   * GET /api/summary/stats
   *
   * @param _req - Express request.
   * @param res - Express response.
   */
  async stats(_req: Request, res: Response) {
    const data = await statsService.getOverallStats();

    res.json({ data });
  }

  /**
   * GET /api/summary/tag-stats
   *
   * @param req - Express request with pagination.
   * @param res - Express response.
   */
  async tagStats(req: Request, res: Response) {
    const pagination = parsePagination(req);
    const result = await statsService.getTagStats(pagination);

    res.json({ data: result.items, pagination: result.pagination });
  }
}

function getOptionalDate(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;

  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new ValidationError(`${field} 必须是有效日期`);
  }

  return value;
}
