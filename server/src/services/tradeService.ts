import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { dbPool } from '../config/database.js';
import type {
  CreateTradeInput,
  PaginatedResult,
  PaginationOptions,
  Trade,
  TradeFilters,
  TradeRow,
  UpdateTradeInput
} from '../models/tradeModel.js';

const TRADE_COLUMNS = `
  id,
  trade_id,
  symbol,
  direction,
  entry_price,
  exit_price,
  quantity,
  leverage,
  entry_time,
  exit_time,
  pnl,
  pnl_percentage,
  fee,
  status,
  entry_reason,
  exit_reason,
  tags,
  notes,
  screenshots,
  rating,
  created_at,
  updated_at
`;

type CountRow = RowDataPacket & { total: number };
type SqlValue = string | number | null;

/**
 * Safely parses JSON columns from MySQL into arrays.
 *
 * @param value - Raw JSON column value returned by mysql2.
 * @returns Parsed string array, or an empty array when the value is empty/invalid.
 */
function parseJsonArray(value: string | string[] | null): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Converts a database trade row into the API-facing camelCase shape.
 *
 * @param row - Raw database row.
 * @returns Normalized trade object.
 */
export function mapTradeRow(row: TradeRow): Trade {
  return {
    id: row.id,
    tradeId: row.trade_id,
    symbol: row.symbol,
    direction: row.direction,
    entryPrice: Number(row.entry_price),
    exitPrice: row.exit_price === null ? null : Number(row.exit_price),
    quantity: Number(row.quantity),
    leverage: row.leverage,
    entryTime: new Date(row.entry_time).toISOString(),
    exitTime: row.exit_time ? new Date(row.exit_time).toISOString() : null,
    pnl: Number(row.pnl),
    pnlPercentage: Number(row.pnl_percentage),
    fee: Number(row.fee),
    status: row.status,
    entryReason: row.entry_reason,
    exitReason: row.exit_reason,
    tags: parseJsonArray(row.tags),
    notes: row.notes,
    screenshots: parseJsonArray(row.screenshots),
    rating: row.rating,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

/**
 * Provides all trade persistence operations.
 */
export class TradeService {
  /**
   * Lists trades with optional filters and pagination.
   *
   * @param filters - Query filters for date range, symbol, direction, status, and tag.
   * @param pagination - Page and page size options.
   * @returns Paginated trade list.
   */
  async listTrades(
    filters: TradeFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<Trade>> {
    const { whereClause, params } = this.buildWhereClause(filters);
    const offset = (pagination.page - 1) * pagination.pageSize;

    const [countRows] = await dbPool.query<CountRow[]>(
      `SELECT COUNT(*) AS total FROM trades ${whereClause}`,
      params
    );

    const [rows] = await dbPool.query<(TradeRow & RowDataPacket)[]>(
      `SELECT ${TRADE_COLUMNS}
       FROM trades
       ${whereClause}
       ORDER BY entry_time DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, pagination.pageSize, offset]
    );

    const total = Number(countRows[0]?.total || 0);

    return {
      items: rows.map(mapTradeRow),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: Math.ceil(total / pagination.pageSize)
      }
    };
  }

  /**
   * Finds one trade by primary key.
   *
   * @param id - Trade primary key.
   * @returns Trade detail, or null when not found.
   */
  async getTradeById(id: number): Promise<Trade | null> {
    const [rows] = await dbPool.query<(TradeRow & RowDataPacket)[]>(
      `SELECT ${TRADE_COLUMNS} FROM trades WHERE id = ? LIMIT 1`,
      [id]
    );

    return rows[0] ? mapTradeRow(rows[0]) : null;
  }

  /**
   * Finds one trade by the external broker/order identifier.
   *
   * @param tradeId - External trade identifier from MT5 or an exchange.
   * @returns Trade detail, or null when not found.
   */
  async getTradeByTradeId(tradeId: string): Promise<Trade | null> {
    const [rows] = await dbPool.query<(TradeRow & RowDataPacket)[]>(
      `SELECT ${TRADE_COLUMNS} FROM trades WHERE trade_id = ? LIMIT 1`,
      [tradeId]
    );

    return rows[0] ? mapTradeRow(rows[0]) : null;
  }

  /**
   * Creates a manual trade record for journaling and review.
   *
   * @param input - Validated trade payload.
   * @returns Created trade.
   */
  async createTrade(input: CreateTradeInput): Promise<Trade> {
    const [result] = await dbPool.execute<ResultSetHeader>(
      `INSERT INTO trades (
        trade_id,
        symbol,
        direction,
        entry_price,
        exit_price,
        quantity,
        leverage,
        entry_time,
        exit_time,
        pnl,
        pnl_percentage,
        fee,
        status,
        entry_reason,
        exit_reason,
        tags,
        notes,
        screenshots,
        rating
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.tradeId ?? null,
        input.symbol,
        input.direction,
        input.entryPrice,
        input.exitPrice ?? null,
        input.quantity,
        input.leverage ?? 1,
        toMysqlDateTime(input.entryTime),
        toMysqlDateTime(input.exitTime ?? null),
        input.pnl ?? 0,
        input.pnlPercentage ?? 0,
        input.fee ?? 0,
        input.status ?? 'open',
        input.entryReason ?? null,
        input.exitReason ?? null,
        JSON.stringify(input.tags ?? []),
        input.notes ?? null,
        JSON.stringify(input.screenshots ?? []),
        input.rating ?? null
      ]
    );

    const created = await this.getTradeById(result.insertId);
    if (!created) {
      throw new Error('交易创建成功，但读取创建结果失败');
    }

    return created;
  }

  /**
   * Updates an existing trade, including close data and review fields.
   *
   * @param id - Trade primary key.
   * @param input - Partial update payload.
   * @returns Updated trade, or null when not found.
   */
  async updateTrade(id: number, input: UpdateTradeInput): Promise<Trade | null> {
    const fieldMap: Record<keyof UpdateTradeInput, string> = {
      tradeId: 'trade_id',
      symbol: 'symbol',
      direction: 'direction',
      entryPrice: 'entry_price',
      exitPrice: 'exit_price',
      quantity: 'quantity',
      leverage: 'leverage',
      entryTime: 'entry_time',
      exitTime: 'exit_time',
      pnl: 'pnl',
      pnlPercentage: 'pnl_percentage',
      fee: 'fee',
      status: 'status',
      entryReason: 'entry_reason',
      exitReason: 'exit_reason',
      tags: 'tags',
      notes: 'notes',
      screenshots: 'screenshots',
      rating: 'rating'
    };

    const assignments: string[] = [];
    const values: SqlValue[] = [];

    for (const [key, column] of Object.entries(fieldMap) as [keyof UpdateTradeInput, string][]) {
      if (input[key] === undefined) continue;

      assignments.push(`${column} = ?`);
      const value = input[key];
      values.push(formatDatabaseValue(key, value));
    }

    if (!assignments.length) {
      return this.getTradeById(id);
    }

    const [result] = await dbPool.execute<ResultSetHeader>(
      `UPDATE trades SET ${assignments.join(', ')} WHERE id = ?`,
      [...values, id]
    );

    if (result.affectedRows === 0) return null;
    return this.getTradeById(id);
  }

  /**
   * Deletes a trade by primary key.
   *
   * @param id - Trade primary key.
   * @returns True when a row was deleted.
   */
  async deleteTrade(id: number): Promise<boolean> {
    const [result] = await dbPool.execute<ResultSetHeader>('DELETE FROM trades WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  /**
   * Rebuilds the daily summary table from closed trades.
   *
   * @returns Number of affected summary rows.
   */
  async rebuildDailySummary(): Promise<number> {
    await dbPool.execute('DELETE FROM daily_summary');

    const [result] = await dbPool.execute<ResultSetHeader>(
      `INSERT INTO daily_summary (date, total_pnl, trade_count, win_count, loss_count, total_fee)
       SELECT
         DATE(COALESCE(exit_time, entry_time)) AS date,
         COALESCE(SUM(pnl), 0) AS total_pnl,
         COUNT(*) AS trade_count,
         SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) AS win_count,
         SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) AS loss_count,
         COALESCE(SUM(fee), 0) AS total_fee
       FROM trades
       WHERE status = 'closed'
       GROUP BY DATE(COALESCE(exit_time, entry_time))`
    );

    return result.affectedRows;
  }

  private buildWhereClause(filters: TradeFilters): { whereClause: string; params: unknown[] } {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filters.startDate) {
      clauses.push('entry_time >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      clauses.push('entry_time <= ?');
      params.push(filters.endDate);
    }

    if (filters.symbol) {
      clauses.push('symbol = ?');
      params.push(filters.symbol);
    }

    if (filters.direction) {
      clauses.push('direction = ?');
      params.push(filters.direction);
    }

    if (filters.status) {
      clauses.push('status = ?');
      params.push(filters.status);
    }

    if (filters.tag) {
      clauses.push('JSON_CONTAINS(tags, JSON_QUOTE(?))');
      params.push(filters.tag);
    }

    return {
      whereClause: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
      params
    };
  }
}

function formatDatabaseValue(key: keyof UpdateTradeInput, value: UpdateTradeInput[keyof UpdateTradeInput]): SqlValue {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (key === 'entryTime' || key === 'exitTime') return toMysqlDateTime(value as string | null | undefined);
  return value as SqlValue;
}

function toMysqlDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  }

  return value.replace('T', ' ').replace(/\.\d{3}Z$/, '').replace(/Z$/, '').slice(0, 19);
}
