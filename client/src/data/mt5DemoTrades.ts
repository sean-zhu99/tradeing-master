import type { Trade } from '@/types';
import { mt5ReportTrades } from './mt5ReportTrades';

export const mt5DemoTrades: Trade[] = mt5ReportTrades.map((trade) => {
  const pnlPercentage = calculatePnlPercentage(trade);
  const isWin = trade.netPnl >= 0;

  return {
    id: 500000 + trade.id,
    tradeId: trade.tradeId,
    symbol: trade.symbol,
    direction: trade.direction,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    quantity: trade.volume,
    leverage: 1,
    entryTime: normalizeReportTime(trade.entryTime),
    exitTime: normalizeReportTime(trade.exitTime),
    pnl: trade.netPnl,
    pnlPercentage,
    fee: Math.abs(trade.fee) + Math.abs(trade.swap),
    status: 'closed',
    entryReason: 'MT5 历史报表导入订单，待补充复盘原因。',
    exitReason: 'MT5 历史报表导入订单，待补充出场原因。',
    tags: ['MT5', trade.symbol, trade.direction === 'long' ? 'Long' : 'Short', isWin ? '盈利' : '亏损'],
    notes: `Position ${trade.positionId} imported from MT5 static report.`,
    screenshots: [],
    rating: null,
    createdAt: normalizeReportTime(trade.entryTime),
    updatedAt: normalizeReportTime(trade.exitTime)
  };
});

function normalizeReportTime(value: string | null) {
  if (!value) return new Date().toISOString();
  return value.replace(/\./g, '-').replace(' ', 'T');
}

function calculatePnlPercentage(trade: (typeof mt5ReportTrades)[number]) {
  if (!trade.entryPrice || !trade.exitPrice) return 0;
  const move = trade.direction === 'long'
    ? trade.exitPrice - trade.entryPrice
    : trade.entryPrice - trade.exitPrice;
  return Number(((move / trade.entryPrice) * 100).toFixed(4));
}
