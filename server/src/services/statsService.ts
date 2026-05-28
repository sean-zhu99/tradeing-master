import type { RowDataPacket } from 'mysql2';
import { dbPool } from '../config/database.js';
import type { DailySummary, OverallStats, TagStats } from '../models/statsModel.js';
import type { PaginatedResult, PaginationOptions, TradeRow } from '../models/tradeModel.js';
import { mapTradeRow } from './tradeService.js';

type CountRow = RowDataPacket & { total: number };

type DailySummaryRow = RowDataPacket & {
  date: Date | string;
  total_pnl: string | number;
  trade_count: number;
  win_count: number;
  loss_count: number;
  total_fee: string | number;
};

type OverallStatsRow = RowDataPacket & {
  total_pnl: string | number | null;
  total_fee: string | number | null;
  trade_count: number;
  win_count: number | null;
  loss_count: number | null;
  gross_profit: string | number | null;
  gross_loss: string | number | null;
  average_holding_minutes: string | number | null;
};

/**
 * Provides aggregate analytics for trading performance.
 */
export class StatsService {
  /**
   * Returns paginated daily PnL summaries.
   *
   * @param startDate - Optional inclusive start date.
   * @param endDate - Optional inclusive end date.
   * @param pagination - Page and page size options.
   * @returns Paginated daily summary rows.
   */
  async getDailySummary(
    startDate: string | undefined,
    endDate: string | undefined,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<DailySummary>> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (startDate) {
      clauses.push('date >= ?');
      params.push(startDate);
    }

    if (endDate) {
      clauses.push('date <= ?');
      params.push(endDate);
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const offset = (pagination.page - 1) * pagination.pageSize;

    const [countRows] = await dbPool.query<CountRow[]>(
      `SELECT COUNT(*) AS total FROM daily_summary ${whereClause}`,
      params
    );

    const [rows] = await dbPool.query<DailySummaryRow[]>(
      `SELECT date, total_pnl, trade_count, win_count, loss_count, total_fee
       FROM daily_summary
       ${whereClause}
       ORDER BY date DESC
       LIMIT ? OFFSET ?`,
      [...params, pagination.pageSize, offset]
    );

    const total = Number(countRows[0]?.total || 0);

    return {
      items: rows.map((row) => ({
        date: this.formatDate(row.date),
        totalPnl: Number(row.total_pnl),
        tradeCount: row.trade_count,
        winCount: row.win_count,
        lossCount: row.loss_count,
        totalFee: Number(row.total_fee)
      })),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: Math.ceil(total / pagination.pageSize)
      }
    };
  }

  /**
   * Calculates overall trading statistics from closed trades.
   *
   * @returns Overall account-level performance metrics.
   */
  async getOverallStats(): Promise<OverallStats> {
    const [rows] = await dbPool.query<OverallStatsRow[]>(
      `SELECT
         COALESCE(SUM(pnl), 0) AS total_pnl,
         COALESCE(SUM(fee), 0) AS total_fee,
         COUNT(*) AS trade_count,
         SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) AS win_count,
         SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) AS loss_count,
         COALESCE(SUM(CASE WHEN pnl > 0 THEN pnl ELSE 0 END), 0) AS gross_profit,
         COALESCE(ABS(SUM(CASE WHEN pnl < 0 THEN pnl ELSE 0 END)), 0) AS gross_loss,
         AVG(TIMESTAMPDIFF(MINUTE, entry_time, exit_time)) AS average_holding_minutes
       FROM trades
       WHERE status = 'closed'`
    );

    const row = rows[0];
    const tradeCount = Number(row?.trade_count || 0);
    const winCount = Number(row?.win_count || 0);
    const grossProfit = Number(row?.gross_profit || 0);
    const grossLoss = Number(row?.gross_loss || 0);

    return {
      totalPnl: Number(row?.total_pnl || 0),
      totalFee: Number(row?.total_fee || 0),
      tradeCount,
      winCount,
      lossCount: Number(row?.loss_count || 0),
      winRate: tradeCount ? Number(((winCount / tradeCount) * 100).toFixed(2)) : 0,
      profitLossRatio: grossLoss ? Number((grossProfit / grossLoss).toFixed(2)) : 0,
      maxDrawdown: await this.calculateMaxDrawdown(),
      averageHoldingMinutes: Number(Number(row?.average_holding_minutes || 0).toFixed(2))
    };
  }

  /**
   * Aggregates trading performance by review tags.
   *
   * @param pagination - Page and page size options.
   * @returns Paginated tag statistics.
   */
  async getTagStats(pagination: PaginationOptions): Promise<PaginatedResult<TagStats>> {
    const [rows] = await dbPool.query<(TradeRow & RowDataPacket)[]>(
      `SELECT *
       FROM trades
       WHERE status = 'closed' AND JSON_LENGTH(tags) > 0
       ORDER BY exit_time DESC, id DESC`
    );

    const tagMap = new Map<string, { tradeCount: number; totalPnl: number; winCount: number }>();

    for (const row of rows) {
      const trade = mapTradeRow(row);

      for (const tag of trade.tags) {
        const current = tagMap.get(tag) ?? { tradeCount: 0, totalPnl: 0, winCount: 0 };
        current.tradeCount += 1;
        current.totalPnl += trade.pnl;
        current.winCount += trade.pnl > 0 ? 1 : 0;
        tagMap.set(tag, current);
      }
    }

    const allItems = Array.from(tagMap.entries())
      .map(([tag, value]) => ({
        tag,
        tradeCount: value.tradeCount,
        totalPnl: Number(value.totalPnl.toFixed(2)),
        winRate: Number(((value.winCount / value.tradeCount) * 100).toFixed(2)),
        averagePnl: Number((value.totalPnl / value.tradeCount).toFixed(2))
      }))
      .sort((a, b) => b.totalPnl - a.totalPnl);

    const start = (pagination.page - 1) * pagination.pageSize;
    const items = allItems.slice(start, start + pagination.pageSize);

    return {
      items,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: allItems.length,
        totalPages: Math.ceil(allItems.length / pagination.pageSize)
      }
    };
  }

  private async calculateMaxDrawdown(): Promise<number> {
    const [rows] = await dbPool.query<(RowDataPacket & { pnl: string | number })[]>(
      `SELECT pnl
       FROM trades
       WHERE status = 'closed'
       ORDER BY COALESCE(exit_time, entry_time), id`
    );

    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;

    for (const row of rows) {
      equity += Number(row.pnl);
      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, peak - equity);
    }

    return Number(maxDrawdown.toFixed(2));
  }

  private formatDate(value: Date | string): string {
    return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  }
}
