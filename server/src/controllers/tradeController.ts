import type { Request, Response } from 'express';
import { TradeService } from '../services/tradeService.js';
import type {
  CreateTradeInput,
  PaginationOptions,
  TradeDirection,
  TradeFilters,
  TradeStatus,
  UpdateTradeInput
} from '../models/tradeModel.js';

const tradeService = new TradeService();
const DIRECTIONS: TradeDirection[] = ['long', 'short'];
const STATUSES: TradeStatus[] = ['open', 'closed'];
const MAX_PAGE_SIZE = 5000;

/**
 * Handles trade CRUD HTTP requests.
 */
export class TradeController {
  /**
   * GET /api/trades
   *
   * @param req - Express request with filters and pagination query.
   * @param res - Express response.
   */
  async list(req: Request, res: Response) {
    const filters = parseTradeFilters(req);
    const pagination = parsePagination(req);
    const result = await tradeService.listTrades(filters, pagination);

    res.json({ data: result.items, pagination: result.pagination });
  }

  /**
   * GET /api/trades/:id
   *
   * @param req - Express request with trade id.
   * @param res - Express response.
   */
  async detail(req: Request, res: Response) {
    const id = parseId(req.params.id);
    const trade = await tradeService.getTradeById(id);

    if (!trade) {
      res.status(404).json({ message: '交易记录不存在' });
      return;
    }

    res.json({ data: trade });
  }

  /**
   * POST /api/trades
   *
   * @param req - Express request with create payload.
   * @param res - Express response.
   */
  async create(req: Request, res: Response) {
    const input = parseCreateTradeInput(req.body);
    const trade = await tradeService.createTrade(input);

    res.status(201).json({ data: trade });
  }

  /**
   * PUT /api/trades/:id
   *
   * @param req - Express request with update payload.
   * @param res - Express response.
   */
  async update(req: Request, res: Response) {
    const id = parseId(req.params.id);
    const input = parseUpdateTradeInput(req.body);
    const trade = await tradeService.updateTrade(id, input);

    if (!trade) {
      res.status(404).json({ message: '交易记录不存在' });
      return;
    }

    res.json({ data: trade });
  }

  /**
   * DELETE /api/trades/:id
   *
   * @param req - Express request with trade id.
   * @param res - Express response.
   */
  async remove(req: Request, res: Response) {
    const id = parseId(req.params.id);
    const deleted = await tradeService.deleteTrade(id);

    if (!deleted) {
      res.status(404).json({ message: '交易记录不存在' });
      return;
    }

    res.status(204).send();
  }
}

/**
 * Reads pagination parameters with sane defaults and limits.
 *
 * @param req - Express request.
 * @returns Normalized pagination options.
 */
export function parsePagination(req: Request): PaginationOptions {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);

  if (!Number.isInteger(page) || page < 1) {
    throw new ValidationError('page 必须是大于 0 的整数');
  }

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new ValidationError(`pageSize 必须是 1 到 ${MAX_PAGE_SIZE} 之间的整数`);
  }

  return { page, pageSize };
}

/**
 * Represents a user input validation failure.
 */
export class ValidationError extends Error {
  statusCode = 400;
}

function parseId(value: string | undefined): number {
  const id = Number(value);

  if (!Number.isInteger(id) || id < 1) {
    throw new ValidationError('id 必须是大于 0 的整数');
  }

  return id;
}

function parseTradeFilters(req: Request): TradeFilters {
  const filters: TradeFilters = {};
  const { startDate, endDate, symbol, direction, status, tag } = req.query;

  if (typeof startDate === 'string') {
    assertDate(startDate, 'startDate');
    filters.startDate = startDate;
  }

  if (typeof endDate === 'string') {
    assertDate(endDate, 'endDate');
    filters.endDate = endDate;
  }

  if (typeof symbol === 'string' && symbol.trim()) {
    filters.symbol = symbol.trim().toUpperCase();
  }

  if (typeof direction === 'string') {
    assertEnum(direction, DIRECTIONS, 'direction');
    filters.direction = direction;
  }

  if (typeof status === 'string') {
    assertEnum(status, STATUSES, 'status');
    filters.status = status;
  }

  if (typeof tag === 'string' && tag.trim()) {
    filters.tag = tag.trim();
  }

  return filters;
}

