import { TradeService } from './tradeService.js';
import type { CreateTradeInput, TradeDirection, TradeStatus, UpdateTradeInput } from '../models/tradeModel.js';

const tradeService = new TradeService();

export class Mt5SyncError extends Error {
  statusCode = 400;
}

export interface Mt5TradePayload {
  tradeId?: unknown;
  symbol?: unknown;
  direction?: unknown;
  entryPrice?: unknown;
  exitPrice?: unknown;
  quantity?: unknown;
  leverage?: unknown;
  entryTime?: unknown;
  exitTime?: unknown;
  pnl?: unknown;
  fee?: unknown;
  status?: unknown;
  notes?: unknown;
}

export interface Mt5SyncPayload {
  account?: unknown;
  server?: unknown;
  syncedAt?: unknown;
  trades?: unknown;
}

export interface Mt5SyncResult {
  account: string | null;
  received: number;
  created: number;
  updated: number;
}

/**
 * Upserts MT5 trades pushed by the local MT5 expert advisor.
 *
 * @param payload - Raw JSON body sent by MT5.
 * @returns Sync counters.
 */
export async function syncMt5Trades(payload: Mt5SyncPayload): Promise<Mt5SyncResult> {
  if (!Array.isArray(payload.trades)) {
    throw new Mt5SyncError('trades 必须是数组');
  }

  let created = 0;
  let updated = 0;

  for (const rawTrade of payload.trades) {
    const trade = normalizeMt5Trade(rawTrade as Mt5TradePayload);
    const existing = await tradeService.getTradeByTradeId(trade.tradeId);

    if (existing) {
      await tradeService.updateTrade(existing.id, buildMt5Update(trade));
      updated += 1;
    } else {
      await tradeService.createTrade(trade);
      created += 1;
    }
  }

  await tradeService.rebuildDailySummary();

  return {
    account: payload.account === undefined || payload.account === null ? null : String(payload.account),
    received: payload.trades.length,
    created,
    updated
  };
}

function normalizeMt5Trade(raw: Mt5TradePayload): CreateTradeInput & { tradeId: string } {
  const tradeId = requiredString(raw.tradeId, 'tradeId');
  const symbol = requiredString(raw.symbol, 'symbol');
  const direction = enumValue(requiredString(raw.direction, 'direction'), ['long', 'short'], 'direction') as TradeDirection;
  const entryPrice = positiveNumber(raw.entryPrice, 'entryPrice');
  const quantity = positiveNumber(raw.quantity, 'quantity');
  const leverage = positiveInteger(raw.leverage ?? 1, 'leverage');
  const entryTime = dateString(raw.entryTime, 'entryTime');
  const status = enumValue(String(raw.status || 'closed'), ['open', 'closed'], 'status') as TradeStatus;
  const exitTime = raw.exitTime === null || raw.exitTime === undefined || raw.exitTime === ''
    ? null
    : dateString(raw.exitTime, 'exitTime');
  const exitPrice = raw.exitPrice === null || raw.exitPrice === undefined || raw.exitPrice === ''
    ? null
    : positiveNumber(raw.exitPrice, 'exitPrice');
  const pnl = numberValue(raw.pnl ?? 0, 'pnl');
  const fee = numberValue(raw.fee ?? 0, 'fee');
  const notes = raw.notes === undefined || raw.notes === null ? null : String(raw.notes);
  const pnlPercentage = calculatePnlPercentage(direction, entryPrice, exitPrice, pnl);

  return {
    tradeId,
    symbol,
    direction,
    entryPrice,
    exitPrice,
    quantity,
    leverage,
    entryTime,
    exitTime,
    pnl,
    pnlPercentage,
    fee,
    status,
    notes,
    tags: ['MT5'],
    screenshots: []
  };
}

function buildMt5Update(trade: CreateTradeInput): UpdateTradeInput {
  return {
    symbol: trade.symbol,
    direction: trade.direction,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    quantity: trade.quantity,
    leverage: trade.leverage,
    entryTime: trade.entryTime,
    exitTime: trade.exitTime,
    pnl: trade.pnl,
    pnlPercentage: trade.pnlPercentage,
    fee: trade.fee,
    status: trade.status
  };
}

function calculatePnlPercentage(direction: TradeDirection, entryPrice: number, exitPrice: number | null, pnl: number) {
  if (!exitPrice || !entryPrice) return 0;
  const priceMove = direction === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice;
  const percentage = (priceMove / entryPrice) * 100;
  return Number((percentage || pnl).toFixed(4));
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Mt5SyncError(`${field} 必须存在`);
  }
  const text = String(value).trim();
  if (!text) throw new Mt5SyncError(`${field} 不能为空`);
  return text;
}

function numberValue(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Mt5SyncError(`${field} 必须是数字`);
  return parsed;
}

function positiveNumber(value: unknown, field: string): number {
  const parsed = numberValue(value, field);
  if (parsed <= 0) throw new Mt5SyncError(`${field} 必须大于 0`);
  return parsed;
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Mt5SyncError(`${field} 必须是正整数`);
  return parsed;
}

function enumValue(value: string, options: string[], field: string): string {
  if (!options.includes(value)) throw new Mt5SyncError(`${field} 值不合法`);
  return value;
}

function dateString(value: unknown, field: string): string {
  const text = requiredString(value, field);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Mt5SyncError(`${field} 必须是有效时间`);
  return date.toISOString();
}