function parseCreateTradeInput(body: Record<string, unknown>): CreateTradeInput {
  const input = parseTradePayload(body, true) as CreateTradeInput;

  return {
    ...input,
    leverage: input.leverage ?? 1,
    pnl: input.pnl ?? 0,
    pnlPercentage: input.pnlPercentage ?? 0,
    fee: input.fee ?? 0,
    status: input.status ?? 'open',
    tags: input.tags ?? [],
    screenshots: input.screenshots ?? []
  };
}

function parseUpdateTradeInput(body: Record<string, unknown>): UpdateTradeInput {
  return parseTradePayload(body, false);
}

function parseTradePayload(body: Record<string, unknown>, requireBaseFields: boolean): UpdateTradeInput {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('请求体必须是 JSON 对象');
  }

  const input: UpdateTradeInput = {};

  if ('tradeId' in body) input.tradeId = nullableString(body.tradeId, 'tradeId');
  if ('symbol' in body) input.symbol = requiredString(body.symbol, 'symbol').toUpperCase();
  if ('direction' in body) {
    const direction = requiredString(body.direction, 'direction');
    assertEnum(direction, DIRECTIONS, 'direction');
    input.direction = direction;
  }
  if ('entryPrice' in body) input.entryPrice = positiveNumber(body.entryPrice, 'entryPrice');
  if ('exitPrice' in body) input.exitPrice = nullableNumber(body.exitPrice, 'exitPrice');
  if ('quantity' in body) input.quantity = positiveNumber(body.quantity, 'quantity');
  if ('leverage' in body) input.leverage = positiveInteger(body.leverage, 'leverage');
  if ('entryTime' in body) input.entryTime = requiredDate(body.entryTime, 'entryTime');
  if ('exitTime' in body) input.exitTime = nullableDate(body.exitTime, 'exitTime');
  if ('pnl' in body) input.pnl = numberValue(body.pnl, 'pnl');
  if ('pnlPercentage' in body) input.pnlPercentage = numberValue(body.pnlPercentage, 'pnlPercentage');
  if ('fee' in body) input.fee = numberValue(body.fee, 'fee');
  if ('status' in body) {
    const status = requiredString(body.status, 'status');
    assertEnum(status, STATUSES, 'status');
    input.status = status;
  }
  if ('entryReason' in body) input.entryReason = nullableString(body.entryReason, 'entryReason');
  if ('exitReason' in body) input.exitReason = nullableString(body.exitReason, 'exitReason');
  if ('tags' in body) input.tags = stringArray(body.tags, 'tags');
  if ('notes' in body) input.notes = nullableString(body.notes, 'notes');
  if ('screenshots' in body) input.screenshots = stringArray(body.screenshots, 'screenshots');
  if ('rating' in body) input.rating = nullableRating(body.rating);

  if (requireBaseFields) {
    for (const key of ['symbol', 'direction', 'entryPrice', 'quantity', 'entryTime'] as const) {
      if (input[key] === undefined) {
        throw new ValidationError(`${key} 为必填字段`);
      }
    }
  }

  return input;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${field} 必须是非空字符串`);
  }

  return value.trim();
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  return requiredString(value, field);
}

function numberValue(value: unknown, field: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new ValidationError(`${field} 必须是数字`);
  }

  return parsed;
}

function positiveNumber(value: unknown, field: string): number {
  const parsed = numberValue(value, field);

  if (parsed <= 0) {
    throw new ValidationError(`${field} 必须大于 0`);
  }

  return parsed;
}

function nullableNumber(value: unknown, field: string): number | null {
  if (value === null) return null;
  return positiveNumber(value, field);
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ValidationError(`${field} 必须是大于 0 的整数`);
  }

  return parsed;
}

function requiredDate(value: unknown, field: string): string {
  const date = requiredString(value, field);
  assertDate(date, field);
  return date;
}

function nullableDate(value: unknown, field: string): string | null {
  if (value === null) return null;
  return requiredDate(value, field);
}

function assertDate(value: string, field: string) {
  if (Number.isNaN(Date.parse(value))) {
    throw new ValidationError(`${field} 必须是有效日期`);
  }
}

function assertEnum<T extends string>(value: string, options: readonly T[], field: string): asserts value is T {
  if (!options.includes(value as T)) {
    throw new ValidationError(`${field} 只能是 ${options.join('/')}`);
  }
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${field} 必须是字符串数组`);
  }

  return value.map((item) => requiredString(item, field));
}

function nullableRating(value: unknown): number | null {
  if (value === null) return null;
  const rating = Number(value);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ValidationError('rating 必须是 1 到 5 之间的整数');
  }

  return rating;
}
